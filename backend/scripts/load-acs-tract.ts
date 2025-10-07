/**
 * ACS Census Tract Data Loader
 *
 * Loads 84 variables at census tract level
 * Geography: State + County + Tract (11-digit GEOID)
 * Total: ~73,000 census tracts nationwide
 *
 * Tracts provide middle-ground granularity between counties and block groups
 */

import axios from 'axios';
import * as duckdb from 'duckdb';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { getVariableCodesBatched } from '../src/utils/acsVariablesExpanded';

dotenv.config();

const CENSUS_API_KEY = process.env.CENSUS_API_KEY;
const CENSUS_API_BASE = 'https://api.census.gov/data';
const YEAR = 2023;
const DB_PATH = path.join(__dirname, '../data/census.duckdb');
const PROGRESS_FILE = path.join(__dirname, '../data/tract-progress.json');

interface TractData {
  // Geographic
  state_fips: string;
  county_fips: string;
  tract_fips: string;
  geoid: string; // 11-digit: state+county+tract
  state_name: string;
  county_name: string;
  tract_name: string;

  // Same 86 variables as block group (demographics, economics, education, etc.)
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

interface LoadProgress {
  lastCompletedState?: string;
  completedStates: string[];
  totalTracts: number;
  startTime: string;
  lastUpdateTime: string;
}

const STATES = [
  { fips: '01', name: 'Alabama' }, { fips: '02', name: 'Alaska' }, { fips: '04', name: 'Arizona' },
  { fips: '05', name: 'Arkansas' }, { fips: '06', name: 'California' }, { fips: '08', name: 'Colorado' },
  { fips: '09', name: 'Connecticut' }, { fips: '10', name: 'Delaware' }, { fips: '11', name: 'District of Columbia' },
  { fips: '12', name: 'Florida' }, { fips: '13', name: 'Georgia' }, { fips: '15', name: 'Hawaii' },
  { fips: '16', name: 'Idaho' }, { fips: '17', name: 'Illinois' }, { fips: '18', name: 'Indiana' },
  { fips: '19', name: 'Iowa' }, { fips: '20', name: 'Kansas' }, { fips: '21', name: 'Kentucky' },
  { fips: '22', name: 'Louisiana' }, { fips: '23', name: 'Maine' }, { fips: '24', name: 'Maryland' },
  { fips: '25', name: 'Massachusetts' }, { fips: '26', name: 'Michigan' }, { fips: '27', name: 'Minnesota' },
  { fips: '28', name: 'Mississippi' }, { fips: '29', name: 'Missouri' }, { fips: '30', name: 'Montana' },
  { fips: '31', name: 'Nebraska' }, { fips: '32', name: 'Nevada' }, { fips: '33', name: 'New Hampshire' },
  { fips: '34', name: 'New Jersey' }, { fips: '35', name: 'New Mexico' }, { fips: '36', name: 'New York' },
  { fips: '37', name: 'North Carolina' }, { fips: '38', name: 'North Dakota' }, { fips: '39', name: 'Ohio' },
  { fips: '40', name: 'Oklahoma' }, { fips: '41', name: 'Oregon' }, { fips: '42', name: 'Pennsylvania' },
  { fips: '44', name: 'Rhode Island' }, { fips: '45', name: 'South Carolina' }, { fips: '46', name: 'South Dakota' },
  { fips: '47', name: 'Tennessee' }, { fips: '48', name: 'Texas' }, { fips: '49', name: 'Utah' },
  { fips: '50', name: 'Vermont' }, { fips: '51', name: 'Virginia' }, { fips: '53', name: 'Washington' },
  { fips: '54', name: 'West Virginia' }, { fips: '55', name: 'Wisconsin' }, { fips: '56', name: 'Wyoming' }
];

async function fetchTractDataBatched(stateFips: string, stateName: string): Promise<TractData[]> {
  const [batch1Vars, batch2Vars] = getVariableCodesBatched();

  try {
    console.log(`  Fetching ${stateName} tracts... (84 variables)`);

    // Batch 1
    const url1 = `${CENSUS_API_BASE}/${YEAR}/acs/acs5?get=NAME,${batch1Vars.join(',')}&for=tract:*&in=state:${stateFips}%20county:*&key=${CENSUS_API_KEY}`;
    const response1 = await axios.get(url1, { timeout: 60000 });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Batch 2
    const url2 = `${CENSUS_API_BASE}/${YEAR}/acs/acs5?get=${batch2Vars.join(',')}&for=tract:*&in=state:${stateFips}%20county:*&key=${CENSUS_API_KEY}`;
    const response2 = await axios.get(url2, { timeout: 60000 });

    if (!response1.data || response1.data.length <= 1) {
      console.log(`  ⚠️  No tract data for ${stateName}`);
      return [];
    }

    const [headers1, ...rows1] = response1.data;
    const [headers2, ...rows2] = response2.data;

    const tracts: TractData[] = [];

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

        const name = dataMap['NAME'] || '';
        const tractMatch = name.match(/Census Tract ([^,]+)/i);
        const tract_name = tractMatch ? `Tract ${tractMatch[1]}` : 'Unknown';
        const countyMatch = name.match(/,\s*([^,]+)\s+County/i);
        const county_name = countyMatch ? countyMatch[1] + ' County' : 'Unknown';

        const state_fips = dataMap['state'] || stateFips;
        const county_fips = dataMap['county'] || '000';
        const tract_fips = dataMap['tract'] || '000000';
        const geoid = `${state_fips}${county_fips}${tract_fips}`; // 11-digit

        const population = parseNum('B01003_001E');
        const under_5 = parseNum('B01001_003E') + parseNum('B01001_027E');
        const age_5_17 = parseNum('B01001_004E') + parseNum('B01001_028E');
        const age_18_64 = parseNum('B01001_007E') + parseNum('B01001_031E');
        const age_65_plus = parseNum('B01001_020E') + parseNum('B01001_044E');

        tracts.push({
          state_fips, county_fips, tract_fips, geoid,
          state_name: stateName, county_name, tract_name,

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

      } catch (error) {
        console.error(`  Error parsing tract row ${i}:`, error);
        continue;
      }
    }

    console.log(`  ✅ ${stateName}: ${tracts.length} tracts loaded`);
    return tracts;

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`  ❌ API error for ${stateName}:`, error.response?.status, error.message);
    } else {
      console.error(`  ❌ Error fetching ${stateName}:`, error);
    }
    return [];
  }
}

function loadProgress(): LoadProgress {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
  }
  return {
    completedStates: [],
    totalTracts: 0,
    startTime: new Date().toISOString(),
    lastUpdateTime: new Date().toISOString()
  };
}

function saveProgress(progress: LoadProgress): void {
  progress.lastUpdateTime = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function createTable(db: duckdb.Database): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS tract_data (
        -- Geographic (11-digit GEOID)
        state_fips VARCHAR(2),
        county_fips VARCHAR(3),
        tract_fips VARCHAR(6),
        geoid VARCHAR(11) PRIMARY KEY,
        state_name VARCHAR(50),
        county_name VARCHAR(100),
        tract_name VARCHAR(100),

        -- Same 78 analytical variables as block group
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

function insertTracts(db: duckdb.Database, tracts: TractData[]): Promise<void> {
  return new Promise((resolve, reject) => {
    if (tracts.length === 0) {
      resolve();
      return;
    }

    const values = tracts.map(t => {
      const esc = (s: string) => s.replace(/'/g, "''");
      return `('${t.state_fips}','${t.county_fips}','${t.tract_fips}','${t.geoid}',` +
        `'${esc(t.state_name)}','${esc(t.county_name)}','${esc(t.tract_name)}',` +
        `${t.population},${t.median_age},${t.male_population},${t.female_population},` +
        `${t.under_5},${t.age_5_17},${t.age_18_64},${t.age_65_plus},` +
        `${t.white_alone},${t.black_alone},${t.asian_alone},${t.hispanic_latino},` +
        `${t.median_household_income},${t.per_capita_income},` +
        `${t.income_less_10k},${t.income_10_to_25k},${t.income_25_to_50k},${t.income_50_to_75k},` +
        `${t.income_75_to_100k},${t.income_100_to_150k},${t.income_150_to_200k},${t.income_200k_plus},` +
        `${t.public_assistance_income},${t.snap_benefits},${t.retirement_income},${t.self_employment_earnings},` +
        `${t.poverty_rate},${t.unemployment_rate},` +
        `${t.some_high_school_pct},${t.high_school_grad_pct},${t.some_college_pct},${t.bachelors_plus_pct},` +
        `${t.total_housing_units},${t.vacant_units},${t.median_home_value},${t.renter_occupied_pct},` +
        `${t.rent_burden_50pct},${t.crowded_housing},${t.single_family_homes},${t.mobile_homes},${t.median_year_built},` +
        `${t.with_computer_pct},${t.with_broadband_pct},${t.no_internet_pct},` +
        `${t.commute_under_10_min},${t.commute_10_to_19_min},${t.commute_20_to_29_min},${t.commute_30_to_44_min},` +
        `${t.commute_45_plus_min},${t.work_from_home},${t.public_transit_pct},${t.no_vehicle_transit_pct},` +
        `${t.management_occupations_pct},${t.healthcare_occupations_pct},${t.retail_sales_pct},` +
        `${t.uninsured_rate},${t.uninsured_under_19},${t.uninsured_19_to_64},${t.uninsured_65_plus},` +
        `${t.disability_rate},${t.ambulatory_difficulty_pct},${t.independent_living_difficulty_pct},` +
        `${t.limited_english_pct},${t.spanish_limited_english_pct},${t.asian_limited_english_pct},` +
        `${t.children_with_2_parents_pct},${t.children_single_parent_pct},${t.single_person_households_pct},` +
        `${t.seniors_living_alone_pct},${t.grandparents_responsible_pct})`;
    }).join(',\n');

    const sql = `INSERT INTO tract_data VALUES ${values} ON CONFLICT (geoid) DO NOTHING`;

    db.run(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function loadTractData(): Promise<void> {
  console.log('🚀 Loading ACS Census Tract Data (84 variables)...');
  console.log(`   Database: ${DB_PATH}\n`);

  if (!CENSUS_API_KEY) {
    throw new Error('CENSUS_API_KEY not configured');
  }

  const progress = loadProgress();
  console.log(`📊 Progress: ${progress.completedStates.length}/${STATES.length} states\n`);

  const db = new duckdb.Database(DB_PATH);

  try {
    await createTable(db);
    console.log('✅ Tract table ready\n');

    const statesToProcess = STATES.filter(s => !progress.completedStates.includes(s.fips));
    console.log(`🔄 Processing ${statesToProcess.length} states...\n`);

    for (const state of statesToProcess) {
      try {
        await new Promise(resolve => setTimeout(resolve, 300));

        const tracts = await fetchTractDataBatched(state.fips, state.name);

        if (tracts.length > 0) {
          const batchSize = 500;
          for (let i = 0; i < tracts.length; i += batchSize) {
            const batch = tracts.slice(i, i + batchSize);
            await insertTracts(db, batch);
          }
        }

        progress.completedStates.push(state.fips);
        progress.totalTracts += tracts.length;
        progress.lastCompletedState = state.fips;
        saveProgress(progress);

      } catch (error) {
        console.error(`❌ Failed ${state.name}:`, error);
      }
    }

    console.log('\n✅ Tract load complete!');
    console.log(`   Total: ${progress.totalTracts} tracts\n`);

    db.close();
    if (progress.completedStates.length === STATES.length) {
      fs.unlinkSync(PROGRESS_FILE);
    }

  } catch (error) {
    console.error('❌ Load failed:', error);
    db.close();
    throw error;
  }
}

if (require.main === module) {
  loadTractData()
    .then(() => {
      console.log('✨ Census tract data loaded!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Load failed:', error);
      process.exit(1);
    });
}

export { loadTractData, TractData };
