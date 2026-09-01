/**
 * Records and reads the ACS vintage that is actually loaded in the database.
 *
 * `config/censusVintage.ts` states which vintage the CODE targets. That is a
 * compile-time constant: it says nothing about what is in the DB. Labelling
 * query results from it asserts "ACS 2024" the moment the constant is bumped,
 * while the shipped database may still hold the previous vintage until the
 * multi-hour reload actually runs. This module closes that gap — each loader
 * stamps the vintage it wrote, and the query path reports what it finds.
 *
 * Two rules keep the stamp honest:
 *  - A loader only stamps a COMPLETE load. A run that dies part-way leaves the
 *    table unstamped, so the API claims no vintage rather than a false one.
 *  - A query is labelled only when every table it reads is stamped AND the
 *    stamps agree. A DB where county_data was reloaded but the block groups
 *    were not labels nothing, instead of labelling stale rows with a new year.
 */

import type { DuckDBConnection } from '@duckdb/node-api';
import { ACS_VINTAGE_LABEL, ACS_VINTAGE_YEAR } from '../config/censusVintage';
import { censusChatSecurityPolicy } from '../validation/sqlSecurityPolicies';

export const VINTAGE_TABLE = 'data_vintage';

/** How long a read of `data_vintage` is trusted before it is re-read. */
export const VINTAGE_CACHE_TTL_MS = 60_000;

export type VintageQuery = (sql: string) => Promise<Array<Record<string, unknown>>>;

/**
 * Stamp the vintage a loader just wrote for one table.
 *
 * Call this ONLY after a complete load. A partial stamp is worse than none: it
 * asserts a completeness the table does not have, which is the exact failure
 * the stamping exists to prevent.
 *
 * Pass the same connection inside the load's transaction where possible, so the
 * stamp commits atomically with the rows it describes.
 */
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
 * Every stamped table, cached briefly.
 *
 * The TTL matters: the loaders are separate processes writing the same DB file,
 * so a refresh against a running server is exactly when a permanently-memoised
 * value goes wrong. A short window keeps the per-query cost near zero without
 * pinning a stale answer until restart.
 */
let stamps: Map<string, string> | null = null;
let stampsReadAt = 0;

async function loadStamps(query: VintageQuery): Promise<Map<string, string>> {
  if (stamps && Date.now() - stampsReadAt < VINTAGE_CACHE_TTL_MS) {
    return stamps;
  }

  const fresh = new Map<string, string>();
  try {
    const rows = await query(`SELECT table_name, vintage_label FROM ${VINTAGE_TABLE}`);
    for (const row of rows) {
      fresh.set(String(row.table_name).toLowerCase(), String(row.vintage_label));
    }
  } catch {
    // Table absent (no stamping loader has run) — nothing is known.
  }

  stamps = fresh;
  stampsReadAt = Date.now();
  return fresh;
}

/** Tables a query may read, per the SQL validator's allowlist. */
function tablesReferencedBy(sql: string): string[] {
  return censusChatSecurityPolicy.allowedTables.filter((table) =>
    new RegExp(`\\b${table}\\b`, 'i').test(sql)
  );
}

/**
 * The vintage label to show for one query's results, read from the data itself.
 *
 * Returns null — meaning "claim no vintage" — when the query reads a table no
 * loader has stamped, or when the tables it reads carry different vintages.
 * Both cases are states where naming a single year would be a false claim.
 */
export async function getVintageLabelForQuery(
  query: VintageQuery,
  sql: string
): Promise<string | null> {
  const tables = tablesReferencedBy(sql);
  if (tables.length === 0) {
    return null;
  }

  const known = await loadStamps(query);
  const labels = tables.map((table) => known.get(table));

  // An unstamped table means an unknown (possibly older) vintage.
  if (labels.some((label) => label === undefined)) {
    return null;
  }

  // Mixed vintages across the joined tables: no single year is true of the row set.
  return labels.every((label) => label === labels[0]) ? labels[0]! : null;
}

/** Test seam, and the hook for the data-refresh path to force a re-read. */
export function resetVintageCache(): void {
  stamps = null;
  stampsReadAt = 0;
}
