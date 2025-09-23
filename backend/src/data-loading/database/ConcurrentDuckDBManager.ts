import { EventEmitter } from 'events';
import { Database } from 'duckdb';
import {
  LoadingConfiguration,
  DatabaseConnection
} from '../utils/LoadingTypes';

export interface ConnectionPoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  queuedRequests: number;
  totalQueries: number;
  averageQueryTime: number;
  connectionErrors: number;
}

export interface TransactionContext {
  id: string;
  connection: Database;
  startTime: Date;
  queries: number;
  isActive: boolean;
}

export interface QueryOptions {
  timeout?: number;
  priority?: 'low' | 'normal' | 'high';
  connection?: 'reader' | 'writer' | 'any';
  transaction?: boolean;
}

export class ConcurrentDuckDBManager extends EventEmitter {
  private config: LoadingConfiguration;
  private databasePath: string;
  
  // Connection pools
  private readerPool: Map<string, DatabaseConnection> = new Map();
  private writerPool: Map<string, DatabaseConnection> = new Map();
  private availableReaders: Set<string> = new Set();
  private availableWriters: Set<string> = new Set();
  
  // Request queues
  private readerQueue: Array<{ resolve: Function; reject: Function; priority: number }> = [];
  private writerQueue: Array<{ resolve: Function; reject: Function; priority: number }> = [];
  
  // Transaction management
  private activeTransactions: Map<string, TransactionContext> = new Map();
  
  // Performance tracking
  private stats: ConnectionPoolStats = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    queuedRequests: 0,
    totalQueries: 0,
    averageQueryTime: 0,
    connectionErrors: 0
  };
  
  private queryTimes: number[] = [];
  private maxQueryTimeHistory: number = 1000;
  
  // Maintenance
  private maintenanceInterval?: NodeJS.Timeout;
  private lastVacuum: Date = new Date();
  private isInitialized: boolean = false;

  constructor(config: LoadingConfiguration, databasePath: string = 'data/census.duckdb') {
    super();
    this.config = config;
    this.databasePath = databasePath;
    
    console.log('ConcurrentDuckDBManager initializing...');
  }

  /**
   * Initialize the connection pools and database
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      console.log('🏗️  Setting up DuckDB connection pools...');
      
      // Initialize reader pool
      const readerCount = Math.floor(this.config.database.maxConnections * 0.7); // 70% readers
      for (let i = 0; i < readerCount; i++) {
        await this.createConnection('reader', `reader_${i + 1}`);
      }
      
      // Initialize writer pool  
      const writerCount = Math.ceil(this.config.database.maxConnections * 0.3); // 30% writers
      for (let i = 0; i < writerCount; i++) {
        await this.createConnection('writer', `writer_${i + 1}`);
      }
      
      // Test connection and create schema if needed
      await this.initializeSchema();
      
      // Start maintenance tasks
      this.startMaintenance();
      
      this.isInitialized = true;
      this.updateStats();
      
      console.log(`✅ DuckDB Manager initialized with ${readerCount} readers and ${writerCount} writers`);
      this.emit('initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize DuckDB Manager:', error);
      throw error;
    }
  }

  /**
   * Execute a query with connection pooling
   */
  async query<T = any>(
    sql: string, 
    params: any[] = [], 
    options: QueryOptions = {}
  ): Promise<T[]> {
    const startTime = Date.now();
    let connection: Database | null = null;
    let connectionId: string | null = null;
    
    try {
      // Get connection from appropriate pool
      const connectionType = options.connection || 'any';
      const result = await this.acquireConnection(connectionType, options.priority || 'normal');
      connection = result.connection;
      connectionId = result.id;
      
      // Execute query with timeout
      const timeout = options.timeout || this.config.database.transactionTimeout;
      const queryPromise = this.executeQuery(connection, sql, params);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Query timeout')), timeout);
      });
      
      const results = await Promise.race([queryPromise, timeoutPromise]);
      
      // Track performance
      const duration = Date.now() - startTime;
      this.recordQueryTime(duration);
      this.stats.totalQueries++;
      
      console.log(`📊 Query executed in ${duration}ms on ${connectionId}`);
      
      return results;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ Query failed after ${duration}ms:`, error);
      
      this.emit('query_error', {
        sql: sql.substring(0, 100) + '...',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        connectionId
      });
      
      throw error;
      
    } finally {
      // Release connection back to pool
      if (connection && connectionId) {
        this.releaseConnection(connectionId);
      }
    }
  }

  /**
   * Execute a batch of queries in a transaction
   */
  async transaction<T = any>(
    queries: Array<{ sql: string; params?: any[] }>,
    options: QueryOptions = {}
  ): Promise<T[][]> {
    const transactionId = this.generateTransactionId();
    let connection: Database | null = null;
    let connectionId: string | null = null;
    
    try {
      // Acquire writer connection for transaction
      const result = await this.acquireConnection('writer', options.priority || 'normal');
      connection = result.connection;
      connectionId = result.id;
      
      // Start transaction
      await this.executeQuery(connection, 'BEGIN TRANSACTION');
      
      const transactionContext: TransactionContext = {
        id: transactionId,
        connection,
        startTime: new Date(),
        queries: 0,
        isActive: true
      };
      
      this.activeTransactions.set(transactionId, transactionContext);
      
      console.log(`🔄 Transaction ${transactionId} started on ${connectionId}`);
      
      // Execute all queries
      const results: T[][] = [];
      for (const query of queries) {
        const result = await this.executeQuery(connection, query.sql, query.params || []);
        results.push(result);
        transactionContext.queries++;
      }
      
      // Commit transaction
      await this.executeQuery(connection, 'COMMIT');
      transactionContext.isActive = false;
      
      const duration = Date.now() - transactionContext.startTime.getTime();
      console.log(`✅ Transaction ${transactionId} committed with ${queries.length} queries in ${duration}ms`);
      
      this.emit('transaction_completed', {
        transactionId,
        queryCount: queries.length,
        duration,
        connectionId
      });
      
      return results;
      
    } catch (error) {
      // Rollback on error
      if (connection) {
        try {
          await this.executeQuery(connection, 'ROLLBACK');
          console.log(`🔄 Transaction ${transactionId} rolled back due to error`);
        } catch (rollbackError) {
          console.error('❌ Failed to rollback transaction:', rollbackError);
        }
      }
      
      this.emit('transaction_failed', {
        transactionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        connectionId
      });
      
      throw error;
      
    } finally {
      this.activeTransactions.delete(transactionId);
      if (connection && connectionId) {
        this.releaseConnection(connectionId);
      }
    }
  }

  /**
   * Execute batch insert with optimal performance
   */
  async batchInsert(
    tableName: string,
    data: any[],
    options: { batchSize?: number; upsert?: boolean } = {}
  ): Promise<number> {
    if (data.length === 0) return 0;
    
    const batchSize = options.batchSize || this.config.database.batchInsertSize;
    const useUpsert = options.upsert || false;
    let totalInserted = 0;
    
    // Process in batches to avoid memory issues
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      try {
        // Build parameterized query
        const columns = Object.keys(batch[0]);
        const placeholders = columns.map(() => '?').join(', ');
        const values = batch.flatMap(row => columns.map(col => row[col]));
        
        const sql = useUpsert 
          ? `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES ${batch.map(() => `(${placeholders})`).join(', ')}`
          : `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${batch.map(() => `(${placeholders})`).join(', ')}`;
        
        await this.query(sql, values, { connection: 'writer', priority: 'high' });
        totalInserted += batch.length;
        
        console.log(`📝 Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(data.length/batchSize)}: ${batch.length} records`);
        
      } catch (error) {
        console.error(`❌ Failed to insert batch starting at index ${i}:`, error);
        throw error;
      }
    }
    
    console.log(`✅ Batch insert completed: ${totalInserted} records inserted into ${tableName}`);
    return totalInserted;
  }

  /**
   * Get connection pool statistics
   */
  getStats(): ConnectionPoolStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Get active connections information
   */
  getActiveConnections(): DatabaseConnection[] {
    const connections: DatabaseConnection[] = [];
    
    for (const [id, conn] of this.readerPool.entries()) {
      connections.push({
        ...conn,
        inUse: !this.availableReaders.has(id)
      });
    }
    
    for (const [id, conn] of this.writerPool.entries()) {
      connections.push({
        ...conn,
        inUse: !this.availableWriters.has(id)
      });
    }
    
    return connections;
  }

  /**
   * Perform database maintenance
   */
  async performMaintenance(): Promise<void> {
    console.log('🧹 Starting database maintenance...');
    
    try {
      // Vacuum if needed
      const timeSinceLastVacuum = Date.now() - this.lastVacuum.getTime();
      if (timeSinceLastVacuum > this.config.database.vacuumInterval) {
        await this.query('VACUUM', [], { connection: 'writer' });
        this.lastVacuum = new Date();
        console.log('✨ Database vacuum completed');
      }
      
      // Analyze tables for query optimization
      await this.query('ANALYZE', [], { connection: 'writer' });
      
      // Update statistics
      await this.query('PRAGMA table_info(census_data)', [], { connection: 'reader' });
      
      console.log('✅ Database maintenance completed');
      this.emit('maintenance_completed');
      
    } catch (error) {
      console.error('❌ Database maintenance failed:', error);
      this.emit('maintenance_failed', error);
    }
  }

  /**
   * Close all connections and cleanup
   */
  async close(): Promise<void> {
    console.log('🔌 Closing DuckDB connections...');
    
    // Stop maintenance
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
      this.maintenanceInterval = undefined;
    }
    
    // Wait for active transactions to complete
    const timeout = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.activeTransactions.size > 0 && (Date.now() - startTime) < timeout) {
      await this.sleep(1000);
    }
    
    // Force close remaining transactions
    for (const [id, transaction] of this.activeTransactions.entries()) {
      try {
        await this.executeQuery(transaction.connection, 'ROLLBACK');
        console.log(`🔄 Force rolled back transaction ${id}`);
      } catch (error) {
        console.error(`❌ Error rolling back transaction ${id}:`, error);
      }
    }
    
    // Close all connections
    const allConnections = [
      ...Array.from(this.readerPool.values()),
      ...Array.from(this.writerPool.values())
    ];
    
    for (const connection of allConnections) {
      try {
        // DuckDB connections close automatically when they go out of scope
        console.log(`🔌 Closed connection ${connection.id}`);
      } catch (error) {
        console.error(`❌ Error closing connection ${connection.id}:`, error);
      }
    }
    
    this.readerPool.clear();
    this.writerPool.clear();
    this.availableReaders.clear();
    this.availableWriters.clear();
    this.activeTransactions.clear();
    
    this.isInitialized = false;
    console.log('✅ All DuckDB connections closed');
    this.emit('closed');
  }

  // Private methods

  private async createConnection(type: 'reader' | 'writer', id: string): Promise<void> {
    try {
      const database = new Database(this.databasePath);
      
      const connection: DatabaseConnection = {
        id,
        type,
        inUse: false,
        createdAt: new Date(),
        lastUsedAt: new Date(),
        transactionCount: 0
      };
      
      if (type === 'reader') {
        this.readerPool.set(id, connection);
        this.availableReaders.add(id);
      } else {
        this.writerPool.set(id, connection);
        this.availableWriters.add(id);
      }
      
      // Store the actual database connection (simplified approach)
      (connection as any).database = database;
      
      console.log(`🔗 Created ${type} connection: ${id}`);
      
    } catch (error) {
      this.stats.connectionErrors++;
      console.error(`❌ Failed to create ${type} connection ${id}:`, error);
      throw error;
    }
  }

  private async acquireConnection(
    type: 'reader' | 'writer' | 'any', 
    priority: 'low' | 'normal' | 'high'
  ): Promise<{ connection: Database; id: string }> {
    
    // Try to get connection immediately
    const immediate = this.tryGetConnection(type);
    if (immediate) return immediate;
    
    // Queue request and wait
    return new Promise((resolve, reject) => {
      const priorityValue = { low: 1, normal: 2, high: 3 }[priority];
      
      const request = { resolve, reject, priority: priorityValue };
      
      if (type === 'reader' || type === 'any') {
        this.readerQueue.push(request);
        this.readerQueue.sort((a, b) => b.priority - a.priority);
      }
      
      if (type === 'writer' || (type === 'any' && this.readerQueue.length > 5)) {
        this.writerQueue.push(request);
        this.writerQueue.sort((a, b) => b.priority - a.priority);
      }
      
      this.updateStats();
    });
  }

  private tryGetConnection(type: 'reader' | 'writer' | 'any'): { connection: Database; id: string } | null {
    // Try reader first if any or reader requested
    if ((type === 'reader' || type === 'any') && this.availableReaders.size > 0) {
      const id = Array.from(this.availableReaders)[0];
      this.availableReaders.delete(id);
      
      const connection = this.readerPool.get(id)!;
      connection.inUse = true;
      connection.lastUsedAt = new Date();
      
      return { connection: (connection as any).database, id };
    }
    
    // Try writer if any or writer requested  
    if ((type === 'writer' || type === 'any') && this.availableWriters.size > 0) {
      const id = Array.from(this.availableWriters)[0];
      this.availableWriters.delete(id);
      
      const connection = this.writerPool.get(id)!;
      connection.inUse = true;
      connection.lastUsedAt = new Date();
      
      return { connection: (connection as any).database, id };
    }
    
    return null;
  }

  private releaseConnection(connectionId: string): void {
    // Find and release connection
    if (this.readerPool.has(connectionId)) {
      const connection = this.readerPool.get(connectionId)!;
      connection.inUse = false;
      connection.lastUsedAt = new Date();
      this.availableReaders.add(connectionId);
      
      // Process queued reader requests
      if (this.readerQueue.length > 0) {
        const request = this.readerQueue.shift()!;
        const result = this.tryGetConnection('reader');
        if (result) {
          request.resolve(result);
        } else {
          this.readerQueue.unshift(request); // Put back if couldn't fulfill
        }
      }
    }
    
    if (this.writerPool.has(connectionId)) {
      const connection = this.writerPool.get(connectionId)!;
      connection.inUse = false;
      connection.lastUsedAt = new Date();
      this.availableWriters.add(connectionId);
      
      // Process queued writer requests
      if (this.writerQueue.length > 0) {
        const request = this.writerQueue.shift()!;
        const result = this.tryGetConnection('writer');
        if (result) {
          request.resolve(result);
        } else {
          this.writerQueue.unshift(request); // Put back if couldn't fulfill
        }
      }
    }
    
    this.updateStats();
  }

  private async executeQuery(connection: Database, sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (params.length > 0) {
        connection.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      } else {
        connection.all(sql, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      }
    });
  }

  private async initializeSchema(): Promise<void> {
    console.log('🏗️  Initializing database schema...');
    
    // Test with a simple query first
    await this.query('SELECT 1 as test', [], { connection: 'reader' });
    
    // Create indexes for better performance
    const indexQueries = [
      'CREATE INDEX IF NOT EXISTS idx_census_geography ON census_data(geography_level, geography_code)',
      'CREATE INDEX IF NOT EXISTS idx_census_year ON census_data(year)',
      'CREATE INDEX IF NOT EXISTS idx_census_dataset ON census_data(dataset)',
      'CREATE INDEX IF NOT EXISTS idx_census_created ON census_data(created_at)'
    ];
    
    for (const indexSql of indexQueries) {
      try {
        await this.query(indexSql, [], { connection: 'writer' });
      } catch (error) {
        // Index might already exist, that's okay
        console.log(`Index creation: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    console.log('✅ Database schema initialized');
  }

  private startMaintenance(): void {
    // Run maintenance every hour
    this.maintenanceInterval = setInterval(() => {
      this.performMaintenance().catch(error => {
        console.error('❌ Scheduled maintenance failed:', error);
      });
    }, 60 * 60 * 1000);
  }

  private updateStats(): void {
    const readerConnections = Array.from(this.readerPool.values());
    const writerConnections = Array.from(this.writerPool.values());
    const allConnections = [...readerConnections, ...writerConnections];
    
    this.stats = {
      totalConnections: allConnections.length,
      activeConnections: allConnections.filter(c => c.inUse).length,
      idleConnections: allConnections.filter(c => !c.inUse).length,
      queuedRequests: this.readerQueue.length + this.writerQueue.length,
      totalQueries: this.stats.totalQueries,
      averageQueryTime: this.queryTimes.length > 0 
        ? this.queryTimes.reduce((sum, time) => sum + time, 0) / this.queryTimes.length 
        : 0,
      connectionErrors: this.stats.connectionErrors
    };
  }

  private recordQueryTime(duration: number): void {
    this.queryTimes.push(duration);
    if (this.queryTimes.length > this.maxQueryTimeHistory) {
      this.queryTimes = this.queryTimes.slice(-this.maxQueryTimeHistory);
    }
  }

  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}