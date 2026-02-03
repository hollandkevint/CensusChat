import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';
import { config } from '../config';
import path from 'path';

export interface CensusDataRecord {
  id?: string;
  geography_level: string;
  geography_code: string;
  geography_name: string;
  state_code?: string;
  county_code?: string;
  tract_code?: string;
  block_group_code?: string;
  zip_code?: string;
  variable_name: string;
  variable_value: number | null;
  margin_of_error?: number | null;
  dataset: string;
  year: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface CensusVariable {
  variable_name: string;
  label: string;
  concept?: string;
  table_id: string;
  universe?: string;
  variable_type: 'estimate' | 'margin_of_error' | 'percentage' | 'annotation';
  created_at?: Date;
}

export interface CensusGeography {
  geography_id: string;
  geography_level: string;
  geography_code: string;
  geography_name: string;
  state_code?: string;
  county_code?: string;
  tract_code?: string;
  block_group_code?: string;
  zip_code?: string;
  parent_geography_id?: string;
  geometry?: string; // For future spatial data
  created_at?: Date;
}

export class CensusDataModel {
  private instance: DuckDBInstance | null = null;
  private connection: DuckDBConnection | null = null;
  private dbPath: string;
  private isInitialized: boolean = false;

  constructor() {
    this.dbPath = config.database.duckdb.memory ? ':memory:' : config.database.duckdb.path;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized && this.connection) return;

    // Ensure data directory exists if using file-based storage
    if (!config.database.duckdb.memory) {
      const dataDir = path.dirname(config.database.duckdb.path);
      require('fs').mkdirSync(dataDir, { recursive: true });
    }

    this.instance = await DuckDBInstance.fromCache(this.dbPath, {
      memory_limit: '4GB',
      threads: '4',
    });
    this.connection = await this.instance.connect();
    await this.createTables();
    this.isInitialized = true;
  }

  private async createTables(): Promise<void> {
    if (!this.connection) throw new Error('Database not initialized');

    const schemas = [
      // Census data cache table
      `CREATE TABLE IF NOT EXISTS census_data (
        id VARCHAR PRIMARY KEY DEFAULT uuid(),
        geography_level VARCHAR NOT NULL,
        geography_code VARCHAR NOT NULL,
        geography_name VARCHAR NOT NULL,
        state_code VARCHAR,
        county_code VARCHAR,
        tract_code VARCHAR,
        block_group_code VARCHAR,
        zip_code VARCHAR,
        variable_name VARCHAR NOT NULL,
        variable_value DOUBLE,
        margin_of_error DOUBLE,
        dataset VARCHAR NOT NULL,
        year VARCHAR NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Census variables metadata
      `CREATE TABLE IF NOT EXISTS census_variables (
        variable_name VARCHAR PRIMARY KEY,
        label VARCHAR NOT NULL,
        concept VARCHAR,
        table_id VARCHAR NOT NULL,
        universe VARCHAR,
        variable_type VARCHAR NOT NULL CHECK (variable_type IN ('estimate', 'margin_of_error', 'percentage', 'annotation')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Census geographies lookup
      `CREATE TABLE IF NOT EXISTS census_geographies (
        geography_id VARCHAR PRIMARY KEY,
        geography_level VARCHAR NOT NULL,
        geography_code VARCHAR NOT NULL,
        geography_name VARCHAR NOT NULL,
        state_code VARCHAR,
        county_code VARCHAR,
        tract_code VARCHAR,
        block_group_code VARCHAR,
        zip_code VARCHAR,
        parent_geography_id VARCHAR,
        geometry VARCHAR,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_geography_id) REFERENCES census_geographies(geography_id)
      )`,

      // API query cache for performance
      `CREATE TABLE IF NOT EXISTS census_api_cache (
        query_hash VARCHAR PRIMARY KEY,
        query_url VARCHAR NOT NULL,
        response_data JSON NOT NULL,
        row_count INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      )`,

      // Dataset metadata
      `CREATE TABLE IF NOT EXISTS census_datasets (
        dataset_id VARCHAR PRIMARY KEY,
        name VARCHAR NOT NULL,
        description VARCHAR,
        base_url_pattern VARCHAR NOT NULL,
        available_years VARCHAR[], -- Array of available years
        geographic_levels VARCHAR[], -- Array of supported geography levels
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const schema of schemas) {
      try {
        await this.connection.run(schema);
      } catch (err) {
        console.error('Error creating table:', err);
        throw err;
      }
    }

    // Create indexes for better query performance
    await this.createIndexes();
  }

  private async createIndexes(): Promise<void> {
    if (!this.connection) throw new Error('Database not initialized');

    const indexes = [
      // Census data indexes
      'CREATE INDEX IF NOT EXISTS idx_census_data_geography ON census_data(geography_level, geography_code)',
      'CREATE INDEX IF NOT EXISTS idx_census_data_variable ON census_data(variable_name)',
      'CREATE INDEX IF NOT EXISTS idx_census_data_dataset_year ON census_data(dataset, year)',
      'CREATE INDEX IF NOT EXISTS idx_census_data_state ON census_data(state_code)',
      'CREATE INDEX IF NOT EXISTS idx_census_data_county ON census_data(state_code, county_code)',
      'CREATE INDEX IF NOT EXISTS idx_census_data_zip ON census_data(zip_code)',

      // Geography indexes
      'CREATE INDEX IF NOT EXISTS idx_census_geographies_level ON census_geographies(geography_level)',
      'CREATE INDEX IF NOT EXISTS idx_census_geographies_state ON census_geographies(state_code)',
      'CREATE INDEX IF NOT EXISTS idx_census_geographies_parent ON census_geographies(parent_geography_id)',

      // API cache indexes
      'CREATE INDEX IF NOT EXISTS idx_census_api_cache_expires ON census_api_cache(expires_at)',

      // Variable indexes
      'CREATE INDEX IF NOT EXISTS idx_census_variables_table ON census_variables(table_id)',
      'CREATE INDEX IF NOT EXISTS idx_census_variables_type ON census_variables(variable_type)'
    ];

    for (const indexSql of indexes) {
      try {
        await this.connection.run(indexSql);
      } catch (err) {
        const error = err as Error;
        if (!error.message.includes('already exists')) {
          console.error('Error creating index:', err);
        }
      }
    }
  }

  /**
   * Insert census data records in batch
   */
  async insertCensusData(records: CensusDataRecord[]): Promise<void> {
    await this.ensureInitialized();
    if (!this.connection) throw new Error('Database not initialized');

    for (const record of records) {
      const sql = `
        INSERT INTO census_data (
          geography_level, geography_code, geography_name, state_code, county_code,
          tract_code, block_group_code, zip_code, variable_name, variable_value,
          margin_of_error, dataset, year
        ) VALUES (
          '${record.geography_level}',
          '${record.geography_code}',
          '${record.geography_name.replace(/'/g, "''")}',
          ${record.state_code ? `'${record.state_code}'` : 'NULL'},
          ${record.county_code ? `'${record.county_code}'` : 'NULL'},
          ${record.tract_code ? `'${record.tract_code}'` : 'NULL'},
          ${record.block_group_code ? `'${record.block_group_code}'` : 'NULL'},
          ${record.zip_code ? `'${record.zip_code}'` : 'NULL'},
          '${record.variable_name}',
          ${record.variable_value !== null ? record.variable_value : 'NULL'},
          ${record.margin_of_error !== null && record.margin_of_error !== undefined ? record.margin_of_error : 'NULL'},
          '${record.dataset}',
          '${record.year}'
        )
      `;
      await this.connection.run(sql);
    }
  }

  /**
   * Insert census variables metadata
   */
  async insertCensusVariables(variables: CensusVariable[]): Promise<void> {
    await this.ensureInitialized();
    if (!this.connection) throw new Error('Database not initialized');

    for (const variable of variables) {
      const sql = `
        INSERT OR REPLACE INTO census_variables (
          variable_name, label, concept, table_id, universe, variable_type
        ) VALUES (
          '${variable.variable_name}',
          '${variable.label.replace(/'/g, "''")}',
          ${variable.concept ? `'${variable.concept.replace(/'/g, "''")}'` : 'NULL'},
          '${variable.table_id}',
          ${variable.universe ? `'${variable.universe.replace(/'/g, "''")}'` : 'NULL'},
          '${variable.variable_type}'
        )
      `;
      await this.connection.run(sql);
    }
  }

  /**
   * Query census data with filters
   */
  async queryCensusData(filters: {
    geographyLevel?: string[];
    stateCodes?: string[];
    variables?: string[];
    dataset?: string;
    year?: string;
    limit?: number;
  }): Promise<CensusDataRecord[]> {
    await this.ensureInitialized();
    if (!this.connection) throw new Error('Database not initialized');

    let sql = 'SELECT * FROM census_data WHERE 1=1';

    if (filters.geographyLevel?.length) {
      sql += ` AND geography_level IN ('${filters.geographyLevel.join("','")}')`;
    }

    if (filters.stateCodes?.length) {
      sql += ` AND state_code IN ('${filters.stateCodes.join("','")}')`;
    }

    if (filters.variables?.length) {
      sql += ` AND variable_name IN ('${filters.variables.join("','")}')`;
    }

    if (filters.dataset) {
      sql += ` AND dataset = '${filters.dataset}'`;
    }

    if (filters.year) {
      sql += ` AND year = '${filters.year}'`;
    }

    sql += ' ORDER BY geography_level, geography_code, variable_name';

    if (filters.limit) {
      sql += ` LIMIT ${filters.limit}`;
    }

    const reader = await this.connection.runAndReadAll(sql);
    return reader.getRowObjects() as CensusDataRecord[];
  }

  /**
   * Get available geographic levels and their counts
   */
  async getGeographyLevelStats(): Promise<Array<{level: string, count: number}>> {
    await this.ensureInitialized();
    if (!this.connection) throw new Error('Database not initialized');

    const sql = `
      SELECT geography_level as level, COUNT(*) as count
      FROM census_data
      GROUP BY geography_level
      ORDER BY count DESC
    `;

    const reader = await this.connection.runAndReadAll(sql);
    return reader.getRowObjects() as Array<{level: string, count: number}>;
  }

  /**
   * Cache API response
   */
  async cacheApiResponse(queryHash: string, queryUrl: string, responseData: any, expiresInHours: number = 24): Promise<void> {
    await this.ensureInitialized();
    if (!this.connection) throw new Error('Database not initialized');

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    const sql = `
      INSERT OR REPLACE INTO census_api_cache (query_hash, query_url, response_data, row_count, expires_at)
      VALUES (
        '${queryHash}',
        '${queryUrl.replace(/'/g, "''")}',
        '${JSON.stringify(responseData).replace(/'/g, "''")}',
        ${responseData.data ? responseData.data.length : 0},
        '${expiresAt.toISOString()}'
      )
    `;

    await this.connection.run(sql);
  }

  /**
   * Get cached API response
   */
  async getCachedApiResponse(queryHash: string): Promise<any | null> {
    await this.ensureInitialized();
    if (!this.connection) throw new Error('Database not initialized');

    const sql = `
      SELECT response_data FROM census_api_cache
      WHERE query_hash = '${queryHash}' AND expires_at > CURRENT_TIMESTAMP
    `;

    const reader = await this.connection.runAndReadAll(sql);
    const rows = reader.getRowObjects();

    if (rows.length > 0) {
      try {
        return JSON.parse((rows[0] as any).response_data);
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.connection) {
      this.connection.disconnectSync();
      this.connection = null;
    }
    if (this.instance) {
      this.instance.closeSync();
      this.instance = null;
    }
    this.isInitialized = false;
  }
}

export const censusDataModel = new CensusDataModel();
