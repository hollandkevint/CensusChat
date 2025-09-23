import { CensusApiResponse, CensusQuery } from './censusApiService';
import { getCacheData } from './cacheService';

/**
 * Fallback strategies for Census API failures
 */
export enum FallbackStrategy {
  CACHE_ONLY = 'cache_only',
  MOCK_DATA = 'mock_data',
  SIMPLIFIED_RESPONSE = 'simplified_response',
  ERROR_RESPONSE = 'error_response'
}

/**
 * Error types for fallback handling
 */
export enum CensusApiErrorType {
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  API_UNAVAILABLE = 'api_unavailable',
  AUTHENTICATION_FAILED = 'authentication_failed',
  INVALID_QUERY = 'invalid_query',
  TIMEOUT = 'timeout',
  NETWORK_ERROR = 'network_error',
  UNKNOWN_ERROR = 'unknown_error'
}

/**
 * Fallback response with metadata
 */
export interface FallbackResponse {
  success: boolean;
  data: any[];
  message: string;
  fallbackStrategy: FallbackStrategy;
  originalError?: string;
  metadata: {
    queryTime: number;
    totalRecords: number;
    dataSource: string;
    confidenceLevel: number;
    marginOfError: number;
    fallbackUsed: boolean;
    errorType?: CensusApiErrorType;
  };
}

/**
 * Census API Fallback Service
 */
export class FallbackService {
  /**
   * Determine error type from error message or status
   */
  static determineErrorType(error: Error | string, statusCode?: number): CensusApiErrorType {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const lowerMessage = errorMessage.toLowerCase();

    if (statusCode === 429 || lowerMessage.includes('rate limit')) {
      return CensusApiErrorType.RATE_LIMIT_EXCEEDED;
    }

    if (statusCode === 401 || statusCode === 403 || lowerMessage.includes('authentication')) {
      return CensusApiErrorType.AUTHENTICATION_FAILED;
    }

    if (statusCode === 400 || lowerMessage.includes('invalid') || lowerMessage.includes('bad request')) {
      return CensusApiErrorType.INVALID_QUERY;
    }

    if (lowerMessage.includes('timeout') || statusCode === 408) {
      return CensusApiErrorType.TIMEOUT;
    }

    if (statusCode === 500 || statusCode === 502 || statusCode === 503 || statusCode === 504) {
      return CensusApiErrorType.API_UNAVAILABLE;
    }

    if (lowerMessage.includes('network') || lowerMessage.includes('connection')) {
      return CensusApiErrorType.NETWORK_ERROR;
    }

    return CensusApiErrorType.UNKNOWN_ERROR;
  }

  /**
   * Determine best fallback strategy based on error type and available options
   */
  static determineFallbackStrategy(
    errorType: CensusApiErrorType,
    hasCachedData: boolean,
    query: CensusQuery
  ): FallbackStrategy {
    switch (errorType) {
      case CensusApiErrorType.RATE_LIMIT_EXCEEDED:
        // For rate limits, prefer cached data if available
        return hasCachedData ? FallbackStrategy.CACHE_ONLY : FallbackStrategy.MOCK_DATA;

      case CensusApiErrorType.API_UNAVAILABLE:
      case CensusApiErrorType.NETWORK_ERROR:
        // For service issues, use cache or mock data
        return hasCachedData ? FallbackStrategy.CACHE_ONLY : FallbackStrategy.MOCK_DATA;

      case CensusApiErrorType.AUTHENTICATION_FAILED:
        // For auth issues, we can still provide mock data
        return FallbackStrategy.MOCK_DATA;

      case CensusApiErrorType.TIMEOUT:
        // For timeouts, try cache first, then simplified response
        return hasCachedData ? FallbackStrategy.CACHE_ONLY : FallbackStrategy.SIMPLIFIED_RESPONSE;

      case CensusApiErrorType.INVALID_QUERY:
        // For invalid queries, provide simplified response with suggestions
        return FallbackStrategy.SIMPLIFIED_RESPONSE;

      default:
        // For unknown errors, use cache if available, otherwise mock
        return hasCachedData ? FallbackStrategy.CACHE_ONLY : FallbackStrategy.MOCK_DATA;
    }
  }

  /**
   * Execute fallback strategy and return appropriate response
   */
  static async executeFallback(
    query: CensusQuery,
    error: Error | string,
    statusCode?: number,
    startTime?: number
  ): Promise<FallbackResponse> {
    const queryTime = startTime ? (Date.now() - startTime) / 1000 : 0;
    const errorType = this.determineErrorType(error, statusCode);

    // Check if we have cached data available
    let cachedData: CensusApiResponse | null = null;
    try {
      cachedData = await getCacheData(query);
    } catch (cacheError) {
      console.warn('Error checking cache during fallback:', cacheError);
    }

    const strategy = this.determineFallbackStrategy(errorType, !!cachedData, query);

    switch (strategy) {
      case FallbackStrategy.CACHE_ONLY:
        return this.createCacheOnlyResponse(cachedData!, queryTime, errorType, error);

      case FallbackStrategy.MOCK_DATA:
        return this.createMockDataResponse(query, queryTime, errorType, error);

      case FallbackStrategy.SIMPLIFIED_RESPONSE:
        return this.createSimplifiedResponse(query, queryTime, errorType, error);

      default:
        return this.createErrorResponse(query, queryTime, errorType, error);
    }
  }

  /**
   * Create response using cached data
   */
  private static createCacheOnlyResponse(
    cachedData: CensusApiResponse,
    queryTime: number,
    errorType: CensusApiErrorType,
    originalError: Error | string
  ): FallbackResponse {
    // Transform cached Census API response to expected format
    const [headers, ...rows] = cachedData.data;
    const transformedData = rows.map((row, idx) => {
      const record: any = {};
      headers.forEach((header, headerIdx) => {
        record[header] = row[headerIdx];
      });
      return record;
    });

    return {
      success: true,
      data: transformedData,
      message: 'Data retrieved from cache due to Census API unavailability',
      fallbackStrategy: FallbackStrategy.CACHE_ONLY,
      originalError: typeof originalError === 'string' ? originalError : originalError.message,
      metadata: {
        queryTime,
        totalRecords: transformedData.length,
        dataSource: 'Redis Cache (Previously from Census Bureau API)',
        confidenceLevel: 0.95,
        marginOfError: 2.3,
        fallbackUsed: true,
        errorType
      }
    };
  }

  /**
   * Create response using mock data
   */
  private static createMockDataResponse(
    query: CensusQuery,
    queryTime: number,
    errorType: CensusApiErrorType,
    originalError: Error | string
  ): FallbackResponse {
    // Generate contextual mock data based on query
    const mockData = this.generateContextualMockData(query);

    return {
      success: true,
      data: mockData,
      message: 'Census API temporarily unavailable. Showing representative sample data.',
      fallbackStrategy: FallbackStrategy.MOCK_DATA,
      originalError: typeof originalError === 'string' ? originalError : originalError.message,
      metadata: {
        queryTime,
        totalRecords: mockData.length,
        dataSource: 'Mock Data (Representative Sample)',
        confidenceLevel: 0.85, // Lower confidence for mock data
        marginOfError: 5.0, // Higher margin for mock data
        fallbackUsed: true,
        errorType
      }
    };
  }

  /**
   * Create simplified response with helpful information
   */
  private static createSimplifiedResponse(
    query: CensusQuery,
    queryTime: number,
    errorType: CensusApiErrorType,
    originalError: Error | string
  ): FallbackResponse {
    return {
      success: false,
      data: [],
      message: this.getErrorMessage(errorType),
      fallbackStrategy: FallbackStrategy.SIMPLIFIED_RESPONSE,
      originalError: typeof originalError === 'string' ? originalError : originalError.message,
      metadata: {
        queryTime,
        totalRecords: 0,
        dataSource: 'None (Error Response)',
        confidenceLevel: 0,
        marginOfError: 0,
        fallbackUsed: true,
        errorType
      }
    };
  }

  /**
   * Create error response
   */
  private static createErrorResponse(
    query: CensusQuery,
    queryTime: number,
    errorType: CensusApiErrorType,
    originalError: Error | string
  ): FallbackResponse {
    return {
      success: false,
      data: [],
      message: 'Census data is temporarily unavailable. Please try again later.',
      fallbackStrategy: FallbackStrategy.ERROR_RESPONSE,
      originalError: typeof originalError === 'string' ? originalError : originalError.message,
      metadata: {
        queryTime,
        totalRecords: 0,
        dataSource: 'None (Service Unavailable)',
        confidenceLevel: 0,
        marginOfError: 0,
        fallbackUsed: true,
        errorType
      }
    };
  }

  /**
   * Generate contextual mock data based on query parameters
   */
  private static generateContextualMockData(query: CensusQuery): any[] {
    // Default healthcare/demographics mock data
    const baseData = [
      { county: 'Miami-Dade', seniors: 486234, income_over_50k: 278445, ma_eligible: 264123 },
      { county: 'Broward', seniors: 312567, income_over_50k: 189234, ma_eligible: 176890 },
      { county: 'Palm Beach', seniors: 278901, income_over_50k: 198567, ma_eligible: 187234 }
    ];

    // Adjust based on geography
    if (query.geography.in?.includes('state:06')) {
      // California counties
      return [
        { county: 'Los Angeles', seniors: 1456234, income_over_50k: 878445, ma_eligible: 764123 },
        { county: 'Orange', seniors: 512567, income_over_50k: 389234, ma_eligible: 276890 },
        { county: 'San Diego', seniors: 478901, income_over_50k: 298567, ma_eligible: 287234 }
      ];
    }

    if (query.geography.in?.includes('state:36')) {
      // New York counties
      return [
        { county: 'Kings', seniors: 456234, income_over_50k: 178445, ma_eligible: 264123 },
        { county: 'Queens', seniors: 412567, income_over_50k: 189234, ma_eligible: 176890 },
        { county: 'New York', seniors: 278901, income_over_50k: 298567, ma_eligible: 187234 }
      ];
    }

    return baseData;
  }

  /**
   * Get user-friendly error message based on error type
   */
  private static getErrorMessage(errorType: CensusApiErrorType): string {
    switch (errorType) {
      case CensusApiErrorType.RATE_LIMIT_EXCEEDED:
        return 'Rate limit exceeded. Please wait a moment before making another request.';

      case CensusApiErrorType.API_UNAVAILABLE:
        return 'Census data service is temporarily unavailable. Please try again in a few minutes.';

      case CensusApiErrorType.AUTHENTICATION_FAILED:
        return 'Authentication issue with Census API. Please contact support if this persists.';

      case CensusApiErrorType.INVALID_QUERY:
        return 'Your query could not be processed. Please try rephrasing or being more specific.';

      case CensusApiErrorType.TIMEOUT:
        return 'Request timed out. Please try a simpler query or try again later.';

      case CensusApiErrorType.NETWORK_ERROR:
        return 'Network connectivity issue. Please check your connection and try again.';

      default:
        return 'An unexpected error occurred. Please try again or contact support if the issue persists.';
    }
  }

  /**
   * Get suggested actions based on error type
   */
  static getSuggestions(errorType: CensusApiErrorType): string[] {
    switch (errorType) {
      case CensusApiErrorType.RATE_LIMIT_EXCEEDED:
        return [
          'Wait a few minutes before making another request',
          'Try using cached data if available',
          'Consider simplifying your query'
        ];

      case CensusApiErrorType.INVALID_QUERY:
        return [
          'Be more specific about geographic areas (e.g., "Florida" instead of "south")',
          'Specify clear age ranges (e.g., "seniors over 65")',
          'Include specific demographics (e.g., "Medicare eligible")',
          'Try asking about population, income, or housing data'
        ];

      case CensusApiErrorType.TIMEOUT:
        return [
          'Try a simpler query with fewer variables',
          'Focus on a smaller geographic area',
          'Break complex queries into smaller parts'
        ];

      default:
        return [
          'Try again in a few minutes',
          'Simplify your query if possible',
          'Contact support if the issue persists'
        ];
    }
  }
}

export { FallbackService };