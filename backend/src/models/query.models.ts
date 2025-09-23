import { QueryAnalysis } from '../services/anthropicService';

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
  };
  error?: string;
  suggestions?: string[];
}

export interface QueryErrorResponse {
  success: false;
  message: string;
  error: 'INVALID_INPUT' | 'TIMEOUT' | 'VALIDATION_ERROR' | 'INTERNAL_ERROR';
  suggestions?: string[];
  queryTime?: number;
}