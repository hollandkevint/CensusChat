/**
 * Regression tests for the ACS loader vintage-refresh semantics.
 *
 * These import the real helpers the loaders use (src/utils/loaderRefresh.ts),
 * so reverting a loader to a bare `DELETE` fails these tests rather than
 * merely disagreeing with a comment.
 *
 * Two failure modes are pinned:
 *  - ON CONFLICT DO NOTHING silently no-ops a refresh on a populated table.
 *  - A naive clear-then-load destroys the table when the load then fails.
 */

import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';
import { replaceAll, createDeferredClear } from '../../utils/loaderRefresh';

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
    // Pre-existing old-vintage rows
    await conn.run("INSERT INTO demo_data VALUES ('A', 100), ('B', 200)");
  });

  afterEach(() => {
    conn.closeSync();
    instance.closeSync();
  });

  it('demonstrates the bug: ON CONFLICT DO NOTHING no-ops on a populated table', async () => {
    await conn.run("INSERT INTO demo_data VALUES ('A', 999) ON CONFLICT (geoid) DO NOTHING");

    // The new vintage never lands.
    expect((await rowsByGeoid(conn))['A']).toBe(100);
  });

  describe('replaceAll (non-resumable loaders: county, state)', () => {
    it('replaces old-vintage values with the new vintage', async () => {
      await replaceAll(conn, 'demo_data', async () => {
        await conn.run("INSERT INTO demo_data VALUES ('A', 999), ('B', 888)");
      });

      expect(await rowsByGeoid(conn)).toEqual({ A: 999, B: 888 });
    });

    it('rolls back to the previous vintage when the load fails', async () => {
      // This is the blocker a bare DELETE-then-INSERT introduces: a failure
      // part-way through must not leave the table empty.
      await expect(
        replaceAll(conn, 'demo_data', async () => {
          await conn.run("INSERT INTO demo_data VALUES ('A', 999)");
          throw new Error('Census parse error');
        })
      ).rejects.toThrow('Census parse error');

      expect(await rowsByGeoid(conn)).toEqual({ A: 100, B: 200 });
    });
  });

  describe('createDeferredClear (resumable loaders: tract, block group)', () => {
    it('does not clear before data arrives', async () => {
      const clear = createDeferredClear(conn, 'demo_data', true);

      // First state's fetch came back empty (API down, key rejected).
      expect(await clear(0)).toBe(false);
      expect(await rowsByGeoid(conn)).toEqual({ A: 100, B: 200 });
    });

    it('clears exactly once, on the first fetch that returns rows', async () => {
      const clear = createDeferredClear(conn, 'demo_data', true);

      expect(await clear(0)).toBe(false);
      expect(await clear(5)).toBe(true);
      await conn.run("INSERT INTO demo_data VALUES ('A', 999)");

      // A later state must not wipe the states already loaded this run.
      expect(await clear(5)).toBe(false);
      expect(await rowsByGeoid(conn)).toEqual({ A: 999 });
    });

    it('resume-safe: never clears when the run is not fresh', async () => {
      const clear = createDeferredClear(conn, 'demo_data', false);

      expect(await clear(5)).toBe(false);

      await conn.run("INSERT INTO demo_data VALUES ('C', 300) ON CONFLICT (geoid) DO NOTHING");
      expect(await rowsByGeoid(conn)).toEqual({ A: 100, B: 200, C: 300 });
    });
  });
});
