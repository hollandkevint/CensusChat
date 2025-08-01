import Database from 'duckdb';
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
  private db: Database.Database;
  private dbPath: string;

  constructor() {
    this.dbPath = config.database.duckdb.memory ? ':memory:' : config.database.duckdb.path;
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    // Ensure data directory exists if using file-based storage
    if (!config.database.duckdb.memory) {
      const dataDir = path.dirname(config.database.duckdb.path);
      require('fs').mkdirSync(dataDir, { recursive: true });
    }

    this.db = new Database.Database(this.dbPath);
    this.createTables();
  }

  private createTables(): void {
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

    schemas.forEach(schema => {
      this.db.run(schema, (err) => {
        if (err) {
          console.error('Error creating table:', err);
          throw err;
        }
      });
    });

    // Create indexes for better query performance
    this.createIndexes();
  }

  private createIndexes(): void {
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

    indexes.forEach(indexSql => {
      this.db.run(indexSql, (err) => {
        if (err && !err.message.includes('already exists')) {
          console.error('Error creating index:', err);
        }
      });
    });
  }

  /**
   * Insert census data records in batch
   */
  async insertCensusData(records: CensusDataRecord[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO census_data (
          geography_level, geography_code, geography_name, state_code, county_code,
          tract_code, block_group_code, zip_code, variable_name, variable_value,
          margin_of_error, dataset, year
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const stmt = this.db.prepare(sql);
      
      records.forEach(record => {
        stmt.run([
          record.geography_level,
          record.geography_code,
          record.geography_name,
          record.state_code,
          record.county_code,
          record.tract_code,
          record.block_group_code,
          record.zip_code,
          record.variable_name,
          record.variable_value,
          record.margin_of_error,
          record.dataset,
          record.year
        ]);
      });

      stmt.finalize((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Insert census variables metadata
   */
  async insertCensusVariables(variables: CensusVariable[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO census_variables (
          variable_name, label, concept, table_id, universe, variable_type
        ) VALUES (?, ?, ?, ?, ?, ?)
      `;

      const stmt = this.db.prepare(sql);
      
      variables.forEach(variable => {
        stmt.run([
          variable.variable_name,
          variable.label,
          variable.concept,
          variable.table_id,
          variable.universe,
          variable.variable_type
        ]);
      });

      stmt.finalize((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
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
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM census_data WHERE 1=1';
      const params: any[] = [];

      if (filters.geographyLevel?.length) {
        sql += ` AND geography_level IN (${filters.geographyLevel.map(() => '?').join(',')})`;
        params.push(...filters.geographyLevel);
      }

      if (filters.stateCodes?.length) {
        sql += ` AND state_code IN (${filters.stateCodes.map(() => '?').join(',')})`;
        params.push(...filters.stateCodes);
      }

      if (filters.variables?.length) {
        sql += ` AND variable_name IN (${filters.variables.map(() => '?').join(',')})`;
        params.push(...filters.variables);
      }

      if (filters.dataset) {
        sql += ' AND dataset = ?';
        params.push(filters.dataset);
      }

      if (filters.year) {
        sql += ' AND year = ?';
        params.push(filters.year);
      }

      sql += ' ORDER BY geography_level, geography_code, variable_name';

      if (filters.limit) {
        sql += ' LIMIT ?';
        params.push(filters.limit);
      }

      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as CensusDataRecord[]);
      });
    });
  }

  /**
   * Get available geographic levels and their counts
   */
  async getGeographyLevelStats(): Promise<Array<{level: string, count: number}>> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT geography_level as level, COUNT(*) as count 
        FROM census_data 
        GROUP BY geography_level 
        ORDER BY count DESC
      `;

      this.db.all(sql, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows as Array<{level: string, count: number}>);
      });
    });
  }

  /**
   * Cache API response
   */
  async cacheApiResponse(queryHash: string, queryUrl: string, responseData: any, expiresInHours: number = 24): Promise<void> {
    return new Promise((resolve, reject) => {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiresInHours);

      const sql = `
        INSERT OR REPLACE INTO census_api_cache (query_hash, query_url, response_data, row_count, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `;

      this.db.run(sql, [
        queryHash,
        queryUrl,
        JSON.stringify(responseData),
        responseData.data ? responseData.data.length : 0,
        expiresAt.toISOString()
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Get cached API response
   */
  async getCachedApiResponse(queryHash: string): Promise<any | null> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT response_data FROM census_api_cache 
        WHERE query_hash = ? AND expires_at > CURRENT_TIMESTAMP
      `;

      this.db.get(sql, [queryHash], (err, row: any) => {
        if (err) reject(err);
        else if (row) {
          try {
            resolve(JSON.parse(row.response_data));
          } catch (parseErr) {
            resolve(null);
          }
        }
        else resolve(null);
      });
    });
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

export const censusDataModel = new CensusDataModel();