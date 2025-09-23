/**
 * Mock Census API responses for testing
 */

export const mockStateResponse = {
  data: [
    ['NAME', 'B01003_001E', 'B01003_001M', 'B25001_001E', 'B25001_001M', 'state'],
    ['California', '39538223', '****', '14421230', '26471', '06'],
    ['Texas', '29145505', '****', '11688233', '23151', '48'],
    ['Florida', '21538187', '****', '9921326', '19956', '12'],
    ['New York', '20201249', '****', '8230574', '17068', '36'],
    ['Pennsylvania', '13002700', '****', '5659720', '12248', '42']
  ]
};

export const mockZipCodeResponse = {
  data: [
    ['NAME', 'B01003_001E', 'B01003_001M', 'B25001_001E', 'B25001_001M', 'zip code tabulation area', 'state'],
    ['ZCTA5 90210', '23001', '485', '10234', '156', '90210', '06'],
    ['ZCTA5 94102', '52847', '743', '28465', '298', '94102', '06'],
    ['ZCTA5 94103', '15234', '324', '8945', '145', '94103', '06'],
    ['ZCTA5 94104', '5672', '198', '3421', '89', '94104', '06'],
    ['ZCTA5 94105', '8934', '267', '4832', '112', '94105', '06']
  ]
};

export const mockBlockGroupResponse = {
  data: [
    ['NAME', 'B01003_001E', 'B01003_001M', 'B25001_001E', 'B25001_001M', 'state', 'county', 'tract', 'block group'],
    ['Block Group 1, Census Tract 101, San Francisco County, California', '1234', '89', '567', '23', '06', '075', '010100', '1'],
    ['Block Group 2, Census Tract 101, San Francisco County, California', '2345', '134', '789', '34', '06', '075', '010100', '2'],
    ['Block Group 1, Census Tract 102, San Francisco County, California', '3456', '178', '1234', '56', '06', '075', '010200', '1'],
    ['Block Group 2, Census Tract 102, San Francisco County, California', '4567', '223', '1567', '67', '06', '075', '010200', '2']
  ]
};

export const mockCountyResponse = {
  data: [
    ['NAME', 'B01003_001E', 'B01003_001M', 'B25001_001E', 'B25001_001M', 'state', 'county'],
    ['San Francisco County, California', '873965', '****', '397743', '2140', '06', '075'],
    ['Los Angeles County, California', '10014009', '****', '3664252', '8291', '06', '037'],
    ['Orange County, California', '3186989', '****', '1096366', '3589', '06', '059'],
    ['San Diego County, California', '3298634', '****', '1252777', '3912', '06', '073']
  ]
};

export const mockMetroResponse = {
  data: [
    ['NAME', 'B01003_001E', 'B01003_001M', 'B25001_001E', 'B25001_001M', 'metropolitan statistical area/micropolitan statistical area'],
    ['San Francisco-Oakland-Berkeley, CA Metro Area', '4749008', '****', '1890400', '4234', '41860'],
    ['Los Angeles-Long Beach-Anaheim, CA Metro Area', '13200998', '****', '4618031', '9876', '31080'],
    ['San Jose-Sunnyvale-Santa Clara, CA Metro Area', '1990660', '****', '712852', '2456', '41940'],
    ['San Diego-Chula Vista-Carlsbad, CA Metro Area', '3298634', '****', '1252777', '3912', '41740']
  ]
};

export const mockEmptyResponse = {
  data: [
    ['NAME', 'B01003_001E', 'B01003_001M', 'B25001_001E', 'B25001_001M']
  ]
};

export const mockErrorResponse = {
  error: {
    message: 'error: error: unknown variable \'B99999_999E\'',
    details: 'The variable B99999_999E is not available for this dataset'
  }
};

export const mockRateLimitResponse = {
  error: {
    message: 'Your request frequency has exceeded the allowed limit.',
    details: 'Rate limit exceeded for API key or IP address'
  }
};

/**
 * Helper function to create Census API response structure
 */
export function createMockCensusResponse(
  headers: string[], 
  rows: string[][]
): { data: string[][]; headers: string[]; rowCount: number } {
  const data = [headers, ...rows];
  return {
    data,
    headers,
    rowCount: rows.length
  };
}

/**
 * Generate mock data for testing different scenarios
 */
export const mockDataScenarios = {
  // Small dataset for unit tests
  small: createMockCensusResponse(
    ['NAME', 'B01003_001E', 'state'],
    [
      ['California', '39538223', '06'],
      ['Texas', '29145505', '48'],
      ['Florida', '21538187', '12']
    ]
  ),
  
  // Large dataset for performance tests
  large: createMockCensusResponse(
    ['NAME', 'B01003_001E', 'B25001_001E', 'zip code tabulation area', 'state'],
    Array.from({ length: 1000 }, (_, i) => [
      `ZCTA5 ${String(10000 + i).padStart(5, '0')}`,
      String(Math.floor(Math.random() * 50000)),
      String(Math.floor(Math.random() * 20000)),
      String(10000 + i).padStart(5, '0'),
      '06'
    ])
  ),
  
  // Data with validation issues
  invalidData: createMockCensusResponse(
    ['NAME', 'B01003_001E', 'B25001_001E', 'state'],
    [
      ['Valid State', '1000000', '500000', '06'],
      ['', 'invalid_number', '400000', '48'], // Missing name, invalid number
      ['Another State', '-1000', '', '12'], // Negative number, missing data
      ['State with Outlier', '999999999', '1', '36'] // Extreme outlier
    ]
  ),
  
  // Empty data scenario
  empty: createMockCensusResponse(
    ['NAME', 'B01003_001E', 'state'],
    []
  )
};

/**
 * Mock Census API service for testing
 */
export class MockCensusApiService {
  private shouldFail: boolean = false;
  private failureType: 'network' | 'rate_limit' | 'invalid_data' = 'network';
  private responseDelay: number = 0;
  
  setFailure(fail: boolean, type: 'network' | 'rate_limit' | 'invalid_data' = 'network'): void {
    this.shouldFail = fail;
    this.failureType = type;
  }
  
  setDelay(ms: number): void {
    this.responseDelay = ms;
  }
  
  async executeQuery(query: any): Promise<any> {
    if (this.responseDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.responseDelay));
    }
    
    if (this.shouldFail) {
      switch (this.failureType) {
        case 'rate_limit':
          throw new Error('Census API request failed: 429 Too Many Requests');
        case 'invalid_data':
          throw new Error('Census API request failed: 400 Bad Request');
        default:
          throw new Error('Network error: ECONNREFUSED');
      }
    }
    
    // Return appropriate mock based on query
    if (query.geography?.for?.includes('state')) {
      return mockStateResponse;
    } else if (query.geography?.for?.includes('zip code')) {
      return mockZipCodeResponse;
    } else if (query.geography?.for?.includes('block group')) {
      return mockBlockGroupResponse;
    } else if (query.geography?.for?.includes('county')) {
      return mockCountyResponse;
    }
    
    return mockStateResponse; // Default
  }
  
  async getACS5StateData(variables?: string[]): Promise<any> {
    return this.executeQuery({
      geography: { for: 'state:*' },
      variables: variables || ['NAME', 'B01003_001E']
    });
  }
  
  async getACS5ZipData(state: string, variables?: string[]): Promise<any> {
    return this.executeQuery({
      geography: { for: 'zip code tabulation area:*', in: `state:${state}` },
      variables: variables || ['NAME', 'B01003_001E']
    });
  }
  
  async getACS5BlockGroupData(state: string, county: string, variables?: string[]): Promise<any> {
    return this.executeQuery({
      geography: { for: 'block group:*', in: `state:${state} county:${county} tract:*` },
      variables: variables || ['NAME', 'B01003_001E']
    });
  }
  
  async getACS5CountyData(state: string, variables?: string[]): Promise<any> {
    return this.executeQuery({
      geography: { for: 'county:*', in: `state:${state}` },
      variables: variables || ['NAME', 'B01003_001E']
    });
  }
}

export const mockCensusApiService = new MockCensusApiService();