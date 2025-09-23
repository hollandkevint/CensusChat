#!/usr/bin/env node

/**
 * Basic DuckDB Data Loader
 *
 * This script loads foundation demographic data directly into DuckDB
 * without using the complex DataLoadingOrchestrator infrastructure.
 *
 * This bypasses the startup issues we encountered with the orchestrator
 * and provides a simple way to populate DuckDB with test data.
 */

import { Database } from 'duckdb';
import * as path from 'path';
import * as fs from 'fs';

// Foundation demographic data for key counties
const foundationData = [
  // Florida counties (key healthcare markets)
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

  // California counties (large healthcare markets)
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
    state: 'CA', state_name: 'California', county: '059', county_name: 'Orange',
    total_population: 3186989, seniors_65_plus: 423567, median_income: 84043,
    ma_eligible_estimate: 234789, poverty_rate: 9.3, urban_percentage: 91.4
  },

  // New York counties
  {
    state: 'NY', state_name: 'New York', county: '061', county_name: 'New York',
    total_population: 1694251, seniors_65_plus: 234567, median_income: 85066,
    ma_eligible_estimate: 145678, poverty_rate: 16.3, urban_percentage: 100.0
  },
  {
    state: 'NY', state_name: 'New York', county: '047', county_name: 'Kings',
    total_population: 2648452, seniors_65_plus: 345678, median_income: 62609,
    ma_eligible_estimate: 234567, poverty_rate: 18.7, urban_percentage: 98.2
  },

  // Texas counties
  {
    state: 'TX', state_name: 'Texas', county: '201', county_name: 'Harris',
    total_population: 4731145, seniors_65_plus: 567890, median_income: 61708,
    ma_eligible_estimate: 356789, poverty_rate: 14.7, urban_percentage: 91.2
  },
  {
    state: 'TX', state_name: 'Texas', county: '113', county_name: 'Dallas',
    total_population: 2613539, seniors_65_plus: 298456, median_income: 63409,
    ma_eligible_estimate: 198234, poverty_rate: 13.2, urban_percentage: 89.6
  },

  // Illinois counties
  {
    state: 'IL', state_name: 'Illinois', county: '031', county_name: 'Cook',
    total_population: 5275541, seniors_65_plus: 678901, median_income: 64460,
    ma_eligible_estimate: 423456, poverty_rate: 15.4, urban_percentage: 95.6
  }
];

async function loadFoundationData(): Promise<void> {
  console.log('🚀 Starting basic DuckDB foundation data loading...');

  // Create data directory if it doesn't exist
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('📁 Created data directory');
  }

  const dbPath = path.join(dataDir, 'census.duckdb');
  console.log(`🗄️  Database path: ${dbPath}`);

  return new Promise((resolve, reject) => {
    // Create DuckDB connection
    const db = new Database(dbPath);

    console.log('🔗 Connected to DuckDB');

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

    db.exec(createTableSQL, (err) => {
      if (err) {
        console.error('❌ Failed to create table:', err);
        reject(err);
        return;
      }

      console.log('✅ Foundation demographics table created/verified');

      // Prepare insert statement
      const insertSQL = `
        INSERT OR REPLACE INTO foundation_demographics
        (state, state_name, county, county_name, total_population, seniors_65_plus,
         median_income, ma_eligible_estimate, poverty_rate, urban_percentage)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const stmt = db.prepare(insertSQL);
      let insertedRecords = 0;

      // Insert data records
      const insertPromises = foundationData.map((record, index) => {
        return new Promise<void>((resolveInsert, rejectInsert) => {
          stmt.run([
            record.state, record.state_name, record.county, record.county_name,
            record.total_population, record.seniors_65_plus, record.median_income,
            record.ma_eligible_estimate, record.poverty_rate, record.urban_percentage
          ], (err) => {
            if (err) {
              console.error(`❌ Failed to insert record ${index + 1}:`, err);
              rejectInsert(err);
            } else {
              insertedRecords++;
              console.log(`✅ Inserted record ${index + 1}: ${record.county_name}, ${record.state_name}`);
              resolveInsert();
            }
          });
        });
      });

      // Wait for all inserts to complete
      Promise.all(insertPromises)
        .then(() => {
          stmt.finalize();

          // Verify data was loaded
          db.all('SELECT COUNT(*) as count FROM foundation_demographics', (err, rows) => {
            if (err) {
              console.error('❌ Failed to verify data:', err);
              reject(err);
              return;
            }

            const totalRecords = rows[0]?.count || 0;
            console.log(`\n🎉 Foundation data loading completed successfully!`);
            console.log(`📊 Records inserted: ${insertedRecords}`);
            console.log(`📈 Total records in database: ${totalRecords}`);
            console.log(`🗄️  Database location: ${dbPath}`);

            // Sample the data to verify
            db.all(`
              SELECT state_name, county_name, total_population, seniors_65_plus
              FROM foundation_demographics
              ORDER BY total_population DESC
              LIMIT 5
            `, (err, sampleRows) => {
              if (err) {
                console.error('❌ Failed to sample data:', err);
              } else {
                console.log('\n📋 Sample data:');
                sampleRows.forEach((row: any, i: number) => {
                  console.log(`  ${i + 1}. ${row.county_name}, ${row.state_name} - Pop: ${row.total_population.toLocaleString()}, Seniors: ${row.seniors_65_plus.toLocaleString()}`);
                });
              }

              db.close((err) => {
                if (err) {
                  console.error('❌ Failed to close database:', err);
                  reject(err);
                } else {
                  console.log('\n✅ Database connection closed');
                  console.log('🚀 Ready for production testing!');
                  resolve();
                }
              });
            });
          });
        })
        .catch((error) => {
          stmt.finalize();
          db.close();
          reject(error);
        });
    });
  });
}

// Run the data loading if this script is executed directly
if (require.main === module) {
  loadFoundationData()
    .then(() => {
      console.log('\n✅ Data loading script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Data loading script failed:', error);
      process.exit(1);
    });
}

export { loadFoundationData };