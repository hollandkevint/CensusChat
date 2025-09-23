import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';

interface DemoData {
  states: Array<{
    code: string;
    name: string;
    fips_code: string;
    population: number;
    median_income: number;
    seniors_65_plus: number;
  }>;
  counties: Array<{
    fips_code: string;
    name: string;
    state_code: string;
    population: number;
    median_income: number;
  }>;
  healthcare_metrics: Array<{
    geography_code: string;
    geography_type: string;
    uninsured_rate: number;
    medicare_eligible: number;
    medicaid_eligible: number;
    primary_care_physicians: number;
  }>;
}

const demoData: DemoData = {
  states: [
    { code: 'FL', name: 'Florida', fips_code: '12', population: 21477737, median_income: 57703, seniors_65_plus: 4175094 },
    { code: 'CA', name: 'California', fips_code: '06', population: 39512223, median_income: 80440, seniors_65_plus: 5148808 },
    { code: 'TX', name: 'Texas', fips_code: '48', population: 28995881, median_income: 63826, seniors_65_plus: 3877306 },
    { code: 'NY', name: 'New York', fips_code: '36', population: 19453561, median_income: 70457, seniors_65_plus: 3220752 },
    { code: 'PA', name: 'Pennsylvania', fips_code: '42', population: 12801989, median_income: 61744, seniors_65_plus: 2345877 },
    { code: 'IL', name: 'Illinois', fips_code: '17', population: 12671821, median_income: 69187, seniors_65_plus: 2012345 },
    { code: 'OH', name: 'Ohio', fips_code: '39', population: 11689100, median_income: 58602, seniors_65_plus: 1987654 },
    { code: 'GA', name: 'Georgia', fips_code: '13', population: 10617423, median_income: 61808, seniors_65_plus: 1456789 },
    { code: 'NC', name: 'North Carolina', fips_code: '37', population: 10439388, median_income: 57231, seniors_65_plus: 1678901 },
    { code: 'MI', name: 'Michigan', fips_code: '26', population: 9986857, median_income: 59234, seniors_65_plus: 1876543 }
  ],
  counties: [
    { fips_code: '12086', name: 'Miami-Dade County', state_code: 'FL', population: 2701747, median_income: 51800 },
    { fips_code: '06037', name: 'Los Angeles County', state_code: 'CA', population: 10014009, median_income: 71000 },
    { fips_code: '48201', name: 'Harris County', state_code: 'TX', population: 4731145, median_income: 61000 },
    { fips_code: '36061', name: 'New York County', state_code: 'NY', population: 1694251, median_income: 85000 },
    { fips_code: '17031', name: 'Cook County', state_code: 'IL', population: 5275541, median_income: 65000 },
    { fips_code: '04013', name: 'Maricopa County', state_code: 'AZ', population: 4253913, median_income: 62000 },
    { fips_code: '06073', name: 'San Diego County', state_code: 'CA', population: 3298634, median_income: 78000 },
    { fips_code: '12011', name: 'Broward County', state_code: 'FL', population: 1952778, median_income: 55000 },
    { fips_code: '36047', name: 'Kings County', state_code: 'NY', population: 2736074, median_income: 60000 },
    { fips_code: '53033', name: 'King County', state_code: 'WA', population: 2252782, median_income: 85000 }
  ],
  healthcare_metrics: [
    { geography_code: '12', geography_type: 'state', uninsured_rate: 12.5, medicare_eligible: 4175094, medicaid_eligible: 4200000, primary_care_physicians: 25000 },
    { geography_code: '06', geography_type: 'state', uninsured_rate: 7.2, medicare_eligible: 5148808, medicaid_eligible: 14000000, primary_care_physicians: 45000 },
    { geography_code: '48', geography_type: 'state', uninsured_rate: 18.4, medicare_eligible: 3877306, medicaid_eligible: 4000000, primary_care_physicians: 35000 },
    { geography_code: '36', geography_type: 'state', uninsured_rate: 5.4, medicare_eligible: 3220752, medicaid_eligible: 6000000, primary_care_physicians: 30000 },
    { geography_code: '12086', geography_type: 'county', uninsured_rate: 15.2, medicare_eligible: 450000, medicaid_eligible: 600000, primary_care_physicians: 3500 },
    { geography_code: '06037', geography_type: 'county', uninsured_rate: 8.1, medicare_eligible: 1200000, medicaid_eligible: 3000000, primary_care_physicians: 8000 },
    { geography_code: '48201', geography_type: 'county', uninsured_rate: 20.3, medicare_eligible: 600000, medicaid_eligible: 800000, primary_care_physicians: 4500 },
    { geography_code: '36061', geography_type: 'county', uninsured_rate: 4.8, medicare_eligible: 250000, medicaid_eligible: 400000, primary_care_physicians: 2000 },
    { geography_code: '17031', geography_type: 'county', uninsured_rate: 6.9, medicare_eligible: 800000, medicaid_eligible: 1200000, primary_care_physicians: 6000 },
    { geography_code: '04013', geography_type: 'county', uninsured_rate: 11.7, medicare_eligible: 500000, medicaid_eligible: 700000, primary_care_physicians: 3000 }
  ]
};

async function seedDemoData() {
  console.log('🌱 Seeding demo data for CensusChat...');
  
  try {
    // Create data directory if it doesn't exist
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Create temp directory for exports
    const tempDir = path.join(process.cwd(), 'temp', 'exports');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Create demo data JSON file
    const demoDataPath = path.join(dataDir, 'demo-data.json');
    fs.writeFileSync(demoDataPath, JSON.stringify(demoData, null, 2));
    
    console.log('✅ Demo data created:', demoDataPath);
    
    // Create sample query responses for testing
    const sampleQueries = [
      {
        query: "Show me population data for Florida",
        response: {
          success: true,
          message: "Found population data for Florida",
          data: [
            {
              state: "Florida",
              population: 21477737,
              median_income: 57703,
              seniors_65_plus: 4175094,
              uninsured_rate: 12.5,
              medicare_eligible: 4175094,
              primary_care_physicians: 25000
            }
          ],
          metadata: {
            queryTime: 1.2,
            totalRecords: 1,
            dataSource: "US Census Bureau - ACS 5-Year Estimates",
            confidenceLevel: 0.95,
            marginOfError: 2.3
          }
        }
      },
      {
        query: "What are the healthcare demographics for major counties?",
        response: {
          success: true,
          message: "Found healthcare demographics for major counties",
          data: demoData.counties.map(county => ({
            county: county.name,
            state: county.state_code,
            population: county.population,
            median_income: county.median_income,
            uninsured_rate: demoData.healthcare_metrics.find(m => m.geography_code === county.fips_code)?.uninsured_rate || 0,
            primary_care_physicians: demoData.healthcare_metrics.find(m => m.geography_code === county.fips_code)?.primary_care_physicians || 0
          })),
          metadata: {
            queryTime: 2.1,
            totalRecords: demoData.counties.length,
            dataSource: "US Census Bureau - ACS 5-Year Estimates",
            confidenceLevel: 0.95,
            marginOfError: 2.3
          }
        }
      },
      {
        query: "Show me states with highest senior population",
        response: {
          success: true,
          message: "Found states with highest senior population",
          data: demoData.states
            .sort((a, b) => b.seniors_65_plus - a.seniors_65_plus)
            .slice(0, 5)
            .map(state => ({
              state: state.name,
              population: state.population,
              seniors_65_plus: state.seniors_65_plus,
              senior_percentage: ((state.seniors_65_plus / state.population) * 100).toFixed(1),
              median_income: state.median_income
            })),
          metadata: {
            queryTime: 1.8,
            totalRecords: 5,
            dataSource: "US Census Bureau - ACS 5-Year Estimates",
            confidenceLevel: 0.95,
            marginOfError: 2.3
          }
        }
      }
    ];
    
    const sampleQueriesPath = path.join(dataDir, 'sample-queries.json');
    fs.writeFileSync(sampleQueriesPath, JSON.stringify(sampleQueries, null, 2));
    
    console.log('✅ Sample queries created:', sampleQueriesPath);
    
    // Create demo status file
    const demoStatus = {
      status: 'ready',
      timestamp: new Date().toISOString(),
      data_sources: {
        states: demoData.states.length,
        counties: demoData.counties.length,
        healthcare_metrics: demoData.healthcare_metrics.length
      },
      sample_queries: sampleQueries.length,
      export_feature: 'enabled',
      version: '1.0.0'
    };
    
    const demoStatusPath = path.join(dataDir, 'demo-status.json');
    fs.writeFileSync(demoStatusPath, JSON.stringify(demoStatus, null, 2));
    
    console.log('✅ Demo status created:', demoStatusPath);
    
    // Create a simple DuckDB file with demo data (if DuckDB is available)
    try {
      const { Database } = require('duckdb');
      const dbPath = path.join(dataDir, 'census.duckdb');
      
      const db = new Database(dbPath);
      
      // Create tables
      db.exec(`
        CREATE TABLE IF NOT EXISTS states (
          code VARCHAR(2) PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          fips_code VARCHAR(2) NOT NULL,
          population INTEGER,
          median_income INTEGER,
          seniors_65_plus INTEGER
        );
        
        CREATE TABLE IF NOT EXISTS counties (
          fips_code VARCHAR(5) PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          state_code VARCHAR(2) NOT NULL,
          population INTEGER,
          median_income INTEGER
        );
        
        CREATE TABLE IF NOT EXISTS healthcare_metrics (
          geography_code VARCHAR(10) PRIMARY KEY,
          geography_type VARCHAR(20) NOT NULL,
          uninsured_rate DOUBLE,
          medicare_eligible INTEGER,
          medicaid_eligible INTEGER,
          primary_care_physicians INTEGER
        );
      `);
      
      // Insert demo data
      const states = demoData.states.map(s => 
        `('${s.code}', '${s.name}', '${s.fips_code}', ${s.population}, ${s.median_income}, ${s.seniors_65_plus})`
      ).join(',\n');
      
      db.exec(`INSERT OR REPLACE INTO states VALUES ${states};`);
      
      const counties = demoData.counties.map(c => 
        `('${c.fips_code}', '${c.name}', '${c.state_code}', ${c.population}, ${c.median_income})`
      ).join(',\n');
      
      db.exec(`INSERT OR REPLACE INTO counties VALUES ${counties};`);
      
      const metrics = demoData.healthcare_metrics.map(m => 
        `('${m.geography_code}', '${m.geography_type}', ${m.uninsured_rate}, ${m.medicare_eligible}, ${m.medicaid_eligible}, ${m.primary_care_physicians})`
      ).join(',\n');
      
      db.exec(`INSERT OR REPLACE INTO healthcare_metrics VALUES ${metrics};`);
      
      db.close();
      
      console.log('✅ DuckDB demo database created:', dbPath);
      
    } catch (duckdbError) {
      console.log('⚠️  DuckDB not available, skipping database creation');
    }
    
    console.log('🎉 Demo data seeding completed successfully!');
    console.log('');
    console.log('📊 Demo Data Summary:');
    console.log(`   States: ${demoData.states.length}`);
    console.log(`   Counties: ${demoData.counties.length}`);
    console.log(`   Healthcare Metrics: ${demoData.healthcare_metrics.length}`);
    console.log(`   Sample Queries: ${sampleQueries.length}`);
    console.log('');
    console.log('🧪 Test Queries:');
    sampleQueries.forEach((query, index) => {
      console.log(`   ${index + 1}. "${query.query}"`);
    });
    
  } catch (error) {
    console.error('❌ Demo data seeding failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedDemoData()
    .then(() => {
      console.log('✨ Demo data seeding completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Demo data seeding failed:', error);
      process.exit(1);
    });
}

export { seedDemoData, demoData };


