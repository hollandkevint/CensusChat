import { EventEmitter } from 'events';
import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';
import path from 'path';

export interface DuckDBPoolConfig {
  minConnections: number;
  maxConnections: number;
  connectionTimeout: number;
  dbPath?: string;
  memoryLimit?: string;
  threads?: number;
  encryptionKey?: string;
}

export interface PoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
}

export class DuckDBPool extends EventEmitter {
  private instance: DuckDBInstance | null = null;
  private connections: DuckDBConnection[] = [];
  private activeConnections: Set<DuckDBConnection> = new Set();
  private readonly config: DuckDBPoolConfig;
  private readonly dbPath: string;
  private readonly encryptionKey: string;
  private waitingQueue: Array<{
    resolve: (conn: DuckDBConnection) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];
  private isInitialized: boolean = false;
  private isClosing: boolean = false;

  constructor(config: Partial<DuckDBPoolConfig> = {}) {
    super();

    // Set default configuration optimized for healthcare analytics
    this.config = {
      minConnections: 2,
      maxConnections: 10,
      connectionTimeout: 30000,
      memoryLimit: '4GB',
      threads: 4,
      ...config
    };

    this.dbPath = config.dbPath || path.join(process.cwd(), 'data', 'census.duckdb');

    // Read encryption key from config or environment variable
    // If set, the database file must already be encrypted
    this.encryptionKey = config.encryptionKey || process.env.DUCKDB_ENCRYPTION_KEY || '';

    console.log('DuckDB Pool initialized with config:', {
      ...this.config,
      dbPath: this.dbPath,
      encrypted: this.encryptionKey ? 'yes' : 'no'
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('DuckDB Pool already initialized');
      return;
    }

    console.log('Initializing DuckDB connection pool...');

    try {
      if (this.encryptionKey) {
        // For encrypted databases, use in-memory instance and ATTACH encrypted file
        // This is the recommended pattern from DuckDB encryption documentation
        console.log('Using encrypted database mode...');
        this.instance = await DuckDBInstance.create(':memory:', {
          memory_limit: this.config.memoryLimit || '4GB',
          threads: String(this.config.threads || 4),
        });
      } else {
        // For unencrypted databases, use fromCache for singleton management
        this.instance = await DuckDBInstance.fromCache(this.dbPath, {
          memory_limit: this.config.memoryLimit || '4GB',
          threads: String(this.config.threads || 4),
        });
      }

      // Create minimum connections
      for (let i = 0; i < this.config.minConnections; i++) {
        const conn = await this.createConnection();
        this.connections.push(conn);
        console.log(`Created connection ${i + 1}/${this.config.minConnections}`);
      }

      this.isInitialized = true;
      this.emit('initialized');
      console.log('DuckDB Pool initialization complete');
    } catch (error) {
      console.error('DuckDB Pool initialization failed:', error);
      this.emit('error', error);
      throw error;
    }
  }

  private async createConnection(): Promise<DuckDBConnection> {
    if (!this.instance) {
      throw new Error('DuckDB instance not initialized');
    }

    const connectionPromise = (async () => {
      const conn = await this.instance!.connect();

      // Configure healthcare-specific DuckDB settings
      await conn.run(`SET enable_progress_bar = true`);
      await conn.run(`SET default_null_order = 'NULLS LAST'`);

      // Install and load extensions for data federation
      // httpfs provides hardware-accelerated encryption via OpenSSL
      try {
        await conn.run('INSTALL httpfs');
        await conn.run('LOAD httpfs');
      } catch (e) {
        // Extension may already be installed, continue
      }

      try {
        await conn.run('INSTALL spatial');
        await conn.run('LOAD spatial');
      } catch (e) {
        // Extension may already be installed, continue
      }

      // Attach encrypted database if encryption key is provided
      if (this.encryptionKey) {
        try {
          await conn.run(`
            ATTACH '${this.dbPath}' AS census (
              ENCRYPTION_KEY '${this.encryptionKey}',
              ENCRYPTION_CIPHER 'GCM'
            )
          `);
          // Set census as the default schema for queries
          await conn.run('USE census');
          console.log('Encrypted database attached successfully');
        } catch (e) {
          const error = e as Error;
          throw new Error(`Failed to attach encrypted database: ${error.message}`);
        }
      }

      console.log('Healthcare settings and extensions configured');
      return conn;
    })();

    // Apply timeout wrapper
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Database connection timeout'));
      }, this.config.connectionTimeout);
    });

    return Promise.race([connectionPromise, timeoutPromise]);
  }

  async acquire(): Promise<DuckDBConnection> {
    if (this.isClosing) {
      throw new Error('Pool is closing, cannot acquire new connections');
    }

    if (!this.isInitialized) {
      await this.initialize();
    }

    // Try to get an idle connection first
    const idleConnection = this.connections.find(conn => !this.activeConnections.has(conn));
    if (idleConnection) {
      this.activeConnections.add(idleConnection);
      this.emit('acquire', idleConnection);
      return idleConnection;
    }

    // If no idle connections and we can create more
    if (this.connections.length < this.config.maxConnections) {
      try {
        const newConnection = await this.createConnection();
        this.connections.push(newConnection);
        this.activeConnections.add(newConnection);
        this.emit('acquire', newConnection);
        return newConnection;
      } catch (error) {
        console.error('Failed to create new connection:', error);
        throw error;
      }
    }

    // Wait for a connection to become available
    return new Promise((resolve, reject) => {
      const requestTimeout = setTimeout(() => {
        // Remove this request from the queue
        const index = this.waitingQueue.findIndex(req => req.resolve === resolve);
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
        }
        reject(new Error('Connection request timeout'));
      }, this.config.connectionTimeout);

      this.waitingQueue.push({
        resolve: (conn: DuckDBConnection) => {
          clearTimeout(requestTimeout);
          resolve(conn);
        },
        reject: (error: Error) => {
          clearTimeout(requestTimeout);
          reject(error);
        },
        timestamp: Date.now()
      });
    });
  }

  release(connection: DuckDBConnection): void {
    if (!this.activeConnections.has(connection)) {
      console.warn('Attempting to release a connection that is not active');
      return;
    }

    this.activeConnections.delete(connection);
    this.emit('release', connection);

    // Check if anyone is waiting for a connection
    if (this.waitingQueue.length > 0) {
      const waitingRequest = this.waitingQueue.shift();
      if (waitingRequest) {
        this.activeConnections.add(connection);
        waitingRequest.resolve(connection);
        return;
      }
    }

    // If we have too many idle connections, close the excess
    const idleCount = this.connections.length - this.activeConnections.size;
    if (idleCount > this.config.minConnections) {
      this.closeConnection(connection);
    }
  }

  async query(sql: string): Promise<any[]> {
    const connection = await this.acquire();

    try {
      const reader = await connection.runAndReadAll(sql);
      const rows = reader.getRowObjects();
      console.log('DuckDB query successful, rows:', rows?.length || 0);
      return rows;
    } catch (error) {
      console.error('DuckDB query error:', error);
      const err = error as Error;
      throw new Error(`DuckDB query failed: ${err.message}`);
    } finally {
      this.release(connection);
    }
  }

  private closeConnection(connection: DuckDBConnection): void {
    const index = this.connections.indexOf(connection);
    if (index !== -1) {
      this.connections.splice(index, 1);
    }

    try {
      connection.disconnectSync();
      console.log('DuckDB connection closed');
    } catch (err) {
      console.error('Error closing DuckDB connection:', err);
    }
  }

  async close(): Promise<void> {
    if (this.isClosing) {
      return;
    }

    console.log('Closing DuckDB connection pool...');
    this.isClosing = true;

    // Reject all waiting requests
    while (this.waitingQueue.length > 0) {
      const request = this.waitingQueue.shift();
      if (request) {
        request.reject(new Error('Pool is closing'));
      }
    }

    // Close all connections
    for (const connection of this.connections) {
      try {
        connection.disconnectSync();
      } catch (err) {
        console.error('Error closing connection:', err);
      }
    }

    this.connections = [];
    this.activeConnections.clear();

    // Close the instance
    if (this.instance) {
      try {
        this.instance.closeSync();
      } catch (err) {
        console.error('Error closing DuckDB instance:', err);
      }
      this.instance = null;
    }

    this.isInitialized = false;
    this.isClosing = false;

    this.emit('closed');
    console.log('DuckDB connection pool closed');
  }

  getStats(): PoolStats {
    return {
      totalConnections: this.connections.length,
      activeConnections: this.activeConnections.size,
      idleConnections: this.connections.length - this.activeConnections.size,
      waitingRequests: this.waitingQueue.length
    };
  }

  // Health check for monitoring
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1 as test');
      return result.length === 1 && result[0].test === 1;
    } catch (error) {
      console.error('DuckDB pool health check failed:', error);
      return false;
    }
  }
}

// Singleton instance for the application
let poolInstance: DuckDBPool | null = null;

export function getDuckDBPool(config?: Partial<DuckDBPoolConfig>): DuckDBPool {
  if (!poolInstance) {
    poolInstance = new DuckDBPool(config);
  }
  return poolInstance;
}

export function closeDuckDBPool(): Promise<void> {
  if (poolInstance) {
    const closePromise = poolInstance.close();
    poolInstance = null;
    return closePromise;
  }
  return Promise.resolve();
}
