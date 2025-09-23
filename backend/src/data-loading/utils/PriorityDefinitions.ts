import { GeographyLevel, GeographySpec } from './LoadingTypes';

/**
 * Business-value based priority definitions for Census data loading
 * Based on user demand analysis and revenue optimization
 */

export const GEOGRAPHY_PRIORITIES: Record<GeographyLevel, number> = {
  metro: 100,     // Highest: 80% of premium users in metros
  state: 90,      // High: Essential for comparisons and policy analysis
  county: 70,     // Medium-High: Regional analysis
  zcta: 60,       // Medium: ZIP code analysis popular
  place: 50,      // Medium: City-level data
  tract: 30,      // Low-Medium: Detailed local analysis
  block_group: 20, // Low: Very detailed analysis
  nation: 95,     // High: National overview essential
};

export const VARIABLE_PRIORITIES: Record<string, { priority: number; category: string; description: string }> = {
  // Core Demographics (Highest Priority - 90+)
  'B01003_001E': { priority: 100, category: 'core', description: 'Total Population' },
  'B25001_001E': { priority: 95, category: 'core', description: 'Total Housing Units' },
  'B19013_001E': { priority: 95, category: 'core', description: 'Median Household Income' },
  
  // Essential Demographics (High Priority - 80-89)
  'B01001_001E': { priority: 85, category: 'demographics', description: 'Total Population by Age/Sex' },
  'B02001_001E': { priority: 85, category: 'demographics', description: 'Race and Ethnicity' },
  'B15003_001E': { priority: 80, category: 'demographics', description: 'Educational Attainment' },
  
  // Economic Indicators (High Priority - 75-85)
  'B23025_001E': { priority: 85, category: 'economics', description: 'Employment Status' },
  'B17001_001E': { priority: 80, category: 'economics', description: 'Poverty Status' },
  'B08303_001E': { priority: 75, category: 'economics', description: 'Travel Time to Work' },
  'B25077_001E': { priority: 80, category: 'housing', description: 'Median Home Value' },
  
  // Housing Characteristics (Medium-High - 65-75)
  'B25003_001E': { priority: 75, category: 'housing', description: 'Tenure (Own/Rent)' },
  'B25010_001E': { priority: 70, category: 'housing', description: 'Average Household Size' },
  'B25064_001E': { priority: 65, category: 'housing', description: 'Median Gross Rent' },
  
  // Additional Demographics (Medium - 50-65)
  'B08301_001E': { priority: 60, category: 'transportation', description: 'Means of Transportation to Work' },
  'B12001_001E': { priority: 55, category: 'demographics', description: 'Marital Status' },
  'B11001_001E': { priority: 55, category: 'demographics', description: 'Household Type' },
  
  // Specialized Variables (Lower Priority - 30-50)
  'B27001_001E': { priority: 45, category: 'health', description: 'Health Insurance Coverage' },
  'B24010_001E': { priority: 40, category: 'economics', description: 'Occupation' },
  'B09001_001E': { priority: 35, category: 'demographics', description: 'Population Under 18' },
};

// Top 50 Metro Areas by Economic Impact and User Demand
export const PRIORITY_METRO_AREAS = [
  { name: 'New York-Newark-Jersey City, NY-NJ-PA', cbsa: '35620', priority: 100 },
  { name: 'Los Angeles-Long Beach-Anaheim, CA', cbsa: '31080', priority: 95 },
  { name: 'Chicago-Naperville-Elgin, IL-IN-WI', cbsa: '16980', priority: 90 },
  { name: 'Dallas-Fort Worth-Arlington, TX', cbsa: '19100', priority: 85 },
  { name: 'Houston-The Woodlands-Sugar Land, TX', cbsa: '26420', priority: 85 },
  { name: 'Washington-Arlington-Alexandria, DC-VA-MD-WV', cbsa: '47900', priority: 90 },
  { name: 'Philadelphia-Camden-Wilmington, PA-NJ-DE-MD', cbsa: '37980', priority: 80 },
  { name: 'Miami-Fort Lauderdale-Pompano Beach, FL', cbsa: '33100', priority: 80 },
  { name: 'Atlanta-Sandy Springs-Alpharetta, GA', cbsa: '12060', priority: 75 },
  { name: 'Boston-Cambridge-Newton, MA-NH', cbsa: '14460', priority: 85 },
  { name: 'Phoenix-Mesa-Chandler, AZ', cbsa: '38060', priority: 70 },
  { name: 'San Francisco-Oakland-Berkeley, CA', cbsa: '41860', priority: 95 },
  { name: 'Riverside-San Bernardino-Ontario, CA', cbsa: '40140', priority: 60 },
  { name: 'Detroit-Warren-Dearborn, MI', cbsa: '19820', priority: 65 },
  { name: 'Seattle-Tacoma-Bellevue, WA', cbsa: '42660', priority: 85 },
  { name: 'Minneapolis-St. Paul-Bloomington, MN-WI', cbsa: '33460', priority: 70 },
  { name: 'San Diego-Chula Vista-Carlsbad, CA', cbsa: '41740', priority: 75 },
  { name: 'Tampa-St. Petersburg-Clearwater, FL', cbsa: '45300', priority: 65 },
  { name: 'Denver-Aurora-Lakewood, CO', cbsa: '19740', priority: 75 },
  { name: 'Baltimore-Columbia-Towson, MD', cbsa: '12580', priority: 70 },
  // Add more metros as needed...
];

// Priority States by Economic Impact and Population
export const PRIORITY_STATES = [
  { code: '06', name: 'California', priority: 100 },
  { code: '48', name: 'Texas', priority: 95 },
  { code: '12', name: 'Florida', priority: 90 },
  { code: '36', name: 'New York', priority: 90 },
  { code: '42', name: 'Pennsylvania', priority: 85 },
  { code: '17', name: 'Illinois', priority: 85 },
  { code: '39', name: 'Ohio', priority: 80 },
  { code: '13', name: 'Georgia', priority: 80 },
  { code: '37', name: 'North Carolina', priority: 75 },
  { code: '26', name: 'Michigan', priority: 75 },
  { code: '34', name: 'New Jersey', priority: 80 },
  { code: '53', name: 'Washington', priority: 80 },
  { code: '04', name: 'Arizona', priority: 70 },
  { code: '25', name: 'Massachusetts', priority: 85 },
  { code: '47', name: 'Tennessee', priority: 70 },
  { code: '18', name: 'Indiana', priority: 65 },
  { code: '24', name: 'Maryland', priority: 75 },
  { code: '29', name: 'Missouri', priority: 65 },
  { code: '55', name: 'Wisconsin', priority: 65 },
  { code: '08', name: 'Colorado', priority: 75 },
];

export interface LoadingPhase {
  name: string;
  description: string;
  priority: number;
  estimatedJobs: number;
  estimatedApiCalls: number;
  dependencies?: string[];
  geographies: GeographySpec[];
  variables: string[];
}

export const LOADING_PHASES: LoadingPhase[] = [
  {
    name: 'foundation',
    description: 'Core high-value data for immediate user value',
    priority: 100,
    estimatedJobs: 150,
    estimatedApiCalls: 200,
    geographies: [
      {
        level: 'metro',
        filter: { metros: PRIORITY_METRO_AREAS.slice(0, 20).map(m => m.cbsa) }
      },
      {
        level: 'state',
        codes: PRIORITY_STATES.slice(0, 10).map(s => s.code)
      }
    ],
    variables: Object.keys(VARIABLE_PRIORITIES).filter(v => VARIABLE_PRIORITIES[v].priority >= 80)
  },
  {
    name: 'expansion',
    description: 'Extended coverage for comprehensive analysis',
    priority: 80,
    estimatedJobs: 300,
    estimatedApiCalls: 400,
    dependencies: ['foundation'],
    geographies: [
      {
        level: 'county',
        parentGeography: {
          level: 'state',
          codes: PRIORITY_STATES.slice(0, 15).map(s => s.code)
        }
      },
      {
        level: 'zcta',
        filter: { metros: PRIORITY_METRO_AREAS.slice(0, 30).map(m => m.cbsa) }
      }
    ],
    variables: Object.keys(VARIABLE_PRIORITIES).filter(v => VARIABLE_PRIORITIES[v].priority >= 60)
  },
  {
    name: 'comprehensive',
    description: 'Complete national coverage',
    priority: 60,
    estimatedJobs: 800,
    estimatedApiCalls: 1200,
    dependencies: ['expansion'],
    geographies: [
      {
        level: 'county',
        codes: ['*'] // All counties
      },
      {
        level: 'zcta',
        codes: ['*'] // All ZIP codes
      },
      {
        level: 'place',
        filter: { states: PRIORITY_STATES.map(s => s.code) }
      }
    ],
    variables: Object.keys(VARIABLE_PRIORITIES)
  },
  {
    name: 'detailed',
    description: 'Granular data for advanced analytics',
    priority: 40,
    estimatedJobs: 1500,
    estimatedApiCalls: 3000,
    dependencies: ['comprehensive'],
    geographies: [
      {
        level: 'tract',
        filter: { metros: PRIORITY_METRO_AREAS.slice(0, 20).map(m => m.cbsa) }
      }
    ],
    variables: Object.keys(VARIABLE_PRIORITIES)
  }
];

export function calculateJobPriority(
  geography: GeographySpec,
  variables: string[],
  phase?: string
): number {
  const geographyPriority = GEOGRAPHY_PRIORITIES[geography.level] || 50;
  const variablePriority = variables.reduce((sum, variable) => {
    return sum + (VARIABLE_PRIORITIES[variable]?.priority || 30);
  }, 0) / variables.length;
  
  const phasePriority = phase ? 
    LOADING_PHASES.find(p => p.name === phase)?.priority || 50 : 50;
  
  // Weighted average with geography being most important
  return Math.round(
    geographyPriority * 0.5 + 
    variablePriority * 0.3 + 
    phasePriority * 0.2
  );
}

export function getOptimalBatchSize(geography: GeographyLevel): number {
  const batchSizes: Record<GeographyLevel, number> = {
    nation: 1,      // Only 1 nation
    state: 50,      // All states in one call
    metro: 25,      // Reasonable batch for metros
    county: 50,     // Max variables, process multiple counties
    place: 30,      // Cities/towns batch
    zcta: 40,       // ZIP codes batch
    tract: 20,      // Census tracts (smaller batches)
    block_group: 15, // Block groups (smallest batches)
  };
  
  return batchSizes[geography] || 25;
}

export function getEstimatedRecordCount(geography: GeographyLevel, filterCodes?: string[]): number {
  const baseCounts: Record<GeographyLevel, number> = {
    nation: 1,
    state: 51,        // 50 states + DC
    metro: 384,       // Metropolitan areas
    county: 3143,     // Counties
    place: 19495,     // Places
    zcta: 33120,      // ZIP Code Tabulation Areas
    tract: 74001,     // Census tracts
    block_group: 220740, // Block groups
  };
  
  const baseCount = baseCounts[geography] || 1000;
  
  if (filterCodes && filterCodes.length > 0 && !filterCodes.includes('*')) {
    return Math.min(baseCount, filterCodes.length);
  }
  
  return baseCount;
}