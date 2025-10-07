/**
 * ACS Variable Mapping for Healthcare Demographics
 *
 * Maps Census Bureau ACS 5-Year Estimate variables to healthcare-relevant metrics.
 * Variables selected for Medicare eligibility, population health, and healthcare access analysis.
 */

export interface ACSVariable {
  code: string;
  label: string;
  concept: string;
  type: 'estimate' | 'margin_of_error' | 'calculated';
  category: 'population' | 'age' | 'income' | 'health_insurance' | 'healthcare_access' | 'poverty';
}

/**
 * Core ACS variables for healthcare analytics
 * Based on ACS 5-Year Estimates Table Structure
 */
export const ACS_VARIABLES: Record<string, ACSVariable> = {
  // Population
  'B01003_001E': {
    code: 'B01003_001E',
    label: 'Total Population',
    concept: 'TOTAL POPULATION',
    type: 'estimate',
    category: 'population'
  },
  'B01003_001M': {
    code: 'B01003_001M',
    label: 'Total Population Margin of Error',
    concept: 'TOTAL POPULATION',
    type: 'margin_of_error',
    category: 'population'
  },

  // Age - Males 65+
  'B01001_020E': {
    code: 'B01001_020E',
    label: 'Male Population 65-66 years',
    concept: 'SEX BY AGE',
    type: 'estimate',
    category: 'age'
  },
  'B01001_021E': {
    code: 'B01001_021E',
    label: 'Male Population 67-69 years',
    concept: 'SEX BY AGE',
    type: 'estimate',
    category: 'age'
  },
  'B01001_022E': {
    code: 'B01001_022E',
    label: 'Male Population 70-74 years',
    concept: 'SEX BY AGE',
    type: 'estimate',
    category: 'age'
  },
  'B01001_023E': {
    code: 'B01001_023E',
    label: 'Male Population 75-79 years',
    concept: 'SEX BY AGE',
    type: 'estimate',
    category: 'age'
  },
  'B01001_024E': {
    code: 'B01001_024E',
    label: 'Male Population 80-84 years',
    concept: 'SEX BY AGE',
    type: 'estimate',
    category: 'age'
  },
  'B01001_025E': {
    code: 'B01001_025E',
    label: 'Male Population 85 years and over',
    concept: 'SEX BY AGE',
    type: 'estimate',
    category: 'age'
  },

  // Age - Females 65+
  'B01001_044E': {
    code: 'B01001_044E',
    label: 'Female Population 65-66 years',
    concept: 'SEX BY AGE',
    type: 'estimate',
    category: 'age'
  },
  'B01001_045E': {
    code: 'B01001_045E',
    label: 'Female Population 67-69 years',
    concept: 'SEX BY AGE',
    type: 'estimate',
    category: 'age'
  },
  'B01001_046E': {
    code: 'B01001_046E',
    label: 'Female Population 70-74 years',
    concept: 'SEX BY AGE',
    type: 'estimate',
    category: 'age'
  },
  'B01001_047E': {
    code: 'B01001_047E',
    label: 'Female Population 75-79 years',
    concept: 'SEX BY AGE',
    type: 'estimate',
    category: 'age'
  },
  'B01001_048E': {
    code: 'B01001_048E',
    label: 'Female Population 80-84 years',
    concept: 'SEX BY AGE',
    type: 'estimate',
    category: 'age'
  },
  'B01001_049E': {
    code: 'B01001_049E',
    label: 'Female Population 85 years and over',
    concept: 'SEX BY AGE',
    type: 'estimate',
    category: 'age'
  },

  // Income
  'B19013_001E': {
    code: 'B19013_001E',
    label: 'Median Household Income',
    concept: 'MEDIAN HOUSEHOLD INCOME IN THE PAST 12 MONTHS',
    type: 'estimate',
    category: 'income'
  },
  'B19013_001M': {
    code: 'B19013_001M',
    label: 'Median Household Income Margin of Error',
    concept: 'MEDIAN HOUSEHOLD INCOME IN THE PAST 12 MONTHS',
    type: 'margin_of_error',
    category: 'income'
  },
  'B19083_001E': {
    code: 'B19083_001E',
    label: 'Gini Index of Income Inequality',
    concept: 'GINI INDEX OF INCOME INEQUALITY',
    type: 'estimate',
    category: 'income'
  },

  // Poverty
  'B17001_002E': {
    code: 'B17001_002E',
    label: 'Population Below Poverty Level',
    concept: 'POVERTY STATUS IN THE PAST 12 MONTHS BY SEX BY AGE',
    type: 'estimate',
    category: 'poverty'
  },

  // Health Insurance
  'B27001_001E': {
    code: 'B27001_001E',
    label: 'Total Population for Health Insurance Coverage',
    concept: 'HEALTH INSURANCE COVERAGE STATUS BY SEX BY AGE',
    type: 'estimate',
    category: 'health_insurance'
  },
  'B27001_006E': {
    code: 'B27001_006E',
    label: 'Male 65-74 years with health insurance',
    concept: 'HEALTH INSURANCE COVERAGE STATUS BY SEX BY AGE',
    type: 'estimate',
    category: 'health_insurance'
  },
  'B27001_009E': {
    code: 'B27001_009E',
    label: 'Male 75+ years with health insurance',
    concept: 'HEALTH INSURANCE COVERAGE STATUS BY SEX BY AGE',
    type: 'estimate',
    category: 'health_insurance'
  },
  'B27001_034E': {
    code: 'B27001_034E',
    label: 'Female 65-74 years with health insurance',
    concept: 'HEALTH INSURANCE COVERAGE STATUS BY SEX BY AGE',
    type: 'estimate',
    category: 'health_insurance'
  },
  'B27001_037E': {
    code: 'B27001_037E',
    label: 'Female 75+ years with health insurance',
    concept: 'HEALTH INSURANCE COVERAGE STATUS BY SEX BY AGE',
    type: 'estimate',
    category: 'health_insurance'
  },

  // Healthcare Access
  'C24030_003E': {
    code: 'C24030_003E',
    label: 'Healthcare Practitioners and Technical Occupations',
    concept: 'SEX BY INDUSTRY FOR THE CIVILIAN EMPLOYED POPULATION 16 YEARS AND OVER',
    type: 'estimate',
    category: 'healthcare_access'
  }
};

/**
 * Get variable codes as comma-separated string for API requests
 */
export function getVariableCodesString(): string {
  return Object.keys(ACS_VARIABLES).join(',');
}

/**
 * Get variable codes array for API requests
 */
export function getVariableCodes(): string[] {
  return Object.keys(ACS_VARIABLES);
}

/**
 * Get variables by category
 */
export function getVariablesByCategory(category: string): ACSVariable[] {
  return Object.values(ACS_VARIABLES).filter(v => v.category === category);
}

/**
 * Calculate seniors total from age breakdowns
 */
export function calculateSeniorsTotal(data: Record<string, number>): number {
  const maleVars = ['B01001_020E', 'B01001_021E', 'B01001_022E', 'B01001_023E', 'B01001_024E', 'B01001_025E'];
  const femaleVars = ['B01001_044E', 'B01001_045E', 'B01001_046E', 'B01001_047E', 'B01001_048E', 'B01001_049E'];

  const maleSeniors = maleVars.reduce((sum, varCode) => sum + (data[varCode] || 0), 0);
  const femaleSeniors = femaleVars.reduce((sum, varCode) => sum + (data[varCode] || 0), 0);

  return maleSeniors + femaleSeniors;
}

/**
 * Calculate Medicare eligible estimate (65+ population)
 * Using more conservative estimate: 85% of 65+ are Medicare enrolled
 */
export function calculateMedicareEligible(seniorsTotal: number): number {
  return Math.round(seniorsTotal * 0.85);
}

/**
 * Calculate poverty rate
 */
export function calculatePovertyRate(povertyPop: number, totalPop: number): number {
  if (totalPop === 0) return 0;
  return Math.round((povertyPop / totalPop) * 10000) / 100; // 2 decimal places
}

/**
 * Calculate insurance coverage rate
 */
export function calculateInsuranceCoverageRate(insured: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((insured / total) * 10000) / 100; // 2 decimal places
}

/**
 * Calculate healthcare practitioners per 1000 population
 */
export function calculatePractitionersPerThousand(practitioners: number, totalPop: number): number {
  if (totalPop === 0) return 0;
  return Math.round((practitioners / totalPop) * 1000 * 100) / 100; // 2 decimal places
}

/**
 * Calculate Medicare penetration rate (% of seniors enrolled)
 */
export function calculateMedicarePenetrationRate(medicareEligible: number, seniorsTotal: number): number {
  if (seniorsTotal === 0) return 0;
  return Math.round((medicareEligible / seniorsTotal) * 10000) / 100; // 2 decimal places
}

/**
 * Calculate seniors with insurance
 */
export function calculateSeniorsWithInsurance(data: Record<string, number>): number {
  const insuredVars = ['B27001_006E', 'B27001_009E', 'B27001_034E', 'B27001_037E'];
  return insuredVars.reduce((sum, varCode) => sum + (data[varCode] || 0), 0);
}

/**
 * All US state codes (50 states + DC + PR)
 */
export const US_STATE_CODES = [
  '01', '02', '04', '05', '06', '08', '09', '10', '11', '12',
  '13', '15', '16', '17', '18', '19', '20', '21', '22', '23',
  '24', '25', '26', '27', '28', '29', '30', '31', '32', '33',
  '34', '35', '36', '37', '38', '39', '40', '41', '42', '44',
  '45', '46', '47', '48', '49', '50', '51', '53', '54', '55',
  '56', '72' // 72 = Puerto Rico
];

/**
 * State code to name mapping
 */
export const STATE_NAMES: Record<string, string> = {
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
  '53': 'Washington', '54': 'West Virginia', '55': 'Wisconsin', '56': 'Wyoming', '72': 'Puerto Rico'
};

export default {
  ACS_VARIABLES,
  getVariableCodesString,
  getVariableCodes,
  getVariablesByCategory,
  calculateSeniorsTotal,
  calculateMedicareEligible,
  calculatePovertyRate,
  calculateInsuranceCoverageRate,
  calculatePractitionersPerThousand,
  calculateMedicarePenetrationRate,
  calculateSeniorsWithInsurance,
  US_STATE_CODES,
  STATE_NAMES
};