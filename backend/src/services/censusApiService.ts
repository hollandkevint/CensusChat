import axios, { AxiosResponse } from 'axios';
import { config } from '../config';
import fs from 'fs/promises';
import path from 'path';

// Types for Census API responses and queries
export interface CensusApiResponse {
  data: string[][];
  headers: string[];
  rowCount: number;
}

export interface CensusVariable {
  name: string;
  label: string;
  concept?: string;
  type: 'estimate' | 'margin_of_error' | 'percentage' | 'annotation';
}

export interface GeographyLevel {
  code: string;
  name: string;
  summaryLevel: string;
  example: string;
}

export interface CensusQuery {
  dataset: string;
  year: string;
  variables: string[];
  geography: {
    for: string;
    in?: string;
  };
  predicates?: Record<string, string>;
}

export class CensusApiService {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private knowledgeBase: any = null;

  constructor() {
    this.baseUrl = config.api.census.baseUrl;
    this.apiKey = config.api.census.apiKey;
  }

  /**
   * Load Census API knowledge base from JSON file
   */
  private async loadKnowledgeBase(): Promise<void> {
    if (this.knowledgeBase) return;

    try {
      const knowledgePath = path.join(__dirname, '../../data/census-api-knowledge.json');
      const knowledgeData = await fs.readFile(knowledgePath, 'utf-8');
      this.knowledgeBase = JSON.parse(knowledgeData);
    } catch (error) {
      console.error('Failed to load Census API knowledge base:', error);
      throw new Error('Census API knowledge base not available');
    }
  }

  /**
   * Build Census API URL from query parameters
   */
  private buildApiUrl(query: CensusQuery): string {
    let url = `${this.baseUrl}/data/${query.year}/${query.dataset}`;
    
    const params = new URLSearchParams();
    
    // Add variables
    params.append('get', query.variables.join(','));
    
    // Add predicates
    if (query.predicates) {
      Object.entries(query.predicates).forEach(([key, value]) => {
        params.append(key, value);
      });
    }
    
    // Add geography
    params.append('for', query.geography.for);
    if (query.geography.in) {
      params.append('in', query.geography.in);
    }
    
    // Add API key if available
    if (this.apiKey) {
      params.append('key', this.apiKey);
    }
    
    return `${url}?${params.toString()}`;
  }

  /**
   * Execute Census API query
   */
  async executeQuery(query: CensusQuery): Promise<CensusApiResponse> {
    await this.loadKnowledgeBase();
    
    const url = this.buildApiUrl(query);
    console.log(`Executing Census API query: ${url}`);
    
    try {
      const response: AxiosResponse<string[][]> = await axios.get(url, {
        timeout: 30000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CensusChat/1.0'
        }
      });
      
      if (!response.data || response.data.length === 0) {
        throw new Error('Empty response from Census API');
      }
      
      const [headers, ...dataRows] = response.data;
      
      return {
        data: response.data,
        headers,
        rowCount: dataRows.length
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Census API Error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url
        });
        throw new Error(`Census API request failed: ${error.response?.status} ${error.response?.statusText}`);
      }
      throw error;
    }
  }

  /**
   * Get ACS 5-Year data for ZIP Code Tabulation Areas
   */
  async getACS5ZipData(state: string = '06', variables?: string[]): Promise<CensusApiResponse> {
    const defaultVariables = [
      'NAME',
      'B01003_001E', // Total Population (Estimate)
      'B01003_001M', // Total Population (Margin of Error)
      'B25001_001E', // Total Housing Units (Estimate)
      'B25001_001M'  // Total Housing Units (Margin of Error)
    ];

    const query: CensusQuery = {
      dataset: 'acs/acs5',
      year: '2022',
      variables: variables || defaultVariables,
      geography: {
        for: 'zip code tabulation area:*',
        in: `state:${state}`
      }
    };

    return this.executeQuery(query);
  }

  /**
   * Get ACS 5-Year data for Census Block Groups
   */
  async getACS5BlockGroupData(state: string = '06', county: string = '075', variables?: string[]): Promise<CensusApiResponse> {
    const defaultVariables = [
      'NAME',
      'B01003_001E', // Total Population (Estimate)
      'B01003_001M', // Total Population (Margin of Error)
      'B25001_001E', // Total Housing Units (Estimate)
      'B25001_001M'  // Total Housing Units (Margin of Error)
    ];

    const query: CensusQuery = {
      dataset: 'acs/acs5',
      year: '2022',
      variables: variables || defaultVariables,
      geography: {
        for: 'block group:*',
        in: `state:${state} county:${county} tract:*`
      }
    };

    return this.executeQuery(query);
  }

  /**
   * Get all counties in a state (useful for block group queries)
   */
  async getCountiesInState(state: string): Promise<CensusApiResponse> {
    const query: CensusQuery = {
      dataset: 'acs/acs5',
      year: '2022',
      variables: ['NAME'],
      geography: {
        for: 'county:*',
        in: `state:${state}`
      }
    };

    return this.executeQuery(query);
  }

  /**
   * Validate variable names against knowledge base
   */
  async validateVariables(variables: string[]): Promise<{ valid: string[], invalid: string[] }> {
    await this.loadKnowledgeBase();
    
    const valid: string[] = [];
    const invalid: string[] = [];
    
    variables.forEach(variable => {
      // Check if it's a known common variable
      if (this.knowledgeBase.commonVariables[variable]) {
        valid.push(variable);
      }
      // Check if it matches ACS variable pattern (e.g., B01003_001E)
      else if (/^[A-Z]\d{5}_\d{3}[EM]$/.test(variable)) {
        valid.push(variable);
      }
      // Check if it's a standard geography/name variable
      else if (['NAME', 'GEO_ID', 'state', 'county', 'tract'].includes(variable)) {
        valid.push(variable);
      }
      else {
        invalid.push(variable);
      }
    });
    
    return { valid, invalid };
  }

  /**
   * Get available datasets from knowledge base
   */
  async getAvailableDatasets(): Promise<any> {
    await this.loadKnowledgeBase();
    return this.knowledgeBase.datasets;
  }

  /**
   * Get geographic levels from knowledge base
   */
  async getGeographicLevels(): Promise<any> {
    await this.loadKnowledgeBase();
    return this.knowledgeBase.geographicLevels;
  }

  /**
   * Get test queries from knowledge base
   */
  async getTestQueries(): Promise<any> {
    await this.loadKnowledgeBase();
    return this.knowledgeBase.testQueries;
  }

  /**
   * Execute a predefined test query
   */
  async executeTestQuery(testName: 'zip5_acs5' | 'blockgroup_acs5'): Promise<CensusApiResponse> {
    await this.loadKnowledgeBase();
    
    const testQuery = this.knowledgeBase.testQueries[testName];
    if (!testQuery) {
      throw new Error(`Test query '${testName}' not found`);
    }

    if (testName === 'zip5_acs5') {
      return this.getACS5ZipData('06', testQuery.variables);
    } else if (testName === 'blockgroup_acs5') {
      return this.getACS5BlockGroupData('06', '075', testQuery.variables);
    }

    throw new Error(`Test query execution not implemented for: ${testName}`);
  }

  /**
   * Get rate limit information
   */
  getRateLimitInfo(): { hasKey: boolean, dailyLimit: string } {
    return {
      hasKey: !!this.apiKey,
      dailyLimit: this.apiKey ? 'Unlimited' : '500 queries per day'
    };
  }
}

// Export singleton instance
export const censusApiService = new CensusApiService();