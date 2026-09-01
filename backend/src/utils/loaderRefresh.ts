/**
 * Vintage-refresh helpers shared by the ACS loaders under backend/scripts/.
 *
 * The loaders insert with `ON CONFLICT (geoid) DO NOTHING`. Run against an
 * already-populated table that clause silently skips every existing geoid, so a
 * vintage refresh becomes a no-op. The fix is to clear the table first — but a
 * naive `DELETE` introduces a worse failure than the one it fixes: if the load
 * then fails, the table is left empty. These two helpers make the clear safe.
 */

import type { DuckDBConnection } from '@duckdb/node-api';

/**
 * Replace a table's whole contents atomically.
 *
 * The `DELETE` and the inserts run in ONE transaction, so a failure anywhere in
 * `insert` rolls back to the pre-load rows instead of leaving the table empty.
 * Use this for the non-resumable loaders, which load everything in one shot.
 */
export async function replaceAll(
  conn: DuckDBConnection,
  table: string,
  insert: () => Promise<void>
): Promise<void> {
  await conn.run('BEGIN TRANSACTION');
  try {
    await conn.run(`DELETE FROM ${table}`);
    await insert();
    await conn.run('COMMIT');
  } catch (error) {
    await conn.run('ROLLBACK');
    throw error;
  }
}

/**
 * Build a clear that fires at most once, and only after real data has arrived.
 *
 * The resumable loaders (tract, block group) stream state by state over 2-3
 * hours, so they cannot hold the whole load in one transaction. Clearing up
 * front means a rejected API key empties a 239k-row table and leaves it empty.
 * Deferring the clear until the first fetch actually returns rows means a
 * failed run leaves the previous vintage untouched.
 *
 * `enabled` is the fresh-run gate: on a resumed run the clear must never fire,
 * or it would wipe the states already loaded.
 */
export function createDeferredClear(
  conn: DuckDBConnection,
  table: string,
  enabled: boolean
): (fetchedRows: number) => Promise<boolean> {
  let cleared = false;

  return async (fetchedRows: number): Promise<boolean> => {
    if (!enabled || cleared || fetchedRows <= 0) {
      return false;
    }
    await conn.run(`DELETE FROM ${table}`);
    cleared = true;
    return true;
  };
}
