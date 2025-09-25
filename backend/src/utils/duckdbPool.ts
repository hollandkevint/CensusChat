import { EventEmitter } from 'events';
import { Database } from 'duckdb';
import path from 'path';

export interface DuckDBPoolConfig {
  minConnections: number;
  maxConnections: number;
  connectionTimeout: number;
  dbPath?: string;
  memoryLimit?: string;
  threads?: number;
}

export interface PoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
}

export class DuckDBPool extends EventEmitter {
  private connections: Database[] = [];
  private activeConnections: Set<Database> = new Set();
  private readonly config: DuckDBPoolConfig;
  private readonly dbPath: string;
  private waitingQueue: Array<{
    resolve: (db: Database) => void;
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

    console.log('🏊 DuckDB Pool initialized with config:', {
      ...this.config,
      dbPath: this.dbPath
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('⚠️ DuckDB Pool already initialized');
      return;
    }

    console.log('🚀 Initializing DuckDB connection pool...');

    try {
      // Create minimum connections
      for (let i = 0; i < this.config.minConnections; i++) {
        const db = await this.createConnection();
        this.connections.push(db);
        console.log(`📦 Created connection ${i + 1}/${this.config.minConnections}`);
      }

      this.isInitialized = true;
      this.emit('initialized');
      console.log('✅ DuckDB Pool initialization complete');
    } catch (error) {
      console.error('❌ DuckDB Pool initialization failed:', error);
      this.emit('error', error);
      throw error;
    }
  }

  private async createConnection(): Promise<Database> {
    return new Promise((resolve, reject) => {
      const connectionTimer = setTimeout(() => {
        reject(new Error('Database connection timeout'));
      }, this.config.connectionTimeout);

      try {
        const db = new Database(this.dbPath);

        // Configure healthcare-specific DuckDB settings
        const healthcareSettings = [
          `SET memory_limit = '${this.config.memoryLimit}'`,
          `SET threads = ${this.config.threads}`,
          `SET enable_progress_bar = true`,
          `SET default_null_order = 'NULLS LAST'`
        ];

        // Install and load MCP extensions for healthcare data federation
        const mcpExtensions = [
          'INSTALL httpfs',
          'LOAD httpfs',
          'INSTALL spatial',
          'LOAD spatial',
          'INSTALL duckdb_mcp FROM community',
          'LOAD duckdb_mcp'
        ];

        // Configure MCP security settings for healthcare
        const mcpSecuritySettings = [
          "SET allowed_mcp_commands = '/usr/bin/python3:/usr/bin/node'",
          "SET allowed_mcp_urls = 'https://api.census.gov:https://api.medicare.gov:file://'"
        ];

        const allSettings = [...healthcareSettings, ...mcpExtensions, ...mcpSecuritySettings];
        let settingIndex = 0;

        const executeNextSetting = () => {
          if (settingIndex >= allSettings.length) {
            clearTimeout(connectionTimer);
            console.log('🏥 Healthcare settings, MCP extensions, and security configured');
            resolve(db);
            return;
          }

          const setting = allSettings[settingIndex];
          settingIndex++;

          db.run(setting, (err) => {
            if (err && !err.message.includes('already installed')) {
              console.warn(`⚠️ Warning configuring setting "${setting}":`, err.message);
            }
            executeNextSetting();
          });
        };

        executeNextSetting();

      } catch (error) {
        clearTimeout(connectionTimer);
        reject(error);
      }
    });
  }

  async acquire(): Promise<Database> {
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
        console.error('❌ Failed to create new connection:', error);
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
        resolve: (db: Database) => {
          clearTimeout(requestTimeout);
          resolve(db);
        },
        reject: (error: Error) => {
          clearTimeout(requestTimeout);
          reject(error);
        },
        timestamp: Date.now()
      });
    });
  }

  release(connection: Database): void {
    if (!this.activeConnections.has(connection)) {
      console.warn('⚠️ Attempting to release a connection that is not active');
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

    return new Promise((resolve, reject) => {
      try {
        connection.all(sql, (err, rows) => {
          this.release(connection);

          if (err) {
            console.error('❌ DuckDB query error:', err);
            reject(new Error(`DuckDB query failed: ${err.message}`));
          } else {
            console.log('✅ DuckDB query successful, rows:', rows?.length || 0);
            resolve(rows || []);
          }
        });
      } catch (error) {
        this.release(connection);
        reject(error);
      }
    });
  }

  private closeConnection(connection: Database): void {
    const index = this.connections.indexOf(connection);
    if (index !== -1) {
      this.connections.splice(index, 1);
    }

    connection.close((err) => {
      if (err) {
        console.error('❌ Error closing DuckDB connection:', err);
      } else {
        console.log('✅ DuckDB connection closed');
      }
    });
  }

  async close(): Promise<void> {
    if (this.isClosing) {
      return;
    }

    console.log('🔄 Closing DuckDB connection pool...');
    this.isClosing = true;

    // Reject all waiting requests
    while (this.waitingQueue.length > 0) {
      const request = this.waitingQueue.shift();
      if (request) {
        request.reject(new Error('Pool is closing'));
      }
    }

    // Close all connections
    const closePromises = this.connections.map(connection => {
      return new Promise<void>((resolve) => {
        connection.close((err) => {
          if (err) {
            console.error('❌ Error closing connection:', err);
          }
          resolve();
        });
      });
    });

    await Promise.all(closePromises);

    this.connections = [];
    this.activeConnections.clear();
    this.isInitialized = false;
    this.isClosing = false;

    this.emit('closed');
    console.log('✅ DuckDB connection pool closed');
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
      console.error('❌ DuckDB pool health check failed:', error);
      return false;
    }
  }

  // Validate MCP functions are available
  async validateMCPExtension(): Promise<boolean> {
    try {
      // Check if MCP extension is loaded by testing a basic MCP function
      const result = await this.query("SELECT current_setting('loaded_extensions') as extensions");
      const extensions = result[0]?.extensions || '';
      const mcpLoaded = extensions.includes('duckdb_mcp');

      if (mcpLoaded) {
        console.log('✅ MCP extension validation successful');
      } else {
        console.warn('⚠️ MCP extension not detected in loaded extensions');
      }

      return mcpLoaded;
    } catch (error) {
      console.error('❌ MCP extension validation failed:', error);
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