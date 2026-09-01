/**
 * The vintage shown to users must be true of the rows actually returned.
 *
 * Two ways it can lie, both pinned here:
 *  - stamping a partial load, so the label asserts a completeness the table
 *    does not have;
 *  - labelling a query from one table's stamp when it reads another table that
 *    was never reloaded.
 */

import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';
import {
  recordVintage,
  getVintageLabelForQuery,
  resetVintageCache,
  VINTAGE_CACHE_TTL_MS,
} from '../../utils/dataVintage';
import { ACS_VINTAGE_LABEL } from '../../config/censusVintage';

describe('data vintage tracking', () => {
  let instance: DuckDBInstance;
  let conn: DuckDBConnection;
  const query = async (sql: string) => {
    const reader = await conn.runAndReadAll(sql);
    return reader.getRowObjects() as Array<Record<string, unknown>>;
  };

  const COUNTY_SQL = 'SELECT county_name FROM county_data LIMIT 10';
  const BLOCKGROUP_SQL = 'SELECT geoid FROM block_group_data_expanded LIMIT 10';

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
    await expect(getVintageLabelForQuery(query, COUNTY_SQL)).resolves.toBeNull();
  });

  it('reports the vintage a loader actually wrote', async () => {
    await recordVintage(conn, 'county_data', 3144);

    await expect(getVintageLabelForQuery(query, COUNTY_SQL)).resolves.toBe(ACS_VINTAGE_LABEL);
  });

  it('claims no vintage for a table that was never reloaded', async () => {
    // The county loader ran; the block-group reload did not. Labelling a
    // block-group answer "ACS 2024" here would assert a year those rows lack.
    await recordVintage(conn, 'county_data', 3144);

    await expect(getVintageLabelForQuery(query, BLOCKGROUP_SQL)).resolves.toBeNull();
  });

  it('claims no vintage when a joined query spans disagreeing vintages', async () => {
    await recordVintage(conn, 'county_data', 3144);
    await conn.run(
      `UPDATE data_vintage SET vintage_label = 'ACS 2023 5-Year' WHERE table_name = 'county_data'`
    );
    await recordVintage(conn, 'block_group_data_expanded', 239741);
    resetVintageCache();

    const joined = 'SELECT c.county_name FROM county_data c JOIN block_group_data_expanded b ON 1=1';
    await expect(getVintageLabelForQuery(query, joined)).resolves.toBeNull();
  });

  it('re-stamping a table replaces the previous row rather than duplicating it', async () => {
    await recordVintage(conn, 'county_data', 3144);
    await recordVintage(conn, 'county_data', 3200);

    const rows = await query("SELECT row_count FROM data_vintage WHERE table_name = 'county_data'");
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].row_count)).toBe(3200);
  });

  it('picks up a loader that stamped after the cache was populated', async () => {
    // The loaders are separate processes writing the same DB file, so a refresh
    // against a running server must not stay invisible until restart.
    await expect(getVintageLabelForQuery(query, COUNTY_SQL)).resolves.toBeNull();

    await recordVintage(conn, 'county_data', 3144);

    const nowSpy = jest
      .spyOn(Date, 'now')
      .mockReturnValue(Date.now() + VINTAGE_CACHE_TTL_MS + 1);

    await expect(getVintageLabelForQuery(query, COUNTY_SQL)).resolves.toBe(ACS_VINTAGE_LABEL);

    nowSpy.mockRestore();
  });

  it('serves a cached answer inside the TTL rather than re-reading per query', async () => {
    await recordVintage(conn, 'county_data', 3144);
    await getVintageLabelForQuery(query, COUNTY_SQL);

    const spy = jest.fn(query);
    await getVintageLabelForQuery(spy, COUNTY_SQL);

    expect(spy).not.toHaveBeenCalled();
  });
});
