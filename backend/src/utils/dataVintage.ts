/**
 * Records and reads the ACS vintage that is actually loaded in the database.
 *
 * `config/censusVintage.ts` states which vintage the CODE targets. That is a
 * compile-time constant: it says nothing about what is in the DB. Labelling
 * query results from it asserts "ACS 2024" the moment the constant is bumped,
 * while the shipped database may still hold the previous vintage until the
 * multi-hour reload actually runs. This module closes that gap — each loader
 * stamps the vintage it wrote, and the query path reports what it finds.
 */

import type { DuckDBConnection } from '@duckdb/node-api';
import { ACS_VINTAGE_LABEL, ACS_VINTAGE_YEAR } from '../config/censusVintage';

export const VINTAGE_TABLE = 'data_vintage';

/** Stamp the vintage a loader just wrote for one table. */
export async function recordVintage(
  conn: DuckDBConnection,
  table: string,
  rowCount: number
): Promise<void> {
  await conn.run(`
    CREATE TABLE IF NOT EXISTS ${VINTAGE_TABLE} (
      table_name VARCHAR PRIMARY KEY,
      vintage_label VARCHAR NOT NULL,
      vintage_year INTEGER NOT NULL,
      row_count BIGINT NOT NULL,
      loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await conn.run(`DELETE FROM ${VINTAGE_TABLE} WHERE table_name = ?`, [table]);
  await conn.run(
    `INSERT INTO ${VINTAGE_TABLE} (table_name, vintage_label, vintage_year, row_count)
     VALUES (?, ?, ?, ?)`,
    [table, ACS_VINTAGE_LABEL, ACS_VINTAGE_YEAR, rowCount]
  );
}

/**
 * The vintage label to show for query results, read from the data itself.
 *
 * Returns null when no loader has stamped the table — an unstamped database
 * predates this tracking, so its vintage is genuinely unknown and callers must
 * not claim one. Cached: the value only changes when a loader reruns.
 */
const cache = new Map<string, string | null>();

export async function getLoadedVintageLabel(
  query: (sql: string) => Promise<Array<Record<string, unknown>>>,
  table = 'county_data'
): Promise<string | null> {
  const hit = cache.get(table);
  if (hit !== undefined) {
    return hit;
  }

  let label: string | null;
  try {
    const rows = await query(
      `SELECT vintage_label FROM ${VINTAGE_TABLE} WHERE table_name = '${table}'`
    );
    label = rows.length > 0 ? String(rows[0].vintage_label) : null;
  } catch {
    // Table absent (never loaded by a stamping loader) — vintage unknown.
    label = null;
  }

  cache.set(table, label);
  return label;
}

/** Test seam: drop the memoised values. */
export function resetVintageCache(): void {
  cache.clear();
}
