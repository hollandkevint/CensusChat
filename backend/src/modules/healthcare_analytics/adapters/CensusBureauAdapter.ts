/**
 * Census Bureau API Adapter
 * Integration adapter for U.S. Census Bureau public datasets
 */

import {
  BasePublicDatasetAdapter,
  StandardizedDataFormat,
  ConnectionStatus,
  PublicDatasetAdapter
} from '../core/PublicDatasetInterface';

export interface CensusBureauConfig {
  baseUrl?: string;
  apiKey?: string;
  timeout?: number;
  retryAttempts?: number;
  enableCaching?: boolean;
}

export interface CensusApiResponse {
  data: any[][];
  headers: string[];
  metadata?: any;
}

export class CensusBureauAdapter extends BasePublicDatasetAdapter implements PublicDatasetAdapter {
  readonly source = 'census_bureau';
  private config: Required<CensusBureauConfig>;
  private apiKey?: string;

  constructor(config: CensusBureauConfig = {}) {
    super();
    console.log('🏛️ Initializing Census Bureau API Adapter');

    this.config = {
      baseUrl: 'https://api.census.gov/data',
      apiKey: process.env.CENSUS_API_KEY || '',
      timeout: 10000,
      retryAttempts: 3,
      enableCaching: true,
      ...config
    };

    this.apiKey = this.config.apiKey;

    if (!this.apiKey) {
      console.warn('⚠️ No Census API key provided - using public access (rate limited)');
    }
  }

  async connect(): Promise<void> {
    console.log('🔌 Connecting to Census Bureau API...');

    try {
      // Test connection with a simple API call
      const testUrl = `${this.config.baseUrl}/2021/acs/acs5?get=NAME&for=state:01${this.apiKey ? `&key=${this.apiKey}` : ''}`;

      const response = await fetch(testUrl, {
        method: 'GET',
        timeout: this.config.timeout,
        headers: {
          'User-Agent': 'CensusChat-HealthcareAnalytics/1.0',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Census API test failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Census API returned unexpected data format');
      }

      this.connectionStatus = ConnectionStatus.Connected;
      this.lastConnected = new Date();
      console.log('✅ Census Bureau API connection successful');

    } catch (error) {
      this.connectionStatus = ConnectionStatus.Error;
      console.error('❌ Census Bureau API connection failed:', error);
      throw error;
    }
  }

  async query(sqlPattern: string, parameters: any): Promise<any[]> {
    if (this.connectionStatus !== ConnectionStatus.Connected) {
      throw new Error('Census Bureau adapter not connected');
    }

    console.log('📊 Executing Census Bureau query...');
    console.log('🔍 SQL Pattern (will be translated to Census API):', sqlPattern.substring(0, 100) + '...');

    try {
      // Translate SQL-like pattern to Census API call
      const censusQuery = this.translateSqlToCensusApi(sqlPattern, parameters);
      const data = await this.executeCensusQuery(censusQuery);

      console.log(`✅ Census Bureau query successful: ${data.length} records`);
      return data;

    } catch (error) {
      console.error('❌ Census Bureau query failed:', error);
      throw error;
    }
  }

  async transformResults(rawData: any[]): Promise<StandardizedDataFormat> {
    console.log('🔄 Transforming Census Bureau data to standard format...');

    const transformedData = rawData.map(record => ({
      // Standard geographic identifiers
      county: record.county || record.NAME?.split(',')[0]?.trim() || '',
      state: record.state || this.extractStateFromName(record.NAME) || '',

      // Standard demographic fields
      population_total: this.parseNumber(record.B01003_001E) || this.parseNumber(record.population_total) || 0,
      population_65_plus: this.parseNumber(record.B01001_020E) || this.parseNumber(record.population_65_plus) || 0,
      median_household_income: this.parseNumber(record.B19013_001E) || this.parseNumber(record.median_household_income) || 0,

      // Additional Census-specific fields
      total_households: this.parseNumber(record.B11001_001E) || 0,
      median_age: this.parseNumber(record.B01002_001E) || 0,
      poverty_rate: this.parseNumber(record.B17001_002E) ?
        (this.parseNumber(record.B17001_002E) / this.parseNumber(record.B17001_001E)) * 100 : 0,

      // Geographic codes for reference
      state_fips: record.state || '',
      county_fips: record.county || '',
      tract_fips: record.tract || '',

      // Data source metadata
      data_source: 'US_Census_Bureau',
      survey_year: record.survey_year || '2021',
      survey_type: record.survey_type || 'ACS_5_Year'
    }));

    return {
      data: transformedData,
      metadata: {
        source: this.source,
        recordCount: transformedData.length,
        transformedAt: new Date(),
        originalFormat: 'census_api_json'
      }
    };
  }

  private translateSqlToCensusApi(sqlPattern: string, parameters: any): CensusApiQuery {
    // This is a simplified translation - in production, would need comprehensive SQL parsing
    console.log('🔄 Translating SQL pattern to Census API query...');

    // Determine survey based on the SQL pattern content
    const survey = this.determineSurvey(sqlPattern);
    const variables = this.extractRequiredVariables(sqlPattern);
    const geography = this.buildGeographyClause(parameters);

    return {
      dataset: survey.dataset,
      vintage: survey.vintage,
      variables: variables,
      geography: geography,
      predicates: this.buildPredicates(parameters)
    };
  }

  private determineSurvey(sqlPattern: string): { dataset: string; vintage: string } {
    // Default to ACS 5-Year for comprehensive demographic data
    return {
      dataset: '2021/acs/acs5',
      vintage: '2021'
    };
  }

  private extractRequiredVariables(sqlPattern: string): string[] {
    const variables = ['NAME']; // Always include geographic name

    // Map common demographic fields to Census variables
    if (sqlPattern.includes('population_total')) {
      variables.push('B01003_001E'); // Total population
    }

    if (sqlPattern.includes('population_65_plus') || sqlPattern.includes('senior')) {
      variables.push('B01001_020E', 'B01001_021E', 'B01001_044E', 'B01001_045E'); // 65+ by sex
    }

    if (sqlPattern.includes('median_household_income') || sqlPattern.includes('income')) {
      variables.push('B19013_001E'); // Median household income
    }

    if (sqlPattern.includes('household')) {
      variables.push('B11001_001E'); // Total households
    }

    // Age-related variables
    if (sqlPattern.includes('age') || sqlPattern.includes('senior')) {
      variables.push('B01002_001E'); // Median age
    }

    // Poverty-related variables
    if (sqlPattern.includes('poverty') || sqlPattern.includes('income')) {
      variables.push('B17001_001E', 'B17001_002E'); // Poverty status
    }

    return variables;
  }

  private buildGeographyClause(parameters: any): string {
    const geographyType = parameters.geography_type || 'county';
    const geographyCodes = parameters.geography_codes || [];

    switch (geographyType) {
      case 'state':
        if (geographyCodes.length > 0) {
          const stateFips = this.getStateFipsCode(geographyCodes[0]);
          return `for=state:${stateFips}`;
        }
        return 'for=state:*';

      case 'county':
        if (geographyCodes.length > 0 && geographyCodes[0].includes(',')) {
          // Handle "County, State" format
          const [county, state] = geographyCodes[0].split(',').map(s => s.trim());
          const stateFips = this.getStateFipsCode(state);
          return `for=county:*&in=state:${stateFips}`;
        }
        return 'for=county:*';

      case 'all':
      default:
        return 'for=county:*';
    }
  }

  private buildPredicates(parameters: any): string[] {
    // Additional query predicates could be added here
    return [];
  }

  private async executeCensusQuery(query: CensusApiQuery): Promise<any[]> {
    const url = this.buildCensusUrl(query);
    console.log('🌐 Census API URL:', url);

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          timeout: this.config.timeout,
          headers: {
            'User-Agent': 'CensusChat-HealthcareAnalytics/1.0',
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          if (response.status === 429) {
            // Rate limited - wait and retry
            console.warn(`⚠️ Census API rate limited, attempt ${attempt}/${this.config.retryAttempts}`);
            await this.sleep(1000 * attempt);
            continue;
          }

          throw new Error(`Census API error: ${response.status} ${response.statusText}`);
        }

        const rawData = await response.json();
        return this.parseCensusResponse(rawData);

      } catch (error) {
        console.warn(`⚠️ Census query attempt ${attempt} failed:`, error);

        if (attempt === this.config.retryAttempts) {
          throw error;
        }

        await this.sleep(1000 * attempt);
      }
    }

    throw new Error('Census query failed after all retry attempts');
  }

  private buildCensusUrl(query: CensusApiQuery): string {
    const baseUrl = `${this.config.baseUrl}/${query.dataset}`;
    const params = new URLSearchParams();

    params.append('get', query.variables.join(','));
    params.append(query.geography.split('&')[0].split(':')[0], query.geography.split(':')[1]);

    // Handle additional geography constraints
    const geoParts = query.geography.split('&');
    if (geoParts.length > 1) {
      geoParts.slice(1).forEach(part => {
        const [key, value] = part.split(':');
        params.append(key, value);
      });
    }

    if (this.apiKey) {
      params.append('key', this.apiKey);
    }

    return `${baseUrl}?${params.toString()}`;
  }

  private parseCensusResponse(rawData: any[]): any[] {
    if (!Array.isArray(rawData) || rawData.length < 2) {
      return [];
    }

    const headers = rawData[0];
    const dataRows = rawData.slice(1);

    return dataRows.map(row => {
      const record: any = {};
      headers.forEach((header: string, index: number) => {
        record[header] = row[index];
      });
      return record;
    });
  }

  private getStateFipsCode(stateName: string): string {
    // Mapping of state names to FIPS codes (subset for common states)
    const stateFipsCodes: Record<string, string> = {
      'Alabama': '01', 'Alaska': '02', 'Arizona': '04', 'Arkansas': '05',
      'California': '06', 'Colorado': '08', 'Connecticut': '09', 'Delaware': '10',
      'Florida': '12', 'Georgia': '13', 'Hawaii': '15', 'Idaho': '16',
      'Illinois': '17', 'Indiana': '18', 'Iowa': '19', 'Kansas': '20',
      'Kentucky': '21', 'Louisiana': '22', 'Maine': '23', 'Maryland': '24',
      'Massachusetts': '25', 'Michigan': '26', 'Minnesota': '27', 'Mississippi': '28',
      'Missouri': '29', 'Montana': '30', 'Nebraska': '31', 'Nevada': '32',
      'New Hampshire': '33', 'New Jersey': '34', 'New Mexico': '35', 'New York': '36',
      'North Carolina': '37', 'North Dakota': '38', 'Ohio': '39', 'Oklahoma': '40',
      'Oregon': '41', 'Pennsylvania': '42', 'Rhode Island': '44', 'South Carolina': '45',
      'South Dakota': '46', 'Tennessee': '47', 'Texas': '48', 'Utah': '49',
      'Vermont': '50', 'Virginia': '51', 'Washington': '53', 'West Virginia': '54',
      'Wisconsin': '55', 'Wyoming': '56'
    };

    return stateFipsCodes[stateName] || '01'; // Default to Alabama if not found
  }

  private extractStateFromName(name: string | undefined): string {
    if (!name) return '';

    const parts = name.split(',');
    if (parts.length > 1) {
      return parts[parts.length - 1].trim();
    }

    return '';
  }

  private parseNumber(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getSupportedFeatures(): string[] {
    return [
      'demographic_data',
      'economic_indicators',
      'housing_statistics',
      'population_estimates',
      'american_community_survey',
      'decennial_census'
    ];
  }

  async disconnect(): Promise<void> {
    console.log('🔌 Disconnecting from Census Bureau API');
    this.connectionStatus = ConnectionStatus.Disconnected;
    console.log('✅ Census Bureau adapter disconnected');
  }
}

interface CensusApiQuery {
  dataset: string;
  vintage: string;
  variables: string[];
  geography: string;
  predicates: string[];
}