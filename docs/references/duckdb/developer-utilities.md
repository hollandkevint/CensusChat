# DuckDB Developer Utilities for CensusChat

*Development tools and utilities for healthcare analytics with DuckDB*

## Database Connection Management

### Connection Pool Implementation
```typescript
// backend/src/utils/duckdbPool.ts
import { Database } from 'duckdb';
import { EventEmitter } from 'events';

export class DuckDBPool extends EventEmitter {
  private connections: Database[] = [];
  private activeConnections: Set<Database> = new Set();
  private maxConnections: number;
  private minConnections: number;
  private connectionTimeout: number;

  constructor(options: {
    maxConnections?: number;
    minConnections?: number;
    connectionTimeout?: number;
  } = {}) {
    super();
    this.maxConnections = options.maxConnections || 10;
    this.minConnections = options.minConnections || 2;
    this.connectionTimeout = options.connectionTimeout || 30000;

    this.initializePool();
  }

  private async initializePool(): Promise<void> {
    for (let i = 0; i < this.minConnections; i++) {
      const db = await this.createConnection();
      this.connections.push(db);
    }
  }

  private async createConnection(): Promise<Database> {
    const db = new Database(':memory:');

    // Configure for healthcare analytics
    await this.configureHealthcareSettings(db);

    return db;
  }

  private async configureHealthcareSettings(db: Database): Promise<void> {
    const statements = [
      "SET memory_limit = '4GB'",
      "SET threads = 4",
      "SET enable_progress_bar = true",
      "SET default_null_order = 'NULLS LAST'",
      "INSTALL httpfs",
      "LOAD httpfs",
      // Load healthcare-specific extensions if available
      "INSTALL spatial",
      "LOAD spatial"
    ];

    for (const stmt of statements) {
      try {
        await db.exec(stmt);
      } catch (error) {
        console.warn(`Warning: Could not execute ${stmt}:`, error);
      }
    }
  }

  public async getConnection(): Promise<Database> {
    if (this.connections.length > 0) {
      const db = this.connections.pop()!;
      this.activeConnections.add(db);
      return db;
    }

    if (this.activeConnections.size < this.maxConnections) {
      const db = await this.createConnection();
      this.activeConnections.add(db);
      return db;
    }

    // Wait for a connection to become available
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.connectionTimeout);

      this.once('connectionReleased', () => {
        clearTimeout(timeout);
        this.getConnection().then(resolve).catch(reject);
      });
    });
  }

  public releaseConnection(db: Database): void {
    this.activeConnections.delete(db);
    this.connections.push(db);
    this.emit('connectionReleased');
  }

  public async closeAll(): Promise<void> {
    const allConnections = [...this.connections, ...this.activeConnections];

    for (const db of allConnections) {
      try {
        await db.close();
      } catch (error) {
        console.error('Error closing connection:', error);
      }
    }

    this.connections = [];
    this.activeConnections.clear();
  }
}

// Singleton instance
export const duckdbPool = new DuckDBPool();
```

### Healthcare-Specific Query Builder
```typescript
// backend/src/utils/healthcareQueryBuilder.ts
export class HealthcareQueryBuilder {
  private query: string = '';
  private params: any[] = [];

  constructor(private pool: DuckDBPool) {}

  // Medicare eligibility analysis
  medicareEligibility(state?: string, countyFips?: string) {
    this.query = `
      SELECT
        state,
        county,
        population_total,
        population_65_plus,
        ROUND(100.0 * population_65_plus / NULLIF(population_total, 0), 2) as medicare_eligible_rate,
        ROUND(population_65_plus * 0.85, 0) as estimated_ma_eligible
      FROM demographics
      WHERE population_total > 0
    `;

    if (state) {
      this.query += ` AND state = ?`;
      this.params.push(state);
    }

    if (countyFips) {
      this.query += ` AND geo_id = ?`;
      this.params.push(countyFips);
    }

    this.query += ` ORDER BY medicare_eligible_rate DESC`;
    return this;
  }

  // Population health risk assessment
  populationHealthRisk(riskFactors: string[] = []) {
    this.query = `
      WITH risk_assessment AS (
        SELECT
          geo_id,
          state,
          county,
          population_total,
          -- Age risk
          CASE
            WHEN population_65_plus / NULLIF(population_total, 0) > 0.20 THEN 3
            WHEN population_65_plus / NULLIF(population_total, 0) > 0.15 THEN 2
            ELSE 1
          END as age_risk_score,
          -- Income risk
          CASE
            WHEN median_household_income < 40000 THEN 3
            WHEN median_household_income < 60000 THEN 2
            ELSE 1
          END as income_risk_score,
          -- Insurance risk
          CASE
            WHEN pct_uninsured > 15 THEN 3
            WHEN pct_uninsured > 8 THEN 2
            ELSE 1
          END as insurance_risk_score
        FROM demographics
        WHERE population_total > 0
      )
      SELECT
        state,
        county,
        age_risk_score + income_risk_score + insurance_risk_score as composite_risk_score,
        CASE
          WHEN age_risk_score + income_risk_score + insurance_risk_score >= 8 THEN 'High Risk'
          WHEN age_risk_score + income_risk_score + insurance_risk_score >= 6 THEN 'Moderate Risk'
          ELSE 'Low Risk'
        END as risk_category
      FROM risk_assessment
      ORDER BY composite_risk_score DESC
    `;
    return this;
  }

  // Healthcare facility adequacy
  facilityAdequacy(minPopulation: number = 1000) {
    this.query = `
      WITH facility_metrics AS (
        SELECT
          county_fips,
          COUNT(*) as total_facilities,
          COUNT(CASE WHEN facility_type = 'hospital' THEN 1 END) as hospitals,
          COUNT(CASE WHEN facility_type = 'clinic' THEN 1 END) as clinics
        FROM healthcare_facilities
        GROUP BY county_fips
      )
      SELECT
        d.state,
        d.county,
        d.population_total,
        d.population_65_plus,
        COALESCE(f.total_facilities, 0) as facilities,
        ROUND(COALESCE(f.total_facilities, 0) * 10000.0 / d.population_total, 2) as facilities_per_10k,
        CASE
          WHEN COALESCE(f.total_facilities, 0) * 10000.0 / d.population_total < 5 THEN 'Underserved'
          WHEN COALESCE(f.total_facilities, 0) * 10000.0 / d.population_total > 15 THEN 'Well Served'
          ELSE 'Adequately Served'
        END as adequacy_rating
      FROM demographics d
      LEFT JOIN facility_metrics f ON d.geo_id = f.county_fips
      WHERE d.population_total > ?
      ORDER BY facilities_per_10k
    `;
    this.params.push(minPopulation);
    return this;
  }

  // Execute the built query
  async execute(): Promise<any[]> {
    const db = await this.pool.getConnection();
    try {
      return new Promise((resolve, reject) => {
        db.all(this.query, this.params, (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        });
      });
    } finally {
      this.pool.releaseConnection(db);
    }
  }

  // Get the SQL for debugging
  getSQL(): { query: string; params: any[] } {
    return { query: this.query, params: this.params };
  }
}
```

## Data Loading Utilities

### Census Data Loader
```typescript
// backend/src/utils/censusDataLoader.ts
import * as fs from 'fs';
import * as path from 'path';
import { Database } from 'duckdb';

export class CensusDataLoader {
  constructor(private db: Database) {}

  async loadACSData(filePath: string, year: number): Promise<void> {
    console.log(`Loading ACS data from ${filePath} for year ${year}`);

    // Create table with proper schema
    await this.createDemographicsTable();

    // Load CSV with proper data types and validation
    const loadQuery = `
      INSERT INTO demographics
      SELECT
        GEO_ID as geo_id,
        NAME as county_name,
        REGEXP_EXTRACT(NAME, '([^,]+)') as county,
        REGEXP_EXTRACT(NAME, ', ([A-Z]{2})') as state,
        CAST(B01003_001E AS INTEGER) as population_total,
        CAST(B25003_001E AS INTEGER) as housing_units,
        CAST(B19013_001E AS INTEGER) as median_household_income,
        CAST(B25077_001E AS INTEGER) as median_home_value,
        CAST(B08303_001E AS INTEGER) as total_commuters,
        CAST(B27001_001E AS INTEGER) as population_for_insurance,
        -- Calculate derived fields
        CAST(B01001_020E AS INTEGER) + CAST(B01001_021E AS INTEGER) +
        CAST(B01001_022E AS INTEGER) + CAST(B01001_023E AS INTEGER) +
        CAST(B01001_024E AS INTEGER) + CAST(B01001_025E AS INTEGER) +
        CAST(B01001_044E AS INTEGER) + CAST(B01001_045E AS INTEGER) +
        CAST(B01001_046E AS INTEGER) + CAST(B01001_047E AS INTEGER) +
        CAST(B01001_048E AS INTEGER) + CAST(B01001_049E AS INTEGER) as population_65_plus,
        -- Calculate percentages
        ROUND(100.0 * (
          CAST(B27001_005E AS DECIMAL) + CAST(B27001_008E AS DECIMAL) +
          CAST(B27001_011E AS DECIMAL) + CAST(B27001_014E AS DECIMAL)
        ) / NULLIF(CAST(B27001_001E AS INTEGER), 0), 2) as pct_uninsured,
        ${year} as survey_year,
        CURRENT_TIMESTAMP as loaded_at
      FROM read_csv('${filePath}',
        header=true,
        auto_detect=true,
        skip=1,
        nullstr=['', 'N', '(X)', '-', '*', '**', '***', '(D)'],
        ignore_errors=true
      )
      WHERE GEO_ID IS NOT NULL
        AND B01003_001E IS NOT NULL
        AND CAST(B01003_001E AS INTEGER) > 0
    `;

    await this.executeQuery(loadQuery);

    // Validate loaded data
    await this.validateLoadedData(year);
  }

  private async createDemographicsTable(): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS demographics (
        geo_id VARCHAR PRIMARY KEY,
        county_name VARCHAR NOT NULL,
        county VARCHAR NOT NULL,
        state VARCHAR NOT NULL,
        population_total INTEGER NOT NULL,
        population_65_plus INTEGER DEFAULT 0,
        housing_units INTEGER,
        median_household_income INTEGER,
        median_home_value INTEGER,
        total_commuters INTEGER,
        population_for_insurance INTEGER,
        pct_uninsured DECIMAL(5,2),
        survey_year INTEGER NOT NULL,
        loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await this.executeQuery(createTableQuery);
  }

  private async validateLoadedData(year: number): Promise<void> {
    const validationQueries = [
      `SELECT COUNT(*) as total_records FROM demographics WHERE survey_year = ${year}`,
      `SELECT COUNT(*) as invalid_population FROM demographics
       WHERE survey_year = ${year} AND (population_total <= 0 OR population_total IS NULL)`,
      `SELECT COUNT(*) as missing_state FROM demographics
       WHERE survey_year = ${year} AND (state IS NULL OR state = '')`,
      `SELECT COUNT(*) as invalid_seniors FROM demographics
       WHERE survey_year = ${year} AND population_65_plus > population_total`
    ];

    for (const query of validationQueries) {
      const result = await this.executeQuery(query);
      console.log('Validation result:', result[0]);
    }
  }

  async loadHealthcareFacilities(filePath: string): Promise<void> {
    console.log(`Loading healthcare facilities from ${filePath}`);

    await this.createFacilitiesTable();

    const loadQuery = `
      INSERT INTO healthcare_facilities
      SELECT
        facility_id,
        facility_name,
        facility_type,
        county_fips,
        state,
        latitude,
        longitude,
        bed_count,
        services_offered,
        accepts_medicare,
        CURRENT_TIMESTAMP as loaded_at
      FROM read_json('${filePath}', format='array')
      WHERE facility_id IS NOT NULL
    `;

    await this.executeQuery(loadQuery);
  }

  private async createFacilitiesTable(): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS healthcare_facilities (
        facility_id VARCHAR PRIMARY KEY,
        facility_name VARCHAR NOT NULL,
        facility_type VARCHAR NOT NULL,
        county_fips VARCHAR NOT NULL,
        state VARCHAR NOT NULL,
        latitude DECIMAL(10,7),
        longitude DECIMAL(10,7),
        bed_count INTEGER,
        services_offered VARCHAR[],
        accepts_medicare BOOLEAN DEFAULT true,
        loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await this.executeQuery(createTableQuery);
  }

  private async executeQuery(query: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(query, (err, rows) => {
        if (err) {
          console.error('Query execution error:', err);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }
}
```

### Data Export Utilities
```typescript
// backend/src/utils/dataExportUtilities.ts
import * as XLSX from 'xlsx';
import { Database } from 'duckdb';

export class DataExportUtilities {
  constructor(private db: Database) {}

  async exportToExcel(query: string, filename: string, sheetName: string = 'Data'): Promise<string> {
    const data = await this.executeQuery(query);

    if (data.length === 0) {
      throw new Error('No data to export');
    }

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);

    // Add healthcare-specific formatting
    this.formatHealthcareWorksheet(worksheet, data);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Add metadata sheet
    const metadataSheet = this.createMetadataSheet(query, data.length);
    XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Metadata');

    // Write file
    const outputPath = `exports/${filename}`;
    XLSX.writeFile(workbook, outputPath);

    return outputPath;
  }

  private formatHealthcareWorksheet(worksheet: XLSX.WorkSheet, data: any[]): void {
    if (data.length === 0) return;

    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

    // Format percentage columns
    for (let col = range.s.c; col <= range.e.c; col++) {
      const headerCell = XLSX.utils.encode_cell({ r: 0, c: col });
      const header = worksheet[headerCell]?.v?.toString().toLowerCase() || '';

      if (header.includes('rate') || header.includes('percentage') || header.includes('pct')) {
        for (let row = 1; row <= range.e.r; row++) {
          const cellAddr = XLSX.utils.encode_cell({ r: row, c: col });
          if (worksheet[cellAddr]) {
            worksheet[cellAddr].t = 'n';
            worksheet[cellAddr].z = '0.00%';
          }
        }
      }

      // Format currency columns
      if (header.includes('income') || header.includes('cost') || header.includes('value')) {
        for (let row = 1; row <= range.e.r; row++) {
          const cellAddr = XLSX.utils.encode_cell({ r: row, c: col });
          if (worksheet[cellAddr]) {
            worksheet[cellAddr].t = 'n';
            worksheet[cellAddr].z = '$#,##0';
          }
        }
      }
    }

    // Set column widths
    const columnWidths = data.length > 0 ? Object.keys(data[0]).map(key => ({
      wch: Math.max(key.length, 15)
    })) : [];

    worksheet['!cols'] = columnWidths;
  }

  private createMetadataSheet(query: string, recordCount: number): XLSX.WorkSheet {
    const metadata = [
      { Field: 'Export Date', Value: new Date().toISOString() },
      { Field: 'Record Count', Value: recordCount },
      { Field: 'Data Source', Value: 'CensusChat Healthcare Analytics' },
      { Field: 'Query', Value: query.replace(/\s+/g, ' ').trim() }
    ];

    return XLSX.utils.json_to_sheet(metadata);
  }

  async exportToCSV(query: string, filename: string): Promise<string> {
    const outputPath = `exports/${filename}`;

    const exportQuery = `
      COPY (${query}) TO '${outputPath}' (
        FORMAT 'csv',
        HEADER true,
        DELIMITER ','
      )
    `;

    await this.executeQuery(exportQuery);
    return outputPath;
  }

  async exportToParquet(query: string, filename: string): Promise<string> {
    const outputPath = `exports/${filename}`;

    const exportQuery = `
      COPY (${query}) TO '${outputPath}' (
        FORMAT 'parquet',
        COMPRESSION 'snappy'
      )
    `;

    await this.executeQuery(exportQuery);
    return outputPath;
  }

  private async executeQuery(query: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(query, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }
}
```

## Performance Monitoring

### Query Performance Monitor
```typescript
// backend/src/utils/queryPerformanceMonitor.ts
export class QueryPerformanceMonitor {
  private queryStats: Map<string, {
    executionTimes: number[];
    errorCount: number;
    lastExecuted: Date;
  }> = new Map();

  async monitorQuery<T>(
    queryName: string,
    queryFn: () => Promise<T>,
    options: {
      timeout?: number;
      retries?: number;
      logSlowQueries?: boolean;
      slowQueryThreshold?: number;
    } = {}
  ): Promise<T> {
    const {
      timeout = 30000,
      retries = 0,
      logSlowQueries = true,
      slowQueryThreshold = 5000
    } = options;

    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Query timeout')), timeout);
        });

        const result = await Promise.race([queryFn(), timeoutPromise]);
        const executionTime = Date.now() - startTime;

        // Record performance metrics
        this.recordQueryStats(queryName, executionTime, false);

        // Log slow queries
        if (logSlowQueries && executionTime > slowQueryThreshold) {
          console.warn(`Slow query detected: ${queryName} took ${executionTime}ms`);
        }

        return result;
      } catch (error) {
        lastError = error as Error;
        this.recordQueryStats(queryName, Date.now() - startTime, true);

        if (attempt < retries) {
          console.warn(`Query ${queryName} failed, retrying (${attempt + 1}/${retries})`);
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
      }
    }

    throw lastError;
  }

  private recordQueryStats(queryName: string, executionTime: number, isError: boolean): void {
    const stats = this.queryStats.get(queryName) || {
      executionTimes: [],
      errorCount: 0,
      lastExecuted: new Date()
    };

    stats.executionTimes.push(executionTime);
    stats.lastExecuted = new Date();

    if (isError) {
      stats.errorCount++;
    }

    // Keep only last 100 execution times
    if (stats.executionTimes.length > 100) {
      stats.executionTimes = stats.executionTimes.slice(-100);
    }

    this.queryStats.set(queryName, stats);
  }

  getQueryPerformanceReport(): any {
    const report: any = {};

    for (const [queryName, stats] of this.queryStats.entries()) {
      const executionTimes = stats.executionTimes;
      if (executionTimes.length === 0) continue;

      const avgTime = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;
      const minTime = Math.min(...executionTimes);
      const maxTime = Math.max(...executionTimes);
      const p95Time = this.calculatePercentile(executionTimes, 0.95);

      report[queryName] = {
        totalExecutions: executionTimes.length,
        errorCount: stats.errorCount,
        errorRate: stats.errorCount / executionTimes.length,
        avgExecutionTime: Math.round(avgTime),
        minExecutionTime: minTime,
        maxExecutionTime: maxTime,
        p95ExecutionTime: Math.round(p95Time),
        lastExecuted: stats.lastExecuted.toISOString()
      };
    }

    return report;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[index] || 0;
  }
}

export const queryMonitor = new QueryPerformanceMonitor();
```

## Development CLI Tools

### Database Management CLI
```typescript
// backend/src/scripts/duckdb-cli.ts
#!/usr/bin/env node
import { Command } from 'commander';
import { DuckDBPool } from '../utils/duckdbPool';
import { CensusDataLoader } from '../utils/censusDataLoader';
import { HealthcareQueryBuilder } from '../utils/healthcareQueryBuilder';

const program = new Command();

program
  .name('censuschat-duckdb')
  .description('CensusChat DuckDB development utilities')
  .version('1.0.0');

program
  .command('load-census')
  .description('Load Census ACS data')
  .argument('<file>', 'Path to Census CSV file')
  .option('-y, --year <year>', 'Survey year', '2022')
  .action(async (file, options) => {
    const pool = new DuckDBPool();
    const db = await pool.getConnection();
    const loader = new CensusDataLoader(db);

    try {
      await loader.loadACSData(file, parseInt(options.year));
      console.log(`Successfully loaded Census data from ${file}`);
    } catch (error) {
      console.error('Error loading Census data:', error);
    } finally {
      pool.releaseConnection(db);
      await pool.closeAll();
    }
  });

program
  .command('query')
  .description('Execute healthcare analytics query')
  .argument('<type>', 'Query type: medicare-eligibility, facility-adequacy, population-health')
  .option('-s, --state <state>', 'Filter by state code')
  .option('-c, --county <fips>', 'Filter by county FIPS code')
  .action(async (type, options) => {
    const pool = new DuckDBPool();
    const queryBuilder = new HealthcareQueryBuilder(pool);

    try {
      let results;

      switch (type) {
        case 'medicare-eligibility':
          results = await queryBuilder
            .medicareEligibility(options.state, options.county)
            .execute();
          break;
        case 'facility-adequacy':
          results = await queryBuilder
            .facilityAdequacy()
            .execute();
          break;
        case 'population-health':
          results = await queryBuilder
            .populationHealthRisk()
            .execute();
          break;
        default:
          throw new Error(`Unknown query type: ${type}`);
      }

      console.table(results.slice(0, 20)); // Show first 20 results
      console.log(`\nTotal results: ${results.length}`);

    } catch (error) {
      console.error('Query error:', error);
    } finally {
      await pool.closeAll();
    }
  });

program
  .command('test-connection')
  .description('Test DuckDB connection and configuration')
  .action(async () => {
    const pool = new DuckDBPool();
    const db = await pool.getConnection();

    try {
      const testQueries = [
        "SELECT 'DuckDB connection successful' as status",
        "SELECT version() as duckdb_version",
        "PRAGMA database_list",
        "SELECT name FROM sqlite_master WHERE type='table'"
      ];

      for (const query of testQueries) {
        try {
          const result = await new Promise((resolve, reject) => {
            db.all(query, (err, rows) => {
              if (err) reject(err);
              else resolve(rows);
            });
          });

          console.log(`✅ ${query}:`);
          console.table(result);
        } catch (error) {
          console.log(`❌ ${query}: ${error}`);
        }
      }
    } finally {
      pool.releaseConnection(db);
      await pool.closeAll();
    }
  });

program
  .command('performance-report')
  .description('Generate query performance report')
  .action(async () => {
    const { queryMonitor } = await import('../utils/queryPerformanceMonitor');
    const report = queryMonitor.getQueryPerformanceReport();

    console.log('Query Performance Report:');
    console.table(report);
  });

if (require.main === module) {
  program.parse();
}

export { program };
```

## Testing Utilities

### Healthcare Data Test Suite
```typescript
// backend/src/__tests__/healthcareDataTests.ts
import { Database } from 'duckdb';
import { DuckDBPool } from '../utils/duckdbPool';
import { HealthcareQueryBuilder } from '../utils/healthcareQueryBuilder';

describe('Healthcare Data Analytics', () => {
  let pool: DuckDBPool;
  let db: Database;

  beforeAll(async () => {
    pool = new DuckDBPool({ maxConnections: 1 });
    db = await pool.getConnection();

    // Load test data
    await loadTestData(db);
  });

  afterAll(async () => {
    if (pool) {
      pool.releaseConnection(db);
      await pool.closeAll();
    }
  });

  describe('Medicare Eligibility Calculations', () => {
    test('should calculate correct Medicare eligibility rates', async () => {
      const queryBuilder = new HealthcareQueryBuilder(pool);
      const results = await queryBuilder
        .medicareEligibility('FL')
        .execute();

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);

      // Verify calculations
      const firstResult = results[0];
      expect(firstResult.medicare_eligible_rate).toBeGreaterThan(0);
      expect(firstResult.medicare_eligible_rate).toBeLessThanOrEqual(100);
      expect(firstResult.estimated_ma_eligible).toBeLessThanOrEqual(firstResult.population_65_plus);
    });

    test('should handle edge cases in eligibility calculations', async () => {
      // Test with zero population
      const result = await new Promise((resolve, reject) => {
        db.all(`
          SELECT
            ROUND(100.0 * 0 / NULLIF(0, 0), 2) as rate,
            ROUND(0 * 0.85, 0) as estimated
        `, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      expect(result).toBeDefined();
    });
  });

  describe('Population Health Risk Assessment', () => {
    test('should categorize population health risk correctly', async () => {
      const queryBuilder = new HealthcareQueryBuilder(pool);
      const results = await queryBuilder
        .populationHealthRisk()
        .execute();

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);

      // Verify risk categories
      const riskCategories = new Set(results.map(r => r.risk_category));
      expect(riskCategories.has('High Risk') ||
             riskCategories.has('Moderate Risk') ||
             riskCategories.has('Low Risk')).toBe(true);
    });
  });

  describe('Healthcare Facility Adequacy', () => {
    test('should assess facility adequacy correctly', async () => {
      const queryBuilder = new HealthcareQueryBuilder(pool);
      const results = await queryBuilder
        .facilityAdequacy(1000)
        .execute();

      expect(results).toBeDefined();

      // Verify adequacy ratings
      const adequacyRatings = new Set(results.map(r => r.adequacy_rating));
      expect(adequacyRatings.has('Underserved') ||
             adequacyRatings.has('Adequately Served') ||
             adequacyRatings.has('Well Served')).toBe(true);
    });
  });
});

async function loadTestData(db: Database): Promise<void> {
  // Create test demographics table
  await new Promise<void>((resolve, reject) => {
    db.exec(`
      CREATE TABLE demographics (
        geo_id VARCHAR PRIMARY KEY,
        county VARCHAR,
        state VARCHAR,
        population_total INTEGER,
        population_65_plus INTEGER,
        median_household_income INTEGER,
        pct_uninsured DECIMAL(5,2)
      )
    `, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  // Insert test data
  await new Promise<void>((resolve, reject) => {
    db.exec(`
      INSERT INTO demographics VALUES
      ('12086', 'Miami-Dade', 'FL', 2000000, 350000, 45000, 12.5),
      ('12011', 'Broward', 'FL', 1800000, 320000, 52000, 10.2),
      ('06037', 'Los Angeles', 'CA', 10000000, 1500000, 65000, 8.1),
      ('48201', 'Harris', 'TX', 4500000, 450000, 58000, 15.3)
    `, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  // Create test facilities table
  await new Promise<void>((resolve, reject) => {
    db.exec(`
      CREATE TABLE healthcare_facilities (
        facility_id VARCHAR PRIMARY KEY,
        county_fips VARCHAR,
        facility_type VARCHAR
      )
    `, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  // Insert test facility data
  await new Promise<void>((resolve, reject) => {
    db.exec(`
      INSERT INTO healthcare_facilities VALUES
      ('F001', '12086', 'hospital'),
      ('F002', '12086', 'clinic'),
      ('F003', '12011', 'hospital'),
      ('F004', '06037', 'hospital'),
      ('F005', '06037', 'clinic')
    `, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
```

---

*These developer utilities provide comprehensive tools for working with DuckDB in the CensusChat healthcare analytics environment, enabling efficient development, testing, and debugging of healthcare data workflows.*