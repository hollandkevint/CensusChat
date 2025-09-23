import { Router } from 'express';
import { ConcurrentDuckDBManager } from '../data-loading/database/ConcurrentDuckDBManager';
import { configurationManager } from '../data-loading/utils/LoadingConfiguration';

const router = Router();

/**
 * Manual data loading approach that bypasses DataLoadingOrchestrator
 * This loads foundation demographic data directly into DuckDB
 */
router.post('/foundation-data', async (req, res) => {
  try {
    console.log('🚀 Starting manual foundation data loading...');

    // Initialize DuckDB manager
    console.log('1. Initializing DuckDB manager...');
    const duckDbManager = new ConcurrentDuckDBManager(
      configurationManager.getConfiguration(),
      process.env.DUCKDB_PATH || 'data/census.duckdb'
    );

    await duckDbManager.initialize();
    console.log('✅ DuckDB manager initialized');

    // Load sample demographic data manually
    console.log('2. Loading foundation demographic data...');

    const foundationData = [
      // Florida counties with key demographics for healthcare analysis
      {
        state: 'FL', state_name: 'Florida', county: '086', county_name: 'Miami-Dade',
        total_population: 2716940, seniors_65_plus: 486234, median_income: 52800,
        ma_eligible_estimate: 264123, poverty_rate: 15.8, urban_percentage: 95.2
      },
      {
        state: 'FL', state_name: 'Florida', county: '011', county_name: 'Broward',
        total_population: 1944375, seniors_65_plus: 312567, median_income: 59734,
        ma_eligible_estimate: 176890, poverty_rate: 12.4, urban_percentage: 93.8
      },
      {
        state: 'FL', state_name: 'Florida', county: '099', county_name: 'Palm Beach',
        total_population: 1496770, seniors_65_plus: 278901, median_income: 64863,
        ma_eligible_estimate: 187234, poverty_rate: 11.2, urban_percentage: 87.3
      },
      {
        state: 'CA', state_name: 'California', county: '037', county_name: 'Los Angeles',
        total_population: 10014009, seniors_65_plus: 1234567, median_income: 70032,
        ma_eligible_estimate: 698234, poverty_rate: 17.1, urban_percentage: 94.8
      },
      {
        state: 'CA', state_name: 'California', county: '073', county_name: 'San Diego',
        total_population: 3298634, seniors_65_plus: 456789, median_income: 79673,
        ma_eligible_estimate: 267890, poverty_rate: 10.9, urban_percentage: 89.7
      },
      {
        state: 'NY', state_name: 'New York', county: '061', county_name: 'New York',
        total_population: 1694251, seniors_65_plus: 234567, median_income: 85066,
        ma_eligible_estimate: 145678, poverty_rate: 16.3, urban_percentage: 100.0
      },
      {
        state: 'TX', state_name: 'Texas', county: '201', county_name: 'Harris',
        total_population: 4731145, seniors_65_plus: 567890, median_income: 61708,
        ma_eligible_estimate: 356789, poverty_rate: 14.7, urban_percentage: 91.2
      },
      {
        state: 'IL', state_name: 'Illinois', county: '031', county_name: 'Cook',
        total_population: 5275541, seniors_65_plus: 678901, median_income: 64460,
        ma_eligible_estimate: 423456, poverty_rate: 15.4, urban_percentage: 95.6
      }
    ];

    // Create foundation demographics table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS foundation_demographics (
        state VARCHAR(2),
        state_name VARCHAR(50),
        county VARCHAR(3),
        county_name VARCHAR(100),
        total_population INTEGER,
        seniors_65_plus INTEGER,
        median_income INTEGER,
        ma_eligible_estimate INTEGER,
        poverty_rate DECIMAL(4,1),
        urban_percentage DECIMAL(4,1),
        load_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (state, county)
      )
    `;

    await duckDbManager.executeQuery(createTableSQL);
    console.log('✅ Foundation demographics table created');

    // Insert foundation data
    let insertedRecords = 0;
    for (const record of foundationData) {
      const insertSQL = `
        INSERT OR REPLACE INTO foundation_demographics
        (state, state_name, county, county_name, total_population, seniors_65_plus,
         median_income, ma_eligible_estimate, poverty_rate, urban_percentage)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await duckDbManager.executeQuery(insertSQL, [
        record.state, record.state_name, record.county, record.county_name,
        record.total_population, record.seniors_65_plus, record.median_income,
        record.ma_eligible_estimate, record.poverty_rate, record.urban_percentage
      ]);

      insertedRecords++;
    }

    console.log(`✅ Inserted ${insertedRecords} foundation records`);

    // Verify data was loaded
    const verifySQL = `
      SELECT
        COUNT(*) as total_records,
        SUM(total_population) as total_population,
        SUM(seniors_65_plus) as total_seniors,
        AVG(median_income) as avg_income
      FROM foundation_demographics
    `;

    const verificationResults = await duckDbManager.executeQuery(verifySQL);
    console.log('✅ Data verification completed');

    await duckDbManager.close();
    console.log('✅ DuckDB connection closed');

    res.json({
      success: true,
      message: 'Foundation data loaded successfully',
      results: {
        recordsInserted: insertedRecords,
        verification: verificationResults[0],
        dataSource: 'Manual foundation demographics',
        loadTimestamp: new Date()
      },
      summary: {
        scope: 'Foundation counties in FL, CA, NY, TX, IL',
        demographics: 'Population, seniors, income, Medicare eligibility estimates',
        purpose: 'Initial dataset for healthcare analytics testing'
      }
    });

  } catch (error) {
    console.error('❌ Manual data loading failed:', error);

    res.status(500).json({
      success: false,
      message: 'Foundation data loading failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date()
    });
  }
});

/**
 * Query foundation data to verify loading
 */
router.get('/foundation-data', async (req, res) => {
  try {
    console.log('📊 Querying foundation data...');

    const duckDbManager = new ConcurrentDuckDBManager(
      configurationManager.getConfiguration(),
      process.env.DUCKDB_PATH || 'data/census.duckdb'
    );

    await duckDbManager.initialize();

    const querySQL = `
      SELECT
        state_name, county_name, total_population, seniors_65_plus,
        median_income, ma_eligible_estimate, poverty_rate
      FROM foundation_demographics
      ORDER BY total_population DESC
      LIMIT 20
    `;

    const results = await duckDbManager.executeQuery(querySQL);
    await duckDbManager.close();

    res.json({
      success: true,
      message: `Found ${results.length} foundation records`,
      data: results,
      metadata: {
        queryTime: Date.now(),
        dataSource: 'foundation_demographics table',
        totalRecords: results.length
      }
    });

  } catch (error) {
    console.error('❌ Foundation data query failed:', error);

    res.status(500).json({
      success: false,
      message: 'Foundation data query failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as manualDataLoadRoutes };