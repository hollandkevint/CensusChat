/**
 * The vintage shown to users must come from the DATA, not from the constant the
 * code targets. Bumping ACS_VINTAGE_LABEL must not make the API claim a vintage
 * the shipped database does not hold.
 */

import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';
import { recordVintage, getLoadedVintageLabel, resetVintageCache } from '../../utils/dataVintage';
import { ACS_VINTAGE_LABEL } from '../../config/censusVintage';

describe('data vintage tracking', () => {
  let instance: DuckDBInstance;
  let conn: DuckDBConnection;
  const query = async (sql: string) => {
    const reader = await conn.runAndReadAll(sql);
    return reader.getRowObjects() as Array<Record<string, unknown>>;
  };

  beforeEach(async () => {
    instance = await DuckDBInstance.create(':memory:');
    conn = await instance.connect();
    resetVintageCache();
  });

  afterEach(() => {
    conn.closeSync();
    instance.closeSync();
    resetVintageCache();
  });

  it('claims no vintage when no loader has stamped the database', async () => {
    // An unstamped DB predates this tracking. Asserting a year here is the bug.
    await expect(getLoadedVintageLabel(query)).resolves.toBeNull();
  });

  it('reports the vintage a loader actually wrote', async () => {
    await conn.run('CREATE TABLE county_data (geoid VARCHAR)');
    await recordVintage(conn, 'county_data', 3144);

    await expect(getLoadedVintageLabel(query)).resolves.toBe(ACS_VINTAGE_LABEL);
  });

  it('caches per table, so one table\'s vintage never stands in for another', async () => {
    await recordVintage(conn, 'state_data', 51);

    // county_data was never stamped: unknown, and it must stay unknown even
    // though state_data has an answer sitting in the cache.
    await expect(getLoadedVintageLabel(query, 'county_data')).resolves.toBeNull();
    await expect(getLoadedVintageLabel(query, 'state_data')).resolves.toBe(ACS_VINTAGE_LABEL);
    await expect(getLoadedVintageLabel(query, 'county_data')).resolves.toBeNull();
  });

  it('re-stamping a table replaces the previous row rather than duplicating it', async () => {
    await recordVintage(conn, 'county_data', 3144);
    await recordVintage(conn, 'county_data', 3200);

    const rows = await query("SELECT row_count FROM data_vintage WHERE table_name = 'county_data'");
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].row_count)).toBe(3200);
  });
});
