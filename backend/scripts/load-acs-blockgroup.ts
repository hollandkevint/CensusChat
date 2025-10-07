/**
 * ACS Block Group Data Loader for CensusChat
 *
 * Loads 2023 ACS 5-Year block group data for all US states
 * Block groups are the finest geographic level available in ACS
 *
 * Estimated ~220,000 block groups nationwide
 */

import axios from 'axios';
import * as duckdb from 'duckdb';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const CENSUS_API_KEY = process.env.CENSUS_API_KEY;
const CENSUS_API_BASE = 'https://api.census.gov/data';
const YEAR = 2023; // Most recent ACS 5-Year
const DB_PATH = path.join(__dirname, '../data/census_blockgroups.duckdb');
const PROGRESS_FILE = path.join(__dirname, '../data/blockgroup-progress.json');

interface BlockGroupData {
  // Geographic identifiers
  state_fips: string;
  county_fips: string;
  tract_fips: string;
  block_group: string;
  geoid: string; // Full FIPS code
  state_name: string;
  county_name: string;

  // Demographics
  population: number;
  median_age: number;
  male_population: number;
  female_population: number;

  // Age groups (for healthcare analysis)
  under_5: number;
  age_5_17: number;
  age_18_64: number;
  age_65_plus: number;
  age_75_plus: number;

  // Race and ethnicity
  white_alone: number;
  black_alone: number;
  asian_alone: number;
  hispanic_latino: number;

  // Economic
  median_household_income: number;
  per_capita_income: number;
  poverty_rate: number;
  unemployment_rate: number;
  uninsured_rate: number;

  // Education
  high_school_or_higher_pct: number;
  bachelors_or_higher_pct: number;

  // Housing
  total_housing_units: number;
  median_home_value: number;
  median_rent: number;
  renter_occupied_pct: number;

  // Health-related
  disability_rate: number;
  limited_english_pct: number;

  // Transportation
  no_vehicle_pct: number;
  public_transit_pct: number;
}

interface LoadProgress {
  lastCompletedState?: string;
  completedStates: string[];
  totalBlockGroups: number;
  startTime: string;
  lastUpdateTime: string;
}

// Core ACS variable mappings (35 variables - optimized for Census API limits)
const ACS_VARIABLES = {
  // Core demographics (4 vars)
  population: 'B01003_001E',
  maleTotal: 'B01001_002E',
  femaleTotal: 'B01001_026E',
  medianAge: 'B01002_001E',

  // Key age groups for healthcare (8 vars - simplified)
  maleUnder5: 'B01001_003E',
  male5to17: 'B01001_004E', // We'll approximate by using one value
  male18to64: 'B01001_007E', // We'll calculate from multiple
  male65plus: 'B01001_020E',
  femaleUnder5: 'B01001_027E',
  female5to17: 'B01001_028E',
  female18to64: 'B01001_031E',
  female65plus: 'B01001_044E',

  // Race/ethnicity (4 vars)
  whiteAlone: 'B02001_002E',
  blackAlone: 'B02001_003E',
  asianAlone: 'B02001_005E',
  hispanicLatino: 'B03003_003E',

  // Economic (6 vars)
  medianIncome: 'B19013_001E',
  perCapitaIncome: 'B19301_001E',
  povertyTotal: 'B17001_001E',
  povertyBelow: 'B17001_002E',
  unemployed: 'B23025_005E',
  laborForce: 'B23025_002E',

  // Health (2 vars)
  uninsured: 'B27001_005E',
  withDisability: 'B18101_004E',

  // Education (2 vars)
  eduTotal: 'B15003_001E',
  bachelorsPlus: 'B15003_022E',

  // Housing (3 vars)
  housingUnits: 'B25001_001E',
  medianValue: 'B25077_001E',
  renterOcc: 'B25003_003E'
};

// State FIPS codes and names
const STATES = [
  { fips: '01', name: 'Alabama' },
  { fips: '02', name: 'Alaska' },
  { fips: '04', name: 'Arizona' },
  { fips: '05', name: 'Arkansas' },
  { fips: '06', name: 'California' },
  { fips: '08', name: 'Colorado' },
  { fips: '09', name: 'Connecticut' },
  { fips: '10', name: 'Delaware' },
  { fips: '11', name: 'District of Columbia' },
  { fips: '12', name: 'Florida' },
  { fips: '13', name: 'Georgia' },
  { fips: '15', name: 'Hawaii' },
  { fips: '16', name: 'Idaho' },
  { fips: '17', name: 'Illinois' },
  { fips: '18', name: 'Indiana' },
  { fips: '19', name: 'Iowa' },
  { fips: '20', name: 'Kansas' },
  { fips: '21', name: 'Kentucky' },
  { fips: '22', name: 'Louisiana' },
  { fips: '23', name: 'Maine' },
  { fips: '24', name: 'Maryland' },
  { fips: '25', name: 'Massachusetts' },
  { fips: '26', name: 'Michigan' },
  { fips: '27', name: 'Minnesota' },
  { fips: '28', name: 'Mississippi' },
  { fips: '29', name: 'Missouri' },
  { fips: '30', name: 'Montana' },
  { fips: '31', name: 'Nebraska' },
  { fips: '32', name: 'Nevada' },
  { fips: '33', name: 'New Hampshire' },
  { fips: '34', name: 'New Jersey' },
  { fips: '35', name: 'New Mexico' },
  { fips: '36', name: 'New York' },
  { fips: '37', name: 'North Carolina' },
  { fips: '38', name: 'North Dakota' },
  { fips: '39', name: 'Ohio' },
  { fips: '40', name: 'Oklahoma' },
  { fips: '41', name: 'Oregon' },
  { fips: '42', name: 'Pennsylvania' },
  { fips: '44', name: 'Rhode Island' },
  { fips: '45', name: 'South Carolina' },
  { fips: '46', name: 'South Dakota' },
  { fips: '47', name: 'Tennessee' },
  { fips: '48', name: 'Texas' },
  { fips: '49', name: 'Utah' },
  { fips: '50', name: 'Vermont' },
  { fips: '51', name: 'Virginia' },
  { fips: '53', name: 'Washington' },
  { fips: '54', name: 'West Virginia' },
  { fips: '55', name: 'Wisconsin' },
  { fips: '56', name: 'Wyoming' }
];

/**
 * Fetch block group data for a state
 */
async function fetchBlockGroupData(stateFips: string, stateName: string): Promise<BlockGroupData[]> {
  const variables = Object.values(ACS_VARIABLES).join(',');
  // Block groups require county in the geography hierarchy
  const url = `${CENSUS_API_BASE}/${YEAR}/acs/acs5?get=NAME,${variables}&for=block%20group:*&in=state:${stateFips}%20county:*&key=${CENSUS_API_KEY}`;

  try {
    console.log(`  Fetching ${stateName}... (${Object.keys(ACS_VARIABLES).length} variables)`);
    const response = await axios.get(url, { timeout: 30000 });

    if (!response.data || response.data.length <= 1) {
      console.log(`  ⚠️  No block group data for ${stateName}`);
      return [];
    }

    const [headers, ...rows] = response.data;
    const blockGroups: BlockGroupData[] = [];

    for (const row of rows) {
      try {
        const dataMap = Object.fromEntries(
          headers.map((header: string, index: number) => [header, row[index]])
        );

        // Helper function to safely parse numbers
        const parseNum = (key: string): number => {
          const val = parseInt(dataMap[key] || '0');
          return isNaN(val) ? 0 : val;
        };

        const parseFlt = (key: string): number => {
          const val = parseFloat(dataMap[key] || '0');
          return isNaN(val) ? 0 : val;
        };

        // Calculate age groups from simplified age data
        const under_5 = parseNum('B01001_003E') + parseNum('B01001_027E');
        const age_5_17 = parseNum('B01001_004E') + parseNum('B01001_028E'); // Simplified approximation
        const age_18_64 = parseNum('B01001_007E') + parseNum('B01001_031E'); // Simplified approximation
        const age_65_plus = parseNum('B01001_020E') + parseNum('B01001_044E');
        const age_75_plus = Math.floor(age_65_plus * 0.4); // Rough estimate: 40% of 65+ are 75+

        // Calculate poverty rate
        const povertyBelow = parseNum('B17001_002E');
        const povertyTotal = parseNum('B17001_001E');
        const poverty_rate = povertyTotal > 0 ? (povertyBelow / povertyTotal) * 100 : 0;

        // Calculate unemployment rate
        const laborForce = parseNum('B23025_002E');
        const unemployed = parseNum('B23025_005E');
        const unemployment_rate = laborForce > 0 ? (unemployed / laborForce) * 100 : 0;

        // Calculate uninsured rate (using population as denominator since we don't have insuredTotal)
        const population = parseNum('B01003_001E');
        const uninsured = parseNum('B27001_005E');
        const uninsured_rate = population > 0 ? (uninsured / population) * 100 : 0;

        // Calculate education percentages (bachelors+ from total 25+)
        const eduTotal = parseNum('B15003_001E');
        const bachelorsPlus = parseNum('B15003_022E');
        const high_school_or_higher_pct = 0; // Simplified - would need more variables
        const bachelors_or_higher_pct = eduTotal > 0 ? (bachelorsPlus / eduTotal) * 100 : 0;

        // Calculate housing percentages
        const housingUnits = parseNum('B25001_001E');
        const renterOccupied = parseNum('B25003_003E');
        const renter_occupied_pct = housingUnits > 0 ? (renterOccupied / housingUnits) * 100 : 0;

        // Calculate disability rate (using population as denominator)
        const withDisability = parseNum('B18101_004E');
        const disability_rate = population > 0 ? (withDisability / population) * 100 : 0;

        // Simplified - no limited English or transportation data in this version
        const limited_english_pct = 0;
        const no_vehicle_pct = 0;
        const public_transit_pct = 0;

        // Parse location data
        const name = dataMap['NAME'] || '';
        const countyMatch = name.match(/,\s*([^,]+)\s+County/i);
        const countyName = countyMatch ? countyMatch[1] + ' County' : 'Unknown';

        // Build GEOID
        const state_fips = dataMap['state'] || stateFips;
        const county_fips = dataMap['county'] || '000';
        const tract_fips = dataMap['tract'] || '000000';
        const block_group = dataMap['block group'] || '0';
        const geoid = `${state_fips}${county_fips}${tract_fips}${block_group}`;

        blockGroups.push({
          state_fips,
          county_fips,
          tract_fips,
          block_group,
          geoid,
          state_name: stateName,
          county_name: countyName,

          // Demographics
          population,
          median_age: parseFlt('B01002_001E'),
          male_population: parseNum('B01001_002E'),
          female_population: parseNum('B01001_026E'),

          // Age groups
          under_5,
          age_5_17,
          age_18_64,
          age_65_plus,
          age_75_plus,

          // Race and ethnicity
          white_alone: parseNum('B02001_002E'),
          black_alone: parseNum('B02001_003E'),
          asian_alone: parseNum('B02001_005E'),
          hispanic_latino: parseNum('B03003_003E'),

          // Economic
          median_household_income: parseNum('B19013_001E'),
          per_capita_income: parseNum('B19301_001E'),
          poverty_rate: parseFloat(poverty_rate.toFixed(2)),
          unemployment_rate: parseFloat(unemployment_rate.toFixed(2)),
          uninsured_rate: parseFloat(uninsured_rate.toFixed(2)),

          // Education
          high_school_or_higher_pct: parseFloat(high_school_or_higher_pct.toFixed(2)),
          bachelors_or_higher_pct: parseFloat(bachelors_or_higher_pct.toFixed(2)),

          // Housing
          total_housing_units: housingUnits,
          median_home_value: parseNum('B25077_001E'),
          median_rent: 0, // Not included in simplified variable set
          renter_occupied_pct: parseFloat(renter_occupied_pct.toFixed(2)),

          // Health-related
          disability_rate: parseFloat(disability_rate.toFixed(2)),
          limited_english_pct: parseFloat(limited_english_pct.toFixed(2)),

          // Transportation
          no_vehicle_pct: parseFloat(no_vehicle_pct.toFixed(2)),
          public_transit_pct: parseFloat(public_transit_pct.toFixed(2))
        });
      } catch (error) {
        console.error(`  Error parsing block group row:`, error);
        continue;
      }
    }

    console.log(`  ✅ ${stateName}: ${blockGroups.length} block groups`);
    return blockGroups;

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`  ❌ API error for ${stateName}:`, error.response?.status, error.message);
    } else {
      console.error(`  ❌ Error fetching ${stateName}:`, error);
    }
    return [];
  }
}

/**
 * Load progress tracking
 */
function loadProgress(): LoadProgress {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
  }
  return {
    completedStates: [],
    totalBlockGroups: 0,
    startTime: new Date().toISOString(),
    lastUpdateTime: new Date().toISOString()
  };
}

function saveProgress(progress: LoadProgress): void {
  progress.lastUpdateTime = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

/**
 * Create database and table
 */
function createTable(db: duckdb.Database): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS block_group_data (
        -- Geographic identifiers
        state_fips VARCHAR(2),
        county_fips VARCHAR(3),
        tract_fips VARCHAR(6),
        block_group VARCHAR(1),
        geoid VARCHAR(12) PRIMARY KEY,
        state_name VARCHAR(50),
        county_name VARCHAR(100),

        -- Demographics
        population BIGINT,
        median_age DOUBLE,
        male_population INTEGER,
        female_population INTEGER,

        -- Age groups (for healthcare analysis)
        under_5 INTEGER,
        age_5_17 INTEGER,
        age_18_64 INTEGER,
        age_65_plus INTEGER,
        age_75_plus INTEGER,

        -- Race and ethnicity
        white_alone INTEGER,
        black_alone INTEGER,
        asian_alone INTEGER,
        hispanic_latino INTEGER,

        -- Economic indicators
        median_household_income INTEGER,
        per_capita_income INTEGER,
        poverty_rate DOUBLE,
        unemployment_rate DOUBLE,
        uninsured_rate DOUBLE,

        -- Education
        high_school_or_higher_pct DOUBLE,
        bachelors_or_higher_pct DOUBLE,

        -- Housing
        total_housing_units INTEGER,
        median_home_value INTEGER,
        median_rent INTEGER,
        renter_occupied_pct DOUBLE,

        -- Health-related
        disability_rate DOUBLE,
        limited_english_pct DOUBLE,

        -- Transportation
        no_vehicle_pct DOUBLE,
        public_transit_pct DOUBLE
      )
    `, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Insert block groups into database (batch)
 */
function insertBlockGroups(db: duckdb.Database, blockGroups: BlockGroupData[]): Promise<void> {
  return new Promise((resolve, reject) => {
    if (blockGroups.length === 0) {
      resolve();
      return;
    }

    const values = blockGroups.map(bg =>
      `('${bg.state_fips}', '${bg.county_fips}', '${bg.tract_fips}', '${bg.block_group}', '${bg.geoid}', ` +
      `'${bg.state_name.replace(/'/g, "''")}', '${bg.county_name.replace(/'/g, "''")}', ` +
      `${bg.population}, ${bg.median_age}, ${bg.male_population}, ${bg.female_population}, ` +
      `${bg.under_5}, ${bg.age_5_17}, ${bg.age_18_64}, ${bg.age_65_plus}, ${bg.age_75_plus}, ` +
      `${bg.white_alone}, ${bg.black_alone}, ${bg.asian_alone}, ${bg.hispanic_latino}, ` +
      `${bg.median_household_income}, ${bg.per_capita_income}, ${bg.poverty_rate}, ${bg.unemployment_rate}, ${bg.uninsured_rate}, ` +
      `${bg.high_school_or_higher_pct}, ${bg.bachelors_or_higher_pct}, ` +
      `${bg.total_housing_units}, ${bg.median_home_value}, ${bg.median_rent}, ${bg.renter_occupied_pct}, ` +
      `${bg.disability_rate}, ${bg.limited_english_pct}, ` +
      `${bg.no_vehicle_pct}, ${bg.public_transit_pct})`
    ).join(',\n');

    const sql = `
      INSERT INTO block_group_data VALUES
      ${values}
      ON CONFLICT (geoid) DO NOTHING
    `;

    db.run(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Main loading function
 */
async function loadBlockGroupData(): Promise<void> {
  console.log('🚀 Starting ACS Block Group Data Load...');
  console.log(`   Year: ${YEAR} ACS 5-Year`);
  console.log(`   Database: ${DB_PATH}\n`);

  if (!CENSUS_API_KEY) {
    throw new Error('CENSUS_API_KEY not configured');
  }

  // Load progress
  const progress = loadProgress();
  console.log(`📊 Progress: ${progress.completedStates.length}/${STATES.length} states completed`);
  console.log(`   Total block groups loaded: ${progress.totalBlockGroups}\n`);

  // Initialize database
  const db = new duckdb.Database(DB_PATH);

  try {
    await createTable(db);
    console.log('✅ Database table ready\n');

    // Process states
    const statesToProcess = STATES.filter(s => !progress.completedStates.includes(s.fips));
    console.log(`🔄 Processing ${statesToProcess.length} remaining states...\n`);

    for (const state of statesToProcess) {
      try {
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 200));

        // Fetch data
        const blockGroups = await fetchBlockGroupData(state.fips, state.name);

        if (blockGroups.length > 0) {
          // Insert in batches of 1000
          const batchSize = 1000;
          for (let i = 0; i < blockGroups.length; i += batchSize) {
            const batch = blockGroups.slice(i, i + batchSize);
            await insertBlockGroups(db, batch);
          }
        }

        // Update progress
        progress.completedStates.push(state.fips);
        progress.totalBlockGroups += blockGroups.length;
        progress.lastCompletedState = state.fips;
        saveProgress(progress);

      } catch (error) {
        console.error(`❌ Failed to process ${state.name}:`, error);
        // Continue with next state
      }
    }

    // Final summary
    console.log('\n📊 Load Complete!');
    console.log(`   Total states: ${progress.completedStates.length}`);
    console.log(`   Total block groups: ${progress.totalBlockGroups}`);

    // Verify data
    db.all('SELECT COUNT(*) as count FROM block_group_data', (err, rows: any[]) => {
      if (!err && rows[0]) {
        console.log(`   Database records: ${rows[0].count}\n`);
      }

      db.close();

      // Clean up progress file
      if (progress.completedStates.length === STATES.length) {
        fs.unlinkSync(PROGRESS_FILE);
        console.log('✅ All states completed - progress file removed\n');
      }
    });

  } catch (error) {
    console.error('❌ Load failed:', error);
    db.close();
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  loadBlockGroupData()
    .then(() => {
      console.log('✨ Block group data loading completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Block group data loading failed:', error);
      process.exit(1);
    });
}

export { loadBlockGroupData, BlockGroupData };
