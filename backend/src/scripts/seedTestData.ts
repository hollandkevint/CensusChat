/**
 * Test Data Seeding Script
 * Data Ops Engineering - Test Data Management
 * 
 * Seeds databases with test data for Docker-based testing
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Color output functions
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

const log = {
  info: (msg: string) => console.log(`${colors.blue}[SEED]${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  warning: (msg: string) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`)
};

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

class TestDataSeeder {
  private dbConfig: DatabaseConfig;
  private testDataPath: string;

  constructor() {
    this.dbConfig = {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'census_test',
      username: process.env.POSTGRES_USER || 'census_test',
      password: process.env.POSTGRES_PASSWORD || 'test_password_123'
    };

    this.testDataPath = process.env.TEST_DATA_PATH || '/app/fixtures';
  }

  /**
   * Main seeding orchestration
   */
  async seedAll(): Promise<void> {
    log.info('Starting test data seeding process...');
    
    try {
      await this.waitForDatabase();
      await this.seedUserData();
      await this.seedGeographyData();
      await this.seedSampleCensusData();
      await this.createDuckDBSnapshots();
      
      log.success('Test data seeding completed successfully!');
    } catch (error) {
      log.error(`Seeding failed: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    }
  }

  /**
   * Wait for database to be ready
   */
  private async waitForDatabase(): Promise<void> {
    log.info('Waiting for database to be ready...');
    
    const maxAttempts = 30;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        execSync(`pg_isready -h ${this.dbConfig.host} -p ${this.dbConfig.port} -U ${this.dbConfig.username}`, 
          { stdio: 'pipe' });
        log.success('Database is ready');
        return;
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error('Database failed to become ready within timeout');
        }
        await this.sleep(1000);
      }
    }
  }

  /**
   * Seed user test data
   */
  private async seedUserData(): Promise<void> {
    log.info('Seeding user test data...');
    
    const userFixtures = {
      users: [
        {
          email: 'test@example.com',
          password_hash: '$2a$10$test.hash.for.testing.only.censuschat',
          created_at: new Date().toISOString()
        },
        {
          email: 'admin@example.com', 
          password_hash: '$2a$10$admin.hash.for.testing.only.censuschat',
          created_at: new Date().toISOString()
        },
        {
          email: 'researcher@example.com',
          password_hash: '$2a$10$researcher.hash.for.testing.only.censuschat',
          created_at: new Date().toISOString()
        }
      ]
    };

    // Write fixture file
    const userFixturePath = path.join(this.testDataPath, 'users.json');
    await this.ensureDirectoryExists(path.dirname(userFixturePath));
    fs.writeFileSync(userFixturePath, JSON.stringify(userFixtures, null, 2));
    
    log.success(`Created user fixtures: ${userFixtures.users.length} test users`);
  }

  /**
   * Seed geography reference data
   */
  private async seedGeographyData(): Promise<void> {
    log.info('Seeding geography reference data...');

    // Sample states for testing (subset for faster testing)
    const stateFixtures = {
      states: [
        { code: 'CA', name: 'California', fips_code: '06' },
        { code: 'NY', name: 'New York', fips_code: '36' },
        { code: 'TX', name: 'Texas', fips_code: '48' },
        { code: 'FL', name: 'Florida', fips_code: '12' },
        { code: 'IL', name: 'Illinois', fips_code: '17' },
        { code: 'PA', name: 'Pennsylvania', fips_code: '42' },
        { code: 'OH', name: 'Ohio', fips_code: '39' },
        { code: 'GA', name: 'Georgia', fips_code: '13' },
        { code: 'NC', name: 'North Carolina', fips_code: '37' },
        { code: 'MI', name: 'Michigan', fips_code: '26' }
      ]
    };

    // Sample counties for major metropolitan areas
    const countyFixtures = {
      counties: [
        { fips_code: '06037', name: 'Los Angeles County', state_code: 'CA' },
        { fips_code: '36047', name: 'Kings County', state_code: 'NY' },
        { fips_code: '48201', name: 'Harris County', state_code: 'TX' },
        { fips_code: '12086', name: 'Miami-Dade County', state_code: 'FL' },
        { fips_code: '17031', name: 'Cook County', state_code: 'IL' },
        { fips_code: '42101', name: 'Philadelphia County', state_code: 'PA' },
        { fips_code: '39035', name: 'Cuyahoga County', state_code: 'OH' },
        { fips_code: '13121', name: 'Fulton County', state_code: 'GA' },
        { fips_code: '37119', name: 'Mecklenburg County', state_code: 'NC' },
        { fips_code: '26163', name: 'Wayne County', state_code: 'MI' }
      ]
    };

    // Write fixtures
    const statesPath = path.join(this.testDataPath, 'states.json');
    const countiesPath = path.join(this.testDataPath, 'counties.json');
    
    fs.writeFileSync(statesPath, JSON.stringify(stateFixtures, null, 2));
    fs.writeFileSync(countiesPath, JSON.stringify(countyFixtures, null, 2));

    log.success(`Geography fixtures created: ${stateFixtures.states.length} states, ${countyFixtures.counties.length} counties`);
  }

  /**
   * Generate sample Census data for testing
   */
  private async seedSampleCensusData(): Promise<void> {
    log.info('Generating sample Census data...');

    const variables = [
      'B01001_001E', // Total Population  
      'B19013_001E', // Median Household Income
      'B25001_001E', // Housing Units
      'B08301_001E', // Total Commuters
      'B15003_022E', // Bachelor's Degree
      'B27001_001E'  // Health Insurance Coverage
    ];

    const geographyTypes = ['state', 'county'];
    const years = [2018, 2019, 2020, 2021, 2022];
    
    const censusFixtures = {
      census_data: [] as any[]
    };

    // Generate sample data
    for (const geoType of geographyTypes) {
      const geoCodes = geoType === 'state' 
        ? ['06', '36', '48', '12', '17'] // Sample state FIPS codes
        : ['06037', '36047', '48201', '12086', '17031']; // Sample county FIPS codes

      for (const geoCode of geoCodes) {
        for (const variable of variables) {
          for (const year of years) {
            censusFixtures.census_data.push({
              geography_type: geoType,
              geography_code: geoCode,
              variable_code: variable,
              value: this.generateRealisticValue(variable),
              margin_of_error: this.generateMarginOfError(variable),
              year: year,
              dataset: 'acs5',
              created_at: new Date().toISOString()
            });
          }
        }
      }
    }

    // Write census data fixtures
    const censusPath = path.join(this.testDataPath, 'census_data.json');
    fs.writeFileSync(censusPath, JSON.stringify(censusFixtures, null, 2));

    log.success(`Census data fixtures created: ${censusFixtures.census_data.length} records`);
  }

  /**
   * Create DuckDB snapshots for testing
   */
  private async createDuckDBSnapshots(): Promise<void> {
    log.info('Creating DuckDB test snapshots...');

    const snapshotScript = '/test-data/duckdb/scripts/create-snapshot.sh';
    
    try {
      if (fs.existsSync(snapshotScript)) {
        execSync(`${snapshotScript} all`, { stdio: 'pipe' });
        log.success('DuckDB snapshots created successfully');
      } else {
        log.warning('DuckDB snapshot script not found, skipping snapshot creation');
      }
    } catch (error) {
      log.warning('DuckDB snapshot creation failed (non-critical)');
    }
  }

  /**
   * Generate realistic values based on Census variable type
   */
  private generateRealisticValue(variable: string): number {
    const baseValue = Math.random();
    
    switch (variable) {
      case 'B01001_001E': // Total Population
        return Math.floor(baseValue * 5000000 + 50000);
      case 'B19013_001E': // Median Household Income  
        return Math.floor(baseValue * 80000 + 30000);
      case 'B25001_001E': // Housing Units
        return Math.floor(baseValue * 2000000 + 20000);
      case 'B08301_001E': // Total Commuters
        return Math.floor(baseValue * 1000000 + 10000);
      case 'B15003_022E': // Bachelor's Degree
        return Math.floor(baseValue * 500000 + 5000);
      case 'B27001_001E': // Health Insurance Coverage
        return Math.floor(baseValue * 1000000 + 10000);
      default:
        return Math.floor(baseValue * 1000000);
    }
  }

  /**
   * Generate realistic margin of error
   */
  private generateMarginOfError(variable: string): number {
    const baseValue = this.generateRealisticValue(variable);
    return Math.floor(baseValue * 0.02 + Math.random() * 1000); // ~2% MOE + random component
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Execute if run directly
if (require.main === module) {
  const seeder = new TestDataSeeder();
  seeder.seedAll().catch(error => {
    log.error(`Seeding process failed: ${error}`);
    process.exit(1);
  });
}