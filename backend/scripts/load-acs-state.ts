/**
 * ACS State-Level Data Loader
 *
 * Loads 84 variables at state level
 * Geography: State (2-digit FIPS)
 * Total: 51 states (50 + DC)
 *
 * Provides highest-level aggregates for state comparisons
 */

import axios from 'axios';
import * as duckdb from 'duckdb';
import * as path from 'path';
import dotenv from 'dotenv';
import { getVariableCodesBatched } from '../src/utils/acsVariablesExpanded';

dotenv.config();

const CENSUS_API_KEY = process.env.CENSUS_API_KEY;
const CENSUS_API_BASE = 'https://api.census.gov/data';
const YEAR = 2023;
const DB_PATH = path.join(__dirname, '../data/census.duckdb');

interface StateData {
  // Geographic
  state_fips: string;
  geoid: string; // 2-digit state FIPS
  state_name: string;

  // Same 78 analytical variables
  population: number;
  median_age: number;
  male_population: number;
  female_population: number;
  under_5: number;
  age_5_17: number;
  age_18_64: number;
  age_65_plus: number;
  white_alone: number;
  black_alone: number;
  asian_alone: number;
  hispanic_latino: number;
  median_household_income: number;
  per_capita_income: number;
  income_less_10k: number;
  income_10_to_25k: number;
  income_25_to_50k: number;
  income_50_to_75k: number;
  income_75_to_100k: number;
  income_100_to_150k: number;
  income_150_to_200k: number;
  income_200k_plus: number;
  public_assistance_income: number;
  snap_benefits: number;
  retirement_income: number;
  self_employment_earnings: number;
  poverty_rate: number;
  unemployment_rate: number;
  some_high_school_pct: number;
  high_school_grad_pct: number;
  some_college_pct: number;
  bachelors_plus_pct: number;
  total_housing_units: number;
  vacant_units: number;
  median_home_value: number;
  renter_occupied_pct: number;
  rent_burden_50pct: number;
  crowded_housing: number;
  single_family_homes: number;
  mobile_homes: number;
  median_year_built: number;
  with_computer_pct: number;
  with_broadband_pct: number;
  no_internet_pct: number;
  commute_under_10_min: number;
  commute_10_to_19_min: number;
  commute_20_to_29_min: number;
  commute_30_to_44_min: number;
  commute_45_plus_min: number;
  work_from_home: number;
  public_transit_pct: number;
  no_vehicle_transit_pct: number;
  management_occupations_pct: number;
  healthcare_occupations_pct: number;
  retail_sales_pct: number;
  uninsured_rate: number;
  uninsured_under_19: number;
  uninsured_19_to_64: number;
  uninsured_65_plus: number;
  disability_rate: number;
  ambulatory_difficulty_pct: number;
  independent_living_difficulty_pct: number;
  limited_english_pct: number;
  spanish_limited_english_pct: number;
  asian_limited_english_pct: number;
  children_with_2_parents_pct: number;
  children_single_parent_pct: number;
  single_person_households_pct: number;
  seniors_living_alone_pct: number;
  grandparents_responsible_pct: number;
}

const STATE_NAMES: Record<string, string> = {
  '01': 'Alabama', '02': 'Alaska', '04': 'Arizona', '05': 'Arkansas', '06': 'California',
  '08': 'Colorado', '09': 'Connecticut', '10': 'Delaware', '11': 'District of Columbia',
  '12': 'Florida', '13': 'Georgia', '15': 'Hawaii', '16': 'Idaho', '17': 'Illinois',
  '18': 'Indiana', '19': 'Iowa', '20': 'Kansas', '21': 'Kentucky', '22': 'Louisiana',
  '23': 'Maine', '24': 'Maryland', '25': 'Massachusetts', '26': 'Michigan', '27': 'Minnesota',
  '28': 'Mississippi', '29': 'Missouri', '30': 'Montana', '31': 'Nebraska', '32': 'Nevada',
  '33': 'New Hampshire', '34': 'New Jersey', '35': 'New Mexico', '36': 'New York',
  '37': 'North Carolina', '38': 'North Dakota', '39': 'Ohio', '40': 'Oklahoma', '41': 'Oregon',
  '42': 'Pennsylvania', '44': 'Rhode Island', '45': 'South Carolina', '46': 'South Dakota',
  '47': 'Tennessee', '48': 'Texas', '49': 'Utah', '50': 'Vermont', '51': 'Virginia',
  '53': 'Washington', '54': 'West Virginia', '55': 'Wisconsin', '56': 'Wyoming'
};

async function fetchStateDataBatched(): Promise<StateData[]> {
  const [batch1Vars, batch2Vars] = getVariableCodesBatched();

  try {
    console.log('  Fetching all states... (84 variables in 2 batches)\n');

    // Batch 1
    const url1 = `${CENSUS_API_BASE}/${YEAR}/acs/acs5?get=NAME,${batch1Vars.join(',')}&for=state:*&key=${CENSUS_API_KEY}`;
    const response1 = await axios.get(url1, { timeout: 60000 });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Batch 2
    const url2 = `${CENSUS_API_BASE}/${YEAR}/acs/acs5?get=${batch2Vars.join(',')}&for=state:*&key=${CENSUS_API_KEY}`;
    const response2 = await axios.get(url2, { timeout: 60000 });

    if (!response1.data || response1.data.length <= 1) {
      throw new Error('No state data returned from Census API');
    }

    const [headers1, ...rows1] = response1.data;
    const [headers2, ...rows2] = response2.data;

    const states: StateData[] = [];

    for (let i = 0; i < rows1.length; i++) {
      try {
        const row1 = rows1[i];
        const row2 = rows2[i];

        const data1 = Object.fromEntries(headers1.map((h: string, idx: number) => [h, row1[idx]]));
        const data2 = Object.fromEntries(headers2.map((h: string, idx: number) => [h, row2[idx]]));
        const dataMap = { ...data1, ...data2 };

        const parseNum = (key: string, defaultVal = 0): number => {
          const val = parseInt(dataMap[key] || String(defaultVal));
          return isNaN(val) ? defaultVal : val;
        };

        const parsePct = (numeratorKey: string, denominatorKey: string): number => {
          const num = parseNum(numeratorKey);
          const den = parseNum(denominatorKey);
          return den > 0 ? parseFloat(((num / den) * 100).toFixed(2)) : 0;
        };

        const state_fips = dataMap['state'];
        const state_name = STATE_NAMES[state_fips] || dataMap['NAME'] || 'Unknown';
        const geoid = state_fips; // 2-digit GEOID

        const population = parseNum('B01003_001E');
        const under_5 = parseNum('B01001_003E') + parseNum('B01001_027E');
        const age_5_17 = parseNum('B01001_004E') + parseNum('B01001_028E');
        const age_18_64 = parseNum('B01001_007E') + parseNum('B01001_031E');
        const age_65_plus = parseNum('B01001_020E') + parseNum('B01001_044E');

        states.push({
          state_fips, geoid, state_name,

          population, median_age: parseFloat(dataMap['B01002_001E'] || '0'),
          male_population: parseNum('B01001_002E'), female_population: parseNum('B01001_026E'),
          under_5, age_5_17, age_18_64, age_65_plus,
          white_alone: parseNum('B02001_002E'), black_alone: parseNum('B02001_003E'),
          asian_alone: parseNum('B02001_005E'), hispanic_latino: parseNum('B03003_003E'),

          median_household_income: parseNum('B19013_001E'), per_capita_income: parseNum('B19301_001E'),
          income_less_10k: parseNum('B19001_002E'), income_10_to_25k: parseNum('B19001_003E'),
          income_25_to_50k: parseNum('B19001_006E'), income_50_to_75k: parseNum('B19001_011E'),
          income_75_to_100k: parseNum('B19001_012E'), income_100_to_150k: parseNum('B19001_013E'),
          income_150_to_200k: parseNum('B19001_016E'), income_200k_plus: parseNum('B19001_017E'),
          public_assistance_income: parseNum('B19057_002E'), snap_benefits: parseNum('B19058_002E'),
          retirement_income: parseNum('B19059_002E'), self_employment_earnings: parseNum('B19061_002E'),
          poverty_rate: parsePct('B17001_002E', 'B17001_001E'),
          unemployment_rate: parsePct('B23025_005E', 'B23025_002E'),

          some_high_school_pct: parsePct('B15003_017E', 'B15003_001E'),
          high_school_grad_pct: parsePct('B15003_018E', 'B15003_001E'),
          some_college_pct: parsePct('B15003_019E', 'B15003_001E'),
          bachelors_plus_pct: parsePct('B15003_022E', 'B15003_001E'),

          total_housing_units: parseNum('B25001_001E'), vacant_units: parseNum('B25002_003E'),
          median_home_value: parseNum('B25077_001E'),
          renter_occupied_pct: parsePct('B25003_003E', 'B25001_001E'),
          rent_burden_50pct: parseNum('B25070_010E'), crowded_housing: parseNum('B25014_005E'),
          single_family_homes: parseNum('B25024_002E'), mobile_homes: parseNum('B25024_010E'),
          median_year_built: parseNum('B25035_001E'),

          with_computer_pct: parsePct('B28002_002E', 'B28002_001E'),
          with_broadband_pct: parsePct('B28003_002E', 'B28003_001E'),
          no_internet_pct: parsePct('B28003_006E', 'B28003_001E'),

          commute_under_10_min: parseNum('B08303_002E'), commute_10_to_19_min: parseNum('B08303_003E'),
          commute_20_to_29_min: parseNum('B08303_004E'), commute_30_to_44_min: parseNum('B08303_008E'),
          commute_45_plus_min: parseNum('B08303_011E') + parseNum('B08303_012E'),
          work_from_home: parseNum('B08303_013E'),
          public_transit_pct: parsePct('B08301_010E', 'B08301_001E'),
          no_vehicle_transit_pct: parsePct('B08134_061E', 'B08134_001E'),

          management_occupations_pct: parsePct('C24010_003E', 'C24010_001E'),
          healthcare_occupations_pct: parsePct('C24010_030E', 'C24010_001E'),
          retail_sales_pct: parsePct('C24010_037E', 'C24010_001E'),

          uninsured_rate: parsePct('B27010_017E', 'B27010_001E'),
          uninsured_under_19: parseNum('B27010_017E'), uninsured_19_to_64: parseNum('B27010_033E'),
          uninsured_65_plus: parseNum('B27010_050E'),
          disability_rate: parsePct('B18135_011E', 'B18135_001E'),
          ambulatory_difficulty_pct: parsePct('B18135_011E', 'B18135_001E'),
          independent_living_difficulty_pct: parsePct('B18135_016E', 'B18135_001E'),

          limited_english_pct: parsePct('B16005_001E', population.toString()),
          spanish_limited_english_pct: parsePct('B16005_007E', 'B16005_001E'),
          asian_limited_english_pct: parsePct('B16005_012E', 'B16005_001E'),

          children_with_2_parents_pct: parsePct('B09001_003E', 'B09001_001E'),
          children_single_parent_pct: parsePct('B09001_004E', 'B09001_001E'),
          single_person_households_pct: parsePct('B11001_006E', 'B11001_001E'),
          seniors_living_alone_pct: parsePct('B11001_007E', 'B11001_001E'),
          grandparents_responsible_pct: parsePct('B11007_002E', 'B11007_001E')
        });

        console.log(`  ✅ ${state_name}`);

      } catch (error) {
        console.error(`  Error parsing state row ${i}:`, error);
        continue;
      }
    }

    console.log(`\n  ✅ Total: ${states.length} states loaded`);
    return states;

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`  ❌ API error:`, error.response?.status, error.message);
    } else {
      console.error(`  ❌ Error fetching states:`, error);
    }
    throw error;
  }
}

function createTable(db: duckdb.Database): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS state_data (
        -- Geographic (2-digit GEOID)
        state_fips VARCHAR(2),
        geoid VARCHAR(2) PRIMARY KEY,
        state_name VARCHAR(50),

        -- Same 78 analytical variables as other levels
        population BIGINT, median_age DOUBLE, male_population INTEGER, female_population INTEGER,
        under_5 INTEGER, age_5_17 INTEGER, age_18_64 INTEGER, age_65_plus INTEGER,
        white_alone INTEGER, black_alone INTEGER, asian_alone INTEGER, hispanic_latino INTEGER,
        median_household_income INTEGER, per_capita_income INTEGER,
        income_less_10k INTEGER, income_10_to_25k INTEGER, income_25_to_50k INTEGER,
        income_50_to_75k INTEGER, income_75_to_100k INTEGER, income_100_to_150k INTEGER,
        income_150_to_200k INTEGER, income_200k_plus INTEGER,
        public_assistance_income INTEGER, snap_benefits INTEGER, retirement_income INTEGER, self_employment_earnings INTEGER,
        poverty_rate DOUBLE, unemployment_rate DOUBLE,
        some_high_school_pct DOUBLE, high_school_grad_pct DOUBLE, some_college_pct DOUBLE, bachelors_plus_pct DOUBLE,
        total_housing_units INTEGER, vacant_units INTEGER, median_home_value INTEGER, renter_occupied_pct DOUBLE,
        rent_burden_50pct INTEGER, crowded_housing INTEGER, single_family_homes INTEGER, mobile_homes INTEGER, median_year_built INTEGER,
        with_computer_pct DOUBLE, with_broadband_pct DOUBLE, no_internet_pct DOUBLE,
        commute_under_10_min INTEGER, commute_10_to_19_min INTEGER, commute_20_to_29_min INTEGER,
        commute_30_to_44_min INTEGER, commute_45_plus_min INTEGER, work_from_home INTEGER,
        public_transit_pct DOUBLE, no_vehicle_transit_pct DOUBLE,
        management_occupations_pct DOUBLE, healthcare_occupations_pct DOUBLE, retail_sales_pct DOUBLE,
        uninsured_rate DOUBLE, uninsured_under_19 INTEGER, uninsured_19_to_64 INTEGER, uninsured_65_plus INTEGER,
        disability_rate DOUBLE, ambulatory_difficulty_pct DOUBLE, independent_living_difficulty_pct DOUBLE,
        limited_english_pct DOUBLE, spanish_limited_english_pct DOUBLE, asian_limited_english_pct DOUBLE,
        children_with_2_parents_pct DOUBLE, children_single_parent_pct DOUBLE,
        single_person_households_pct DOUBLE, seniors_living_alone_pct DOUBLE, grandparents_responsible_pct DOUBLE
      )
    `, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function insertStates(db: duckdb.Database, states: StateData[]): Promise<void> {
  return new Promise((resolve, reject) => {
    if (states.length === 0) {
      resolve();
      return;
    }

    const values = states.map(s => {
      const esc = (str: string) => str.replace(/'/g, "''");
      return `('${s.state_fips}','${s.geoid}','${esc(s.state_name)}',` +
        `${s.population},${s.median_age},${s.male_population},${s.female_population},` +
        `${s.under_5},${s.age_5_17},${s.age_18_64},${s.age_65_plus},` +
        `${s.white_alone},${s.black_alone},${s.asian_alone},${s.hispanic_latino},` +
        `${s.median_household_income},${s.per_capita_income},` +
        `${s.income_less_10k},${s.income_10_to_25k},${s.income_25_to_50k},${s.income_50_to_75k},` +
        `${s.income_75_to_100k},${s.income_100_to_150k},${s.income_150_to_200k},${s.income_200k_plus},` +
        `${s.public_assistance_income},${s.snap_benefits},${s.retirement_income},${s.self_employment_earnings},` +
        `${s.poverty_rate},${s.unemployment_rate},` +
        `${s.some_high_school_pct},${s.high_school_grad_pct},${s.some_college_pct},${s.bachelors_plus_pct},` +
        `${s.total_housing_units},${s.vacant_units},${s.median_home_value},${s.renter_occupied_pct},` +
        `${s.rent_burden_50pct},${s.crowded_housing},${s.single_family_homes},${s.mobile_homes},${s.median_year_built},` +
        `${s.with_computer_pct},${s.with_broadband_pct},${s.no_internet_pct},` +
        `${s.commute_under_10_min},${s.commute_10_to_19_min},${s.commute_20_to_29_min},${s.commute_30_to_44_min},` +
        `${s.commute_45_plus_min},${s.work_from_home},${s.public_transit_pct},${s.no_vehicle_transit_pct},` +
        `${s.management_occupations_pct},${s.healthcare_occupations_pct},${s.retail_sales_pct},` +
        `${s.uninsured_rate},${s.uninsured_under_19},${s.uninsured_19_to_64},${s.uninsured_65_plus},` +
        `${s.disability_rate},${s.ambulatory_difficulty_pct},${s.independent_living_difficulty_pct},` +
        `${s.limited_english_pct},${s.spanish_limited_english_pct},${s.asian_limited_english_pct},` +
        `${s.children_with_2_parents_pct},${s.children_single_parent_pct},${s.single_person_households_pct},` +
        `${s.seniors_living_alone_pct},${s.grandparents_responsible_pct})`;
    }).join(',\n');

    const sql = `INSERT INTO state_data VALUES ${values} ON CONFLICT (geoid) DO NOTHING`;

    db.run(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function loadStateData(): Promise<void> {
  console.log('🚀 Loading ACS State-Level Data (84 variables)...');
  console.log(`   Database: ${DB_PATH}\n`);

  if (!CENSUS_API_KEY) {
    throw new Error('CENSUS_API_KEY not configured');
  }

  const db = new duckdb.Database(DB_PATH);

  try {
    await createTable(db);
    console.log('✅ State table ready\n');

    const states = await fetchStateDataBatched();

    if (states.length > 0) {
      await insertStates(db, states);
    }

    console.log('\n✅ State load complete!');
    console.log(`   Total: ${states.length} states\n`);

    db.close();

  } catch (error) {
    console.error('❌ Load failed:', error);
    db.close();
    throw error;
  }
}

if (require.main === module) {
  loadStateData()
    .then(() => {
      console.log('✨ State data loaded successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Load failed:', error);
      process.exit(1);
    });
}

export { loadStateData, StateData };
