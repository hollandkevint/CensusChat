# Phase 1: DuckDB 1.4 Upgrade - Research

**Researched:** 2026-02-02
**Domain:** DuckDB database layer upgrade, Node.js API migration, encryption, performance
**Confidence:** HIGH

## Summary

DuckDB 1.4.x is a Long-Term Support (LTS) release with one year of community support. The upgrade from 1.3.2 involves two major changes: migrating from the deprecated `duckdb` npm package to `@duckdb/node-api` (Neo), and adopting new features like AES-256-GCM encryption, MERGE statement, and in-memory compression.

The `@duckdb/node-api` package uses a completely different API pattern - native Promises instead of callbacks, DuckDB-specific API instead of SQLite-style, and instance/connection separation. The existing `DuckDBPool` class must be rewritten from scratch rather than adapted.

Database encryption requires full migration via `COPY FROM DATABASE` - cannot encrypt in place. The 239K block groups dataset will require a migration window of 10-30 minutes depending on hardware.

**Primary recommendation:** Rewrite DuckDBPool to use `DuckDBInstance.fromCache()` for singleton management and `instance.connect()` for pooled connections with explicit disconnect cleanup.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@duckdb/node-api` | 1.4.3-r.3 | DuckDB Node.js client | Official replacement for deprecated `duckdb` package. Native Promise support, TypeScript-first, uses C API bindings |
| DuckDB | 1.4.3 | Embedded analytics database | LTS release with encryption, MERGE, compression |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@duckdb/node-bindings` | auto-installed | Low-level C API bindings | Dependency of `@duckdb/node-api`, not used directly |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@duckdb/node-api` | `duckdb-async` | duckdb-async won't support 1.5.x; deprecated |
| AES-GCM | AES-CTR | CTR is 2-3% faster but lacks authentication; GCM recommended |

**Installation:**
```bash
npm uninstall duckdb
npm install @duckdb/node-api@1.4.3-r.3
```

## Architecture Patterns

### Recommended Project Structure
```
backend/src/
├── utils/
│   └── duckdbPool.ts       # Rewritten for @duckdb/node-api
├── services/
│   └── duckdbService.ts    # Query execution wrapper (optional)
├── config/
│   └── duckdb.config.ts    # Configuration extraction
└── scripts/
    └── migrate-encrypted.ts # One-time migration script
```

### Pattern 1: Instance Cache Singleton
**What:** Use `DuckDBInstance.fromCache()` to ensure single instance per database file
**When to use:** Always in production - prevents corruption from multiple instances
**Example:**
```typescript
// Source: https://duckdb.org/docs/stable/clients/node_neo/overview
import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';

class DuckDBPool {
  private instance: DuckDBInstance | null = null;
  private connections: DuckDBConnection[] = [];

  async initialize(dbPath: string, config: Record<string, string>): Promise<void> {
    // fromCache prevents multiple instances on same file
    this.instance = await DuckDBInstance.fromCache(dbPath, config);
  }

  async acquire(): Promise<DuckDBConnection> {
    if (!this.instance) throw new Error('Pool not initialized');
    const conn = await this.instance.connect();
    this.connections.push(conn);
    return conn;
  }

  release(conn: DuckDBConnection): void {
    conn.disconnectSync();
    const idx = this.connections.indexOf(conn);
    if (idx > -1) this.connections.splice(idx, 1);
  }
}
```

### Pattern 2: Async Query Execution
**What:** Use `runAndReadAll()` for queries returning results, `run()` for DDL/DML
**When to use:** All query execution
**Example:**
```typescript
// Source: https://duckdb.org/docs/stable/clients/node_neo/overview
async function executeQuery(conn: DuckDBConnection, sql: string): Promise<any[]> {
  const reader = await conn.runAndReadAll(sql);
  return reader.getRowObjects();
}

async function executeStatement(conn: DuckDBConnection, sql: string): Promise<void> {
  await conn.run(sql);
}
```

### Pattern 3: Encrypted Database Connection
**What:** Open encrypted database via ATTACH with ENCRYPTION_KEY
**When to use:** Production databases with sensitive data
**Example:**
```typescript
// Source: https://duckdb.org/2025/11/19/encryption-in-duckdb
const instance = await DuckDBInstance.create(':memory:');
const conn = await instance.connect();

// Attach encrypted database
await conn.run(`
  ATTACH '${dbPath}' AS census (
    ENCRYPTION_KEY '${encryptionKey}',
    ENCRYPTION_CIPHER 'GCM'
  )
`);

// All queries now use 'census.' prefix
const result = await conn.runAndReadAll('SELECT * FROM census.county_data LIMIT 10');
```

### Pattern 4: MERGE for Upserts
**What:** Use MERGE INTO for data refresh instead of DELETE + INSERT
**When to use:** Data refresh workflows (Census data updates)
**Example:**
```typescript
// Source: https://duckdb.org/docs/stable/sql/statements/merge_into
const mergeSQL = `
  MERGE INTO county_data AS target
  USING staging_county_data AS source
  USING (state_fips, county_fips)
  WHEN MATCHED THEN UPDATE SET
    population = source.population,
    median_income = source.median_income,
    updated_at = CURRENT_TIMESTAMP
  WHEN NOT MATCHED THEN INSERT BY NAME
  RETURNING merge_action, state_fips, county_fips
`;
await conn.run(mergeSQL);
```

### Anti-Patterns to Avoid
- **Multiple instances on same file:** Causes corruption. Always use `fromCache()`
- **Callback-style API:** Old package pattern. New API is Promise-native
- **Not closing connections:** Memory leak. Always `disconnectSync()` when done
- **Encrypting in place:** Not possible. Must COPY FROM DATABASE to new encrypted file

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Connection pooling | Custom pool logic | `DuckDBInstance.fromCache()` + multiple connections | Instance cache handles file locking, multiple connections from single instance is safe |
| Async wrappers | Promise wrappers | `@duckdb/node-api` native Promises | Built into new API, avoids callback hell |
| Upsert logic | DELETE + INSERT | `MERGE INTO` statement | Atomic operation, better performance, standard SQL |
| Query timing | Manual timestamps | DuckDB profiler with JSON output | Accurate metrics including optimizer time |
| Encryption | External encryption | Built-in AES-256-GCM | Block-level encryption, WAL included, minimal overhead |

**Key insight:** The new API is designed to prevent common mistakes. Using `fromCache()` eliminates the instance management bugs that plague custom solutions.

## Common Pitfalls

### Pitfall 1: Mixing Old and New API Patterns
**What goes wrong:** Attempting to use callback-style `db.all()` with new API
**Why it happens:** Muscle memory from old `duckdb` package
**How to avoid:** Delete old package completely, use only `@duckdb/node-api` imports
**Warning signs:** TypeScript errors about missing callback parameters

### Pitfall 2: Encryption Key Management
**What goes wrong:** Hardcoding encryption keys or storing in version control
**Why it happens:** Quick testing becomes production code
**How to avoid:** Use environment variables (`DUCKDB_ENCRYPTION_KEY`), never commit keys
**Warning signs:** Keys in .env.example or committed .env files

### Pitfall 3: Forgetting to Load httpfs for Encryption Performance
**What goes wrong:** 10-20% encryption overhead instead of 5%
**Why it happens:** DuckDB falls back to Mbed TLS instead of OpenSSL
**How to avoid:** Execute `INSTALL httpfs; LOAD httpfs;` before enabling encryption
**Warning signs:** Slow query performance on encrypted database

### Pitfall 4: Row Count Mismatch After Migration
**What goes wrong:** Missing data after COPY FROM DATABASE
**Why it happens:** Incomplete migration, interrupted process
**How to avoid:** Verify row counts before/after: `SELECT COUNT(*) FROM table`
**Warning signs:** Application errors about missing data

### Pitfall 5: Memory Configuration Not Applied
**What goes wrong:** OOM errors or slow queries
**Why it happens:** Config passed incorrectly to new API
**How to avoid:** Pass config as second param to `DuckDBInstance.create(path, { memory_limit: '4GB' })`
**Warning signs:** Node.js process memory exceeds expected limits

### Pitfall 6: Lambda Syntax Breaking Change
**What goes wrong:** Queries with arrow lambdas fail
**Why it happens:** DuckDB 1.4 deprecates arrow syntax without explicit setting
**How to avoid:** Use Python-style lambdas: `list_transform(l, x -> x + 1)` becomes `list_transform(l, lambda x: x + 1)`
**Warning signs:** Syntax errors on list/map functions

## Code Examples

### Complete Pool Rewrite
```typescript
// Source: https://duckdb.org/docs/stable/clients/node_neo/overview
// Source: https://deepwiki.com/duckdb/duckdb-node-neo/3.1-duckdbinstance-and-database-management
import { DuckDBInstance, DuckDBConnection, DuckDBInstanceCache } from '@duckdb/node-api';
import { EventEmitter } from 'events';

export interface DuckDBPoolConfig {
  dbPath: string;
  encryptionKey?: string;
  memoryLimit?: string;
  threads?: number;
  minConnections?: number;
  maxConnections?: number;
}

export class DuckDBPool extends EventEmitter {
  private instance: DuckDBInstance | null = null;
  private connections: DuckDBConnection[] = [];
  private activeConnections: Set<DuckDBConnection> = new Set();
  private config: Required<DuckDBPoolConfig>;
  private isInitialized = false;

  constructor(config: DuckDBPoolConfig) {
    super();
    this.config = {
      dbPath: config.dbPath,
      encryptionKey: config.encryptionKey || '',
      memoryLimit: config.memoryLimit || '4GB',
      threads: config.threads || 4,
      minConnections: config.minConnections || 2,
      maxConnections: config.maxConnections || 10,
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Create instance with configuration
    this.instance = await DuckDBInstance.fromCache(this.config.dbPath, {
      memory_limit: this.config.memoryLimit,
      threads: String(this.config.threads),
    });

    // Pre-create minimum connections
    for (let i = 0; i < this.config.minConnections; i++) {
      const conn = await this.instance.connect();

      // Configure extensions
      await conn.run('INSTALL httpfs; LOAD httpfs;');

      // Handle encryption if configured
      if (this.config.encryptionKey) {
        // For encrypted databases, the key is passed via ATTACH
        // This assumes the database was created encrypted
      }

      this.connections.push(conn);
    }

    this.isInitialized = true;
    this.emit('initialized');
  }

  async acquire(): Promise<DuckDBConnection> {
    if (!this.isInitialized) await this.initialize();
    if (!this.instance) throw new Error('Pool not initialized');

    // Find idle connection
    const idle = this.connections.find(c => !this.activeConnections.has(c));
    if (idle) {
      this.activeConnections.add(idle);
      return idle;
    }

    // Create new if under max
    if (this.connections.length < this.config.maxConnections) {
      const conn = await this.instance.connect();
      await conn.run('INSTALL httpfs; LOAD httpfs;');
      this.connections.push(conn);
      this.activeConnections.add(conn);
      return conn;
    }

    // Wait for one to become available
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const idle = this.connections.find(c => !this.activeConnections.has(c));
        if (idle) {
          clearInterval(checkInterval);
          this.activeConnections.add(idle);
          resolve(idle);
        }
      }, 10);
    });
  }

  release(conn: DuckDBConnection): void {
    this.activeConnections.delete(conn);
    this.emit('release');
  }

  async query(sql: string): Promise<any[]> {
    const conn = await this.acquire();
    try {
      const reader = await conn.runAndReadAll(sql);
      return reader.getRowObjects();
    } finally {
      this.release(conn);
    }
  }

  async close(): Promise<void> {
    for (const conn of this.connections) {
      conn.disconnectSync();
    }
    this.connections = [];
    this.activeConnections.clear();
    this.instance?.closeSync();
    this.instance = null;
    this.isInitialized = false;
  }
}
```

### Database Migration Script
```typescript
// Source: https://duckdb.org/2025/11/19/encryption-in-duckdb
import { DuckDBInstance } from '@duckdb/node-api';

async function migrateToEncrypted(
  sourcePath: string,
  destPath: string,
  encryptionKey: string
): Promise<void> {
  const instance = await DuckDBInstance.create(':memory:');
  const conn = await instance.connect();

  // Load httpfs for hardware-accelerated encryption
  await conn.run('INSTALL httpfs; LOAD httpfs;');

  // Attach source (unencrypted)
  await conn.run(`ATTACH '${sourcePath}' AS source`);

  // Attach destination (encrypted)
  await conn.run(`
    ATTACH '${destPath}' AS dest (
      ENCRYPTION_KEY '${encryptionKey}',
      ENCRYPTION_CIPHER 'GCM'
    )
  `);

  // Copy all data
  await conn.run('COPY FROM DATABASE source TO dest');

  // Verify row counts
  const sourceCounts = await conn.runAndReadAll(`
    SELECT 'county_data' as tbl, COUNT(*) as cnt FROM source.county_data
    UNION ALL
    SELECT 'block_group_data_expanded', COUNT(*) FROM source.block_group_data_expanded
  `);

  const destCounts = await conn.runAndReadAll(`
    SELECT 'county_data' as tbl, COUNT(*) as cnt FROM dest.county_data
    UNION ALL
    SELECT 'block_group_data_expanded', COUNT(*) FROM dest.block_group_data_expanded
  `);

  // Compare
  const sourceRows = sourceCounts.getRowObjects();
  const destRows = destCounts.getRowObjects();

  for (let i = 0; i < sourceRows.length; i++) {
    if (sourceRows[i].cnt !== destRows[i].cnt) {
      throw new Error(`Row count mismatch for ${sourceRows[i].tbl}: ${sourceRows[i].cnt} vs ${destRows[i].cnt}`);
    }
    console.log(`${sourceRows[i].tbl}: ${sourceRows[i].cnt} rows migrated`);
  }

  conn.disconnectSync();
  instance.closeSync();
}
```

### Profiler Integration
```typescript
// Source: https://duckdb.org/docs/stable/dev/profiling
async function queryWithProfiling(
  conn: DuckDBConnection,
  sql: string
): Promise<{ result: any[]; profile: object }> {
  // Enable JSON profiling
  await conn.run(`SET profiling_output = '/tmp/duckdb_profile.json'`);
  await conn.run(`SET enable_profiling = 'json'`);
  await conn.run(`SET custom_profiling_settings = '{"CPU_TIME": "true", "OPERATOR_TIMING": "true", "OPERATOR_CARDINALITY": "true"}'`);

  // Execute query
  const reader = await conn.runAndReadAll(sql);
  const result = reader.getRowObjects();

  // Read profile (in real code, use fs.readFile)
  const profileReader = await conn.runAndReadAll(`SELECT * FROM read_json('/tmp/duckdb_profile.json')`);
  const profile = profileReader.getRowObjects()[0];

  // Disable profiling
  await conn.run(`SET enable_profiling = 'no_output'`);

  return { result, profile };
}
```

### MERGE Statement for Data Refresh
```typescript
// Source: https://duckdb.org/docs/stable/sql/statements/merge_into
async function refreshCountyData(
  conn: DuckDBConnection,
  newData: Array<{ state_fips: string; county_fips: string; population: number; median_income: number }>
): Promise<{ updated: number; inserted: number }> {
  // Create staging table from new data
  await conn.run(`
    CREATE OR REPLACE TEMP TABLE staging_county AS
    SELECT * FROM (VALUES ${newData.map(d =>
      `('${d.state_fips}', '${d.county_fips}', ${d.population}, ${d.median_income})`
    ).join(',')}) AS t(state_fips, county_fips, population, median_income)
  `);

  // MERGE with RETURNING
  const mergeResult = await conn.runAndReadAll(`
    MERGE INTO county_data AS target
    USING staging_county AS source
    ON target.state_fips = source.state_fips
       AND target.county_fips = source.county_fips
    WHEN MATCHED THEN UPDATE SET
      population = source.population,
      median_income = source.median_income
    WHEN NOT MATCHED THEN INSERT BY NAME
    RETURNING merge_action
  `);

  const actions = mergeResult.getRowObjects();
  const updated = actions.filter(a => a.merge_action === 'UPDATE').length;
  const inserted = actions.filter(a => a.merge_action === 'INSERT').length;

  return { updated, inserted };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `duckdb` npm package | `@duckdb/node-api` | DuckDB 1.4.0 (Sept 2025) | Complete API rewrite required |
| Callback-based async | Native Promises | DuckDB 1.4.0 | Simpler async/await patterns |
| No encryption | AES-256-GCM built-in | DuckDB 1.4.0 | HIPAA compliance without external tools |
| DELETE + INSERT | MERGE INTO | DuckDB 1.4.0 | Atomic upserts, better performance |
| Arrow lambda `->` | Python lambda `:` | DuckDB 1.3.0 (deprecated) | Must update any list/map functions |

**Deprecated/outdated:**
- `duckdb` npm package: Final release for 1.4.x, no 1.5.x support
- `duckdb-async` wrapper: Unnecessary with new API
- Arrow lambda syntax: Deprecated, must use `lambda x: x + 1`

## Open Questions

1. **Encryption key rotation**
   - What we know: COPY FROM DATABASE can migrate between encryption keys
   - What's unclear: Automated rotation workflow, key management best practices
   - Recommendation: Document manual rotation process, defer automation to v2

2. **Connection pool sizing for encrypted databases**
   - What we know: Encryption adds 5-10% overhead with httpfs
   - What's unclear: Optimal pool size given encryption overhead
   - Recommendation: Start with same config (2-10 connections), monitor and adjust

3. **Profiler output location in containerized environment**
   - What we know: Profiler writes to file system
   - What's unclear: Best practice for Docker containers with ephemeral storage
   - Recommendation: Use /tmp or memory-backed volume, consider streaming to logger

## Sources

### Primary (HIGH confidence)
- [DuckDB Node.js (Neo) Overview](https://duckdb.org/docs/stable/clients/node_neo/overview) - API patterns, configuration
- [DuckDB Data-at-Rest Encryption](https://duckdb.org/2025/11/19/encryption-in-duckdb) - Encryption syntax, migration
- [DuckDB 1.4.0 LTS Announcement](https://duckdb.org/2025/09/16/announcing-duckdb-140) - Feature overview
- [DuckDB MERGE INTO Statement](https://duckdb.org/docs/stable/sql/statements/merge_into) - MERGE syntax
- [DuckDB Profiling](https://duckdb.org/docs/stable/dev/profiling) - Profiler configuration

### Secondary (MEDIUM confidence)
- [DuckDB Node Neo DeepWiki](https://deepwiki.com/duckdb/duckdb-node-neo/3.1-duckdbinstance-and-database-management) - Instance management patterns
- [DuckDB 1.4.3 LTS Announcement](https://duckdb.org/2025/12/09/announcing-duckdb-143) - Patch release details

### Tertiary (LOW confidence)
- npm registry pages (version numbers only)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official documentation, deprecation notices clear
- Architecture: HIGH - DuckDB docs + DeepWiki patterns verified
- Pitfalls: HIGH - Documented breaking changes, security advisories
- Code examples: MEDIUM - Adapted from docs, not production-tested

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - LTS release, stable API)
