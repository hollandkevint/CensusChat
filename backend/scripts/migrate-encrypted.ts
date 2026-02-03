/**
 * Database Encryption Migration Script
 *
 * Migrates existing unencrypted census.duckdb to AES-256-GCM encrypted database.
 *
 * Usage:
 *   DUCKDB_ENCRYPTION_KEY=your-key npm run migrate-encrypted
 *
 * Environment Variables:
 *   DUCKDB_ENCRYPTION_KEY - Required. 32-character hex string (generate with: openssl rand -hex 16)
 *   DUCKDB_SOURCE_PATH - Optional. Source database path (default: ./data/census.duckdb)
 *   DUCKDB_DEST_PATH - Optional. Destination path (default: ./data/census-encrypted.duckdb)
 *
 * After successful migration:
 *   1. Verify the encrypted database works
 *   2. Backup the original: mv data/census.duckdb data/census.duckdb.backup
 *   3. Replace with encrypted: mv data/census-encrypted.duckdb data/census.duckdb
 *   4. Set DUCKDB_ENCRYPTION_KEY in production environment
 */

import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';
import * as fs from 'fs';
import * as path from 'path';

interface MigrationStats {
  tablesProcessed: number;
  totalRows: number;
  startTime: number;
  endTime?: number;
  tableStats: Map<string, { sourceRows: number; destRows: number }>;
}

async function getTableList(conn: DuckDBConnection, schema: string): Promise<string[]> {
  const reader = await conn.runAndReadAll(`
    SELECT table_name
    FROM ${schema}.information_schema.tables
    WHERE table_schema = 'main'
      AND table_type = 'BASE TABLE'
  `);
  const rows = reader.getRowObjects();
  return rows.map((r: { table_name: string }) => r.table_name);
}

async function getTableRowCount(conn: DuckDBConnection, schema: string, table: string): Promise<number> {
  const reader = await conn.runAndReadAll(`SELECT COUNT(*) as cnt FROM ${schema}.${table}`);
  const rows = reader.getRowObjects();
  return Number(rows[0]?.cnt || 0);
}

export async function migrateToEncrypted(
  sourcePath: string,
  destPath: string,
  encryptionKey: string
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    tablesProcessed: 0,
    totalRows: 0,
    startTime: Date.now(),
    tableStats: new Map()
  };

  console.log('=== DuckDB Encryption Migration ===');
  console.log(`Source: ${sourcePath}`);
  console.log(`Destination: ${destPath}`);
  console.log('');

  // Validate source exists
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source database not found: ${sourcePath}`);
  }

  // Validate destination doesn't exist (avoid accidental overwrite)
  if (fs.existsSync(destPath)) {
    throw new Error(`Destination already exists: ${destPath}. Remove it first to re-run migration.`);
  }

  // Create in-memory instance for migration
  const instance = await DuckDBInstance.create(':memory:');
  const conn = await instance.connect();

  try {
    // Load httpfs for hardware-accelerated encryption (uses OpenSSL instead of Mbed TLS)
    console.log('Loading httpfs extension for hardware-accelerated encryption...');
    await conn.run('INSTALL httpfs');
    await conn.run('LOAD httpfs');

    // Attach source (unencrypted)
    console.log('Attaching source database...');
    await conn.run(`ATTACH '${sourcePath}' AS source`);

    // Attach destination with encryption
    console.log('Creating encrypted destination database...');
    await conn.run(`
      ATTACH '${destPath}' AS dest (
        ENCRYPTION_KEY '${encryptionKey}',
        ENCRYPTION_CIPHER 'GCM'
      )
    `);

    // Get list of tables from source
    const tables = await getTableList(conn, 'source');
    console.log(`\nFound ${tables.length} tables to migrate:`);
    tables.forEach(t => console.log(`  - ${t}`));
    console.log('');

    // Copy all data
    console.log('Copying data to encrypted database...');
    await conn.run('COPY FROM DATABASE source TO dest');
    console.log('Copy complete.\n');

    // Verify row counts for each table
    console.log('Verifying row counts...');
    let allMatch = true;

    for (const table of tables) {
      const sourceCount = await getTableRowCount(conn, 'source', table);
      const destCount = await getTableRowCount(conn, 'dest', table);

      stats.tableStats.set(table, { sourceRows: sourceCount, destRows: destCount });
      stats.totalRows += sourceCount;
      stats.tablesProcessed++;

      if (sourceCount !== destCount) {
        console.error(`  [MISMATCH] ${table}: ${sourceCount} vs ${destCount}`);
        allMatch = false;
      } else {
        console.log(`  [OK] ${table}: ${sourceCount.toLocaleString()} rows`);
      }
    }

    if (!allMatch) {
      // Clean up failed migration
      console.error('\nRow count mismatch detected. Cleaning up...');
      conn.disconnectSync();
      instance.closeSync();
      fs.unlinkSync(destPath);
      throw new Error('Migration failed: row count mismatch between source and destination');
    }

    stats.endTime = Date.now();
    const durationSec = ((stats.endTime - stats.startTime) / 1000).toFixed(1);

    console.log('\n=== Migration Summary ===');
    console.log(`Tables migrated: ${stats.tablesProcessed}`);
    console.log(`Total rows: ${stats.totalRows.toLocaleString()}`);
    console.log(`Duration: ${durationSec} seconds`);
    console.log(`Encrypted file: ${destPath}`);
    console.log('');
    console.log('Next steps:');
    console.log('  1. Test the encrypted database works');
    console.log('  2. Backup original: mv data/census.duckdb data/census.duckdb.backup');
    console.log('  3. Replace: mv data/census-encrypted.duckdb data/census.duckdb');
    console.log('  4. Set DUCKDB_ENCRYPTION_KEY in production environment');

    return stats;

  } finally {
    conn.disconnectSync();
    instance.closeSync();
  }
}

// CLI entrypoint
async function main(): Promise<void> {
  const sourcePath = process.env.DUCKDB_SOURCE_PATH || path.join(process.cwd(), 'data', 'census.duckdb');
  const destPath = process.env.DUCKDB_DEST_PATH || path.join(process.cwd(), 'data', 'census-encrypted.duckdb');
  const encryptionKey = process.env.DUCKDB_ENCRYPTION_KEY;

  if (!encryptionKey) {
    console.error('ERROR: DUCKDB_ENCRYPTION_KEY environment variable required');
    console.error('');
    console.error('Generate a key with:');
    console.error('  openssl rand -hex 16');
    console.error('');
    console.error('Then run:');
    console.error('  DUCKDB_ENCRYPTION_KEY=your-key npm run migrate-encrypted');
    process.exit(1);
  }

  if (encryptionKey.length < 16) {
    console.error('ERROR: DUCKDB_ENCRYPTION_KEY must be at least 16 characters');
    console.error('Generate with: openssl rand -hex 16');
    process.exit(1);
  }

  try {
    await migrateToEncrypted(sourcePath, destPath, encryptionKey);
    console.log('\nMigration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('\nMigration failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
