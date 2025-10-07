// API request/response types
export interface QueryRequest {
  query: string;
  options?: {
    format?: 'table' | 'chart' | 'export';
    limit?: number;
    includeMetadata?: boolean;
  };
}

export interface QueryResponse {
  success: boolean;
  message: string;
  data?: any[];
  metadata?: {
    queryTime: number;
    totalRecords: number;
    dataSource: string;
    confidenceLevel: number;
    marginOfError: number;
    analysis?: QueryAnalysis;
    dataFreshness?: DataFreshness;
  };
  error?: string;
  suggestions?: string[];
}

// Data freshness types
export interface DataFreshness {
  overallStatus: 'fresh' | 'stale' | 'mixed' | 'error';
  lastGlobalRefresh?: Date;
  relevantDatasets: Array<{
    name: string;
    age: string;
    status: 'fresh' | 'stale' | 'refreshing' | 'error';
  }>;
  recommendations: string[];
}

// Query analysis types (matching backend)
export interface QueryAnalysis {
  intent: 'demographics' | 'geography' | 'comparison' | 'unknown';
  entities: {
    locations?: string[];
    demographics?: string[];
    ageGroups?: string[];
    incomeRanges?: string[];
    insuranceTypes?: string[];
  };
  filters: {
    minAge?: number;
    maxAge?: number;
    minIncome?: number;
    maxIncome?: number;
    state?: string;
    counties?: string[];
    zipCodes?: string[];
  };
  outputFormat: 'table' | 'summary' | 'export';
  confidence: number;
}

// Enhanced message interface for ChatInterface
export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  data?: any[];
  isLoading?: boolean;
  error?: boolean;
  suggestions?: string[];
  metadata?: {
    queryTime?: number;
    totalRecords?: number;
    dataSource?: string;
    analysis?: QueryAnalysis;
    dataFreshness?: DataFreshness;
  };
}