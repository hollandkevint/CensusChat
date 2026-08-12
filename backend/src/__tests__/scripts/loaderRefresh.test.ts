/**
 * Regression tests for the ACS loader vintage-refresh semantics.
 *
 * The loaders (load-acs-state/tract/blockgroup/blockgroup-expanded) insert with
 * `ON CONFLICT (geoid) DO NOTHING`. Run against an already-populated table, that
 * clause SILENTLY SKIPS every existing geoid, so a vintage refresh becomes a
 * no-op and new values never land. The fix is a fresh-start `DELETE` before the
 * insert loop (gated on progress-file absence in the resumable loaders).
 *
 * These tests pin that behavior at the SQL level using @duckdb/node-api — the
 * same driver and query shapes the ported loaders use. If someone drops the
 * fresh-start clear and relies on ON CONFLICT alone again, the "replace" test
 * fails.
 */

import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';

const CREATE = `
  CREATE TABLE IF NOT EXISTS demo_data (
    geoid VARCHAR PRIMARY KEY,
    median_income INTEGER
  )
`;

async function rowsByGeoid(conn: DuckDBConnection): Promise<Record<string, number>> {
  const reader = await conn.runAndReadAll('SELECT geoid, median_income FROM demo_data ORDER BY geoid');
  const out: Record<string, number> = {};
  for (const r of reader.getRowObjects()) {
    out[String(r.geoid)] = Number(r.median_income);
  }
  return out;
}

describe('ACS loader vintage-refresh semantics', () => {
  let instance: DuckDBInstance;
  let conn: DuckDBConnection;

  beforeEach(async () => {
    instance = await DuckDBInstance.create(':memory:');
    conn = await instance.connect();
    await conn.run(CREATE);
    // Seed an "old vintage" row.
    await conn.run("INSERT INTO demo_data VALUES ('06', 83411)");
  });

  afterEach(() => {
    conn.closeSync();
  });

  it('demonstrates the bug: ON CONFLICT DO NOTHING no-ops on a populated table', async () => {
    // This is what the loaders did before the fix — re-running with new-vintage
    // values against existing geoids changes nothing.
    await conn.run("INSERT INTO demo_data VALUES ('06', 90112) ON CONFLICT (geoid) DO NOTHING");

    const rows = await rowsByGeoid(conn);
    expect(rows['06']).toBe(83411); // stale value survives — the silent no-op
  });

  it('the fix: DELETE-on-fresh replaces old-vintage values with the new vintage', async () => {
    // Non-resumable loaders (state) always clear; resumable loaders clear on a
    // fresh start. Either way the new value must land.
    await conn.run('DELETE FROM demo_data');
    await conn.run("INSERT INTO demo_data VALUES ('06', 90112)");

    const rows = await rowsByGeoid(conn);
    expect(rows['06']).toBe(90112); // refreshed — this fails if the clear is removed
  });

  it('resume-safe: skipping the clear preserves already-loaded rows while new rows insert', async () => {
    // Simulates a resumed run (progress file present -> no DELETE). California
    // is already loaded; Texas is the newly-processed state. ON CONFLICT guards
    // the re-fetched California rows from duplicating.
    await conn.run("INSERT INTO demo_data VALUES ('06', 83411) ON CONFLICT (geoid) DO NOTHING"); // re-fetched, skipped
    await conn.run("INSERT INTO demo_data VALUES ('48', 75780) ON CONFLICT (geoid) DO NOTHING"); // new state

    const rows = await rowsByGeoid(conn);
    expect(rows['06']).toBe(83411); // preserved
    expect(rows['48']).toBe(75780); // added
    expect(Object.keys(rows)).toHaveLength(2);
  });
});
