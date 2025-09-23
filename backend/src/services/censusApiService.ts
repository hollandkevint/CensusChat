import axios, { AxiosResponse } from 'axios';
import { config } from '../config';
import fs from 'fs/promises';
import path from 'path';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '../middleware/rateLimiting';
import { getCacheData, setCacheData, isCached } from './cacheService';

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
  private readonly useLiveApi: boolean;
  private knowledgeBase: any = null;
  private isValidated: boolean = false;

  constructor() {
    this.baseUrl = config.api.census.baseUrl;
    this.apiKey = config.api.census.apiKey;
    this.useLiveApi = config.api.census.useLiveApi;

    // Validate configuration on instantiation
    this.validateConfiguration();
  }

  /**
   * Validate Census API configuration and credentials
   */
  private validateConfiguration(): void {
    if (!this.baseUrl) {
      throw new Error('Census API base URL is required');
    }

    if (this.useLiveApi && !this.apiKey) {
      console.warn('⚠️  Live Census API is enabled but no API key provided. Rate limits will apply (500 requests/day).');
    }

    if (this.apiKey && this.apiKey.length < 10) {
      throw new Error('Census API key appears to be invalid (too short)');
    }

    console.log(`✅ Census API Service initialized`);
    console.log(`   Base URL: ${this.baseUrl}`);
    console.log(`   Has API Key: ${!!this.apiKey}`);
    console.log(`   Live API Mode: ${this.useLiveApi}`);
    console.log(`   Rate Limit: ${this.apiKey ? 'Unlimited' : '500 requests/day'}`);

    this.isValidated = true;
  }

  /**
   * Test authentication with Census API endpoints
   */
  async testAuthentication(): Promise<{ authenticated: boolean; message: string; details?: any }> {
    try {
      if (!this.useLiveApi) {
        return {
          authenticated: false,
          message: 'Live API mode is disabled. Using mock/cached data only.'
        };
      }

      // Test with a minimal request to verify credentials
      const testUrl = `${this.baseUrl}/data`;
      const params = new URLSearchParams();

      if (this.apiKey) {
        params.append('key', this.apiKey);
      }

      const response = await axios.get(`${testUrl}?${params.toString()}`, {
        timeout: 5000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'CensusChat/1.0'
        }
      });

      return {
        authenticated: true,
        message: 'Census API authentication successful',
        details: {
          status: response.status,
          hasApiKey: !!this.apiKey,
          rateLimitRemaining: response.headers['x-ratelimit-remaining'],
          rateLimitReset: response.headers['x-ratelimit-reset']
        }
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        let message = 'Census API authentication failed';

        if (status === 401) {
          message = 'Invalid Census API key';
        } else if (status === 429) {
          message = 'Rate limit exceeded';
        } else if (status === 403) {
          message = 'Access forbidden - check API key permissions';
        }

        return {
          authenticated: false,
          message,
          details: {
            status,
            statusText: error.response?.statusText,
            hasApiKey: !!this.apiKey
          }
        };
      }

      return {
        authenticated: false,
        message: `Authentication test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
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
   * Execute Census API query with caching and rate limiting
   */
  async executeQuery(query: CensusQuery, userId?: string): Promise<CensusApiResponse> {
    await this.loadKnowledgeBase();

    // Check cache first
    const cachedResult = await getCacheData(query);
    if (cachedResult) {
      console.log(`📦 Cache hit for query: ${JSON.stringify(query).substring(0, 100)}...`);
      return cachedResult;
    }

    // Check rate limits before making API call (only if using live API)
    if (this.useLiveApi) {
      const systemRateLimitKey = 'census:system';
      const userRateLimitKey = userId ? `census:user:${userId}` : 'census:anonymous';

      // Check system-wide rate limit
      const systemCheck = await checkRateLimit(systemRateLimitKey, RATE_LIMIT_PRESETS.CENSUS_API);
      if (!systemCheck.allowed) {
        throw new Error(`System Census API rate limit exceeded. Resets at ${systemCheck.resetTime.toISOString()}`);
      }

      // Check user-specific rate limit
      const userCheck = await checkRateLimit(userRateLimitKey, RATE_LIMIT_PRESETS.CENSUS_API_PER_USER);
      if (!userCheck.allowed) {
        throw new Error(`User Census API rate limit exceeded. Resets at ${userCheck.resetTime.toISOString()}`);
      }

      console.log(`Rate limit status - System: ${systemCheck.remaining}/${RATE_LIMIT_PRESETS.CENSUS_API.maxRequests}, User: ${userCheck.remaining}/${RATE_LIMIT_PRESETS.CENSUS_API_PER_USER.maxRequests}`);
    }

    const url = this.buildApiUrl(query);
    console.log(`🌐 Making Census API request: ${url}`);

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

      const apiResponse: CensusApiResponse = {
        data: response.data,
        headers,
        rowCount: dataRows.length
      };

      // Cache the response for future use
      const cacheTtl = this.determineCacheTtl(query, apiResponse);
      await setCacheData(query, apiResponse, cacheTtl);

      return apiResponse;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Census API Error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url
        });

        // Handle rate limiting from Census API
        if (error.response?.status === 429) {
          throw new Error('Census Bureau API rate limit exceeded. Please try again later.');
        }

        throw new Error(`Census API request failed: ${error.response?.status} ${error.response?.statusText}`);
      }
      throw error;
    }
  }

  /**
   * Determine appropriate cache TTL based on query characteristics
   */
  private determineCacheTtl(query: CensusQuery, response: CensusApiResponse): number {
    const defaultTtl = config.cache.census.ttl; // 1 hour default

    // Frequently requested data gets longer cache time
    if (response.rowCount > 100) {
      return defaultTtl * 2; // 2 hours for large datasets
    }

    // Recent years get shorter cache (data may be updated)
    const currentYear = new Date().getFullYear();
    const queryYear = parseInt(query.year);
    if (currentYear - queryYear <= 1) {
      return defaultTtl / 2; // 30 minutes for recent data
    }

    // Standard demographic queries get standard cache time
    const hasStandardVars = query.variables.some(v =>
      ['B01003_001E', 'B19013_001E', 'B25001_001E'].includes(v)
    );
    if (hasStandardVars) {
      return defaultTtl * 1.5; // 90 minutes for standard demographics
    }

    return defaultTtl;
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
  getRateLimitInfo(): { hasKey: boolean, dailyLimit: string, liveApiEnabled: boolean, hourlyLimit: number } {
    return {
      hasKey: !!this.apiKey,
      dailyLimit: this.apiKey ? 'Unlimited' : '500 queries per day',
      liveApiEnabled: this.useLiveApi,
      hourlyLimit: config.rateLimits.census.requestsPerHour
    };
  }

  /**
   * Get service configuration status
   */
  getServiceStatus(): {
    configured: boolean;
    authenticated?: boolean;
    mode: 'live' | 'mock';
    configuration: {
      baseUrl: string;
      hasApiKey: boolean;
      useLiveApi: boolean;
      cacheTtl: number;
      hourlyRateLimit: number;
    };
  } {
    return {
      configured: this.isValidated,
      mode: this.useLiveApi ? 'live' : 'mock',
      configuration: {
        baseUrl: this.baseUrl,
        hasApiKey: !!this.apiKey,
        useLiveApi: this.useLiveApi,
        cacheTtl: config.cache.census.ttl,
        hourlyRateLimit: config.rateLimits.census.requestsPerHour
      }
    };
  }

  /**
   * Check if a query is cached
   */
  async checkCache(query: CensusQuery): Promise<{
    cached: boolean;
    remainingTtl?: number;
    cacheKey?: string;
  }> {
    return await isCached(query);
  }
}

// Export singleton instance
export const censusApiService = new CensusApiService();