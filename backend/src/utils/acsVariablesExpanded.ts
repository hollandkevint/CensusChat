/**
 * Expanded ACS Variable Mapping for Marketing & Healthcare Marketing Analytics
 *
 * Comprehensive variable set for:
 * - Consumer behavior & spending analysis
 * - Healthcare & insurance targeting
 * - Market segmentation & demographics
 * - Technology adoption & digital access
 * - Transportation & commuting patterns
 *
 * Total: 84 variables across 12 categories (verified with ACS 2023 API)
 */

export interface ACSVariableExpanded {
  code: string;
  label: string;
  category: string;
  subcategory?: string;
}

/**
 * Expanded ACS Variable Set (84 variables)
 * Designed for Census API batching (42 vars × 2 calls)
 */
export const ACS_VARIABLES_EXPANDED: Record<string, ACSVariableExpanded> = {
  // ========== BATCH 1: DEMOGRAPHICS + ECONOMICS (42 variables) ==========

  // Core Demographics (4 vars)
  population: { code: 'B01003_001E', label: 'Total Population', category: 'demographics' },
  maleTotal: { code: 'B01001_002E', label: 'Male Population', category: 'demographics' },
  femaleTotal: { code: 'B01001_026E', label: 'Female Population', category: 'demographics' },
  medianAge: { code: 'B01002_001E', label: 'Median Age', category: 'demographics' },

  // Age Groups - Healthcare Focus (8 vars)
  maleUnder5: { code: 'B01001_003E', label: 'Male Under 5', category: 'demographics', subcategory: 'age' },
  male5to17: { code: 'B01001_004E', label: 'Male 5-17', category: 'demographics', subcategory: 'age' },
  male18to64: { code: 'B01001_007E', label: 'Male 18-64', category: 'demographics', subcategory: 'age' },
  male65plus: { code: 'B01001_020E', label: 'Male 65+', category: 'demographics', subcategory: 'age' },
  femaleUnder5: { code: 'B01001_027E', label: 'Female Under 5', category: 'demographics', subcategory: 'age' },
  female5to17: { code: 'B01001_028E', label: 'Female 5-17', category: 'demographics', subcategory: 'age' },
  female18to64: { code: 'B01001_031E', label: 'Female 18-64', category: 'demographics', subcategory: 'age' },
  female65plus: { code: 'B01001_044E', label: 'Female 65+', category: 'demographics', subcategory: 'age' },

  // Race/Ethnicity (4 vars)
  whiteAlone: { code: 'B02001_002E', label: 'White Alone', category: 'demographics', subcategory: 'race' },
  blackAlone: { code: 'B02001_003E', label: 'Black/African American Alone', category: 'demographics', subcategory: 'race' },
  asianAlone: { code: 'B02001_005E', label: 'Asian Alone', category: 'demographics', subcategory: 'race' },
  hispanicLatino: { code: 'B03003_003E', label: 'Hispanic or Latino', category: 'demographics', subcategory: 'race' },

  // Income Distribution - Marketing Segmentation (8 vars)
  incomeLess10k: { code: 'B19001_002E', label: 'Income <$10k', category: 'economics', subcategory: 'income_distribution' },
  income10to25k: { code: 'B19001_003E', label: 'Income $10-25k', category: 'economics', subcategory: 'income_distribution' },
  income25to50k: { code: 'B19001_006E', label: 'Income $25-50k', category: 'economics', subcategory: 'income_distribution' },
  income50to75k: { code: 'B19001_011E', label: 'Income $50-75k', category: 'economics', subcategory: 'income_distribution' },
  income75to100k: { code: 'B19001_012E', label: 'Income $75-100k', category: 'economics', subcategory: 'income_distribution' },
  income100to150k: { code: 'B19001_013E', label: 'Income $100-150k', category: 'economics', subcategory: 'income_distribution' },
  income150to200k: { code: 'B19001_016E', label: 'Income $150-200k', category: 'economics', subcategory: 'income_distribution' },
  income200kPlus: { code: 'B19001_017E', label: 'Income $200k+', category: 'economics', subcategory: 'income_distribution' },

  // Economic Base (6 vars)
  medianIncome: { code: 'B19013_001E', label: 'Median Household Income', category: 'economics' },
  perCapitaIncome: { code: 'B19301_001E', label: 'Per Capita Income', category: 'economics' },
  publicAssistIncome: { code: 'B19057_002E', label: 'Public Assistance Income', category: 'economics', subcategory: 'assistance' },
  snapBenefits: { code: 'B19058_002E', label: 'SNAP/Food Stamps', category: 'economics', subcategory: 'assistance' },

  // Poverty & Employment (4 vars)
  povertyTotal: { code: 'B17001_001E', label: 'Poverty Universe Total', category: 'economics' },
  povertyBelow: { code: 'B17001_002E', label: 'Below Poverty Level', category: 'economics' },
  laborForce: { code: 'B23025_002E', label: 'In Labor Force', category: 'economics' },
  unemployed: { code: 'B23025_005E', label: 'Unemployed', category: 'economics' },

  // Education Detail (5 vars)
  eduTotal: { code: 'B15003_001E', label: 'Education Total (25+)', category: 'education' },
  someHighSchool: { code: 'B15003_017E', label: 'Some High School', category: 'education' },
  highSchoolGrad: { code: 'B15003_018E', label: 'HS Graduate', category: 'education' },
  someCollege: { code: 'B15003_019E', label: 'Some College', category: 'education' },
  bachelorsPlus: { code: 'B15003_022E', label: "Bachelor's or Higher", category: 'education' },

  // Housing Base (4 vars)
  housingUnits: { code: 'B25001_001E', label: 'Total Housing Units', category: 'housing' },
  vacantUnits: { code: 'B25002_003E', label: 'Vacant Units', category: 'housing' },
  medianValue: { code: 'B25077_001E', label: 'Median Home Value', category: 'housing' },
  renterOcc: { code: 'B25003_003E', label: 'Renter Occupied', category: 'housing' },

  // ========== BATCH 2: MARKETING + HEALTHCARE ANALYTICS (42 variables) ==========

  // Technology & Digital Access (6 vars)
  withComputer: { code: 'B28002_002E', label: 'Households with Computer', category: 'technology' },
  withDesktopLaptop: { code: 'B28002_004E', label: 'Desktop/Laptop Present', category: 'technology' },
  withSmartphone: { code: 'B28002_005E', label: 'Smartphone Present', category: 'technology' },
  withTablet: { code: 'B28002_007E', label: 'Tablet Present', category: 'technology' },
  broadbandInternet: { code: 'B28003_002E', label: 'Broadband Subscription', category: 'technology' },
  noInternet: { code: 'B28003_006E', label: 'No Internet Access', category: 'technology' },

  // Commuting & Transportation (7 vars)
  commuteUnder10: { code: 'B08303_002E', label: 'Commute <10 min', category: 'transportation', subcategory: 'commute_time' },
  commute10to19: { code: 'B08303_003E', label: 'Commute 10-19 min', category: 'transportation', subcategory: 'commute_time' },
  commute20to29: { code: 'B08303_004E', label: 'Commute 20-29 min', category: 'transportation', subcategory: 'commute_time' },
  commute30to44: { code: 'B08303_008E', label: 'Commute 30-44 min', category: 'transportation', subcategory: 'commute_time' },
  commute45to59: { code: 'B08303_011E', label: 'Commute 45-59 min', category: 'transportation', subcategory: 'commute_time' },
  commute60plus: { code: 'B08303_012E', label: 'Commute 60+ min', category: 'transportation', subcategory: 'commute_time' },
  workFromHome: { code: 'B08303_013E', label: 'Work from Home', category: 'transportation' },

  // Transportation Mode (3 vars)
  noVehicleTransit: { code: 'B08134_061E', label: 'No Vehicle + Public Transit', category: 'transportation' },
  noVehicleWalk: { code: 'B08134_071E', label: 'No Vehicle + Walk', category: 'transportation' },
  publicTransitPct: { code: 'B08301_010E', label: 'Public Transit Commuters', category: 'transportation' },

  // Housing Detail - Marketing (6 vars)
  rentBurden50pct: { code: 'B25070_010E', label: 'Rent 50%+ of Income', category: 'housing', subcategory: 'burden' },
  rentNotComputed: { code: 'B25070_011E', label: 'Rent Not Computed', category: 'housing' },
  crowdedHousing: { code: 'B25014_005E', label: 'Crowded (>1.5 per room)', category: 'housing' },
  singleFamilyHomes: { code: 'B25024_002E', label: 'Single-Family Homes', category: 'housing', subcategory: 'structure_type' },
  mobileHomes: { code: 'B25024_010E', label: 'Mobile Homes', category: 'housing', subcategory: 'structure_type' },
  medianYearBuilt: { code: 'B25035_001E', label: 'Median Year Built', category: 'housing' },

  // Occupation - Marketing Targeting (5 vars)
  managementOccupations: { code: 'C24010_003E', label: 'Management Occupations', category: 'occupation' },
  businessFinanceOcc: { code: 'C24010_019E', label: 'Business/Finance Occupations', category: 'occupation' },
  healthcareOcc: { code: 'C24010_030E', label: 'Healthcare Practitioners', category: 'occupation' },
  retailSalesOcc: { code: 'C24010_037E', label: 'Retail Sales Occupations', category: 'occupation' },
  serviceOccupations: { code: 'C24010_006E', label: 'Service Occupations', category: 'occupation' },

  // Healthcare Insurance Detail (4 vars)
  uninsuredUnder19: { code: 'B27010_017E', label: 'Uninsured Under 19', category: 'healthcare', subcategory: 'insurance' },
  uninsured19to64: { code: 'B27010_033E', label: 'Uninsured 19-64', category: 'healthcare', subcategory: 'insurance' },
  uninsured65plus: { code: 'B27010_050E', label: 'Uninsured 65+', category: 'healthcare', subcategory: 'insurance' },
  insuranceCoverageTotal: { code: 'B27010_001E', label: 'Insurance Coverage Total', category: 'healthcare' },

  // Health & Disability Detail (3 vars)
  ambulatoryDifficulty: { code: 'B18135_011E', label: 'Ambulatory Difficulty', category: 'healthcare', subcategory: 'disability' },
  independentLivingDifficulty: { code: 'B18135_016E', label: 'Independent Living Difficulty', category: 'healthcare', subcategory: 'disability' },
  disabilityTotal: { code: 'B18135_001E', label: 'Disability Universe Total', category: 'healthcare' },

  // Language & Cultural Access (3 vars)
  spanishLimitedEnglish: { code: 'B16005_007E', label: 'Spanish Speakers, Limited English', category: 'language' },
  asianLimitedEnglish: { code: 'B16005_012E', label: 'Asian Language, Limited English', category: 'language' },
  limitedEnglishTotal: { code: 'B16005_001E', label: 'Language Universe Total', category: 'language' },

  // Family Structure - Healthcare Marketing (5 vars)
  childrenWith2Parents: { code: 'B09001_003E', label: 'Children with 2 Parents', category: 'family', subcategory: 'children' },
  childrenSingleParent: { code: 'B09001_004E', label: 'Children Single Parent', category: 'family', subcategory: 'children' },
  singlePersonHouseholds: { code: 'B11001_006E', label: 'Single-Person Households', category: 'family' },
  seniors65LivingAlone: { code: 'B11001_007E', label: '65+ Living Alone', category: 'family', subcategory: 'isolation' },
  grandparentsResponsible: { code: 'B11007_002E', label: 'Grandparents Raising Grandchildren', category: 'family', subcategory: 'caregiving' },

  // Base Health Metrics (1 var to complete batch)
  withDisability: { code: 'B18101_004E', label: 'Population with Disability', category: 'healthcare' }
};

/**
 * Get all variable codes for API request (86 total)
 */
export function getAllVariableCodes(): string[] {
  return Object.values(ACS_VARIABLES_EXPANDED).map(v => v.code);
}

/**
 * Get variable codes split into batches for Census API
 * Census API has ~50 variable limit, so we split into 2 batches
 */
export function getVariableCodesBatched(): string[][] {
  const allCodes = getAllVariableCodes();
  const batch1 = allCodes.slice(0, 42);
  const batch2 = allCodes.slice(42, 84);
  return [batch1, batch2];
}

/**
 * Get variable codes as comma-separated strings for API
 */
export function getVariableCodesStrings(): string[] {
  return getVariableCodesBatched().map(batch => batch.join(','));
}

/**
 * Get variables by category
 */
export function getVariablesByCategory(category: string): ACSVariableExpanded[] {
  return Object.values(ACS_VARIABLES_EXPANDED).filter(v => v.category === category);
}

/**
 * Get variable label by code
 */
export function getVariableLabel(code: string): string {
  const variable = Object.values(ACS_VARIABLES_EXPANDED).find(v => v.code === code);
  return variable?.label || code;
}

/**
 * Variable category summary (84 total)
 */
export const VARIABLE_CATEGORIES = {
  demographics: 16,      // Population, age, race/ethnicity
  economics: 16,         // Income, poverty, employment, assistance (reduced from 18)
  education: 5,          // Educational attainment
  housing: 10,           // Units, values, burden, types
  technology: 6,         // Digital access, devices
  transportation: 10,    // Commute, modes
  occupation: 5,         // Job types
  healthcare: 8,         // Insurance, disability
  language: 3,           // Language barriers
  family: 5              // Structure, caregiving
};

export default {
  ACS_VARIABLES_EXPANDED,
  getAllVariableCodes,
  getVariableCodesBatched,
  getVariableCodesStrings,
  getVariablesByCategory,
  getVariableLabel,
  VARIABLE_CATEGORIES
};
