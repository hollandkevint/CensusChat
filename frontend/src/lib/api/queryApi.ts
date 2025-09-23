// API client for query endpoints
import { QueryRequest, QueryResponse } from '../../types/query.types';

// Use internal URL for server-side calls (SSR/API routes) and public URL for client-side calls
const getApiBaseUrl = () => {
  // Check if we're running on the server side
  if (typeof window === 'undefined') {
    return process.env.INTERNAL_API_URL || 'http://backend:3001';
  }
  // Client-side: use public URL
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
};

export class QueryApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public errorCode?: string,
    public suggestions?: string[]
  ) {
    super(message);
    this.name = 'QueryApiError';
  }
}

export const queryApi = {
  async executeQuery(queryRequest: QueryRequest): Promise<QueryResponse> {
    try {
      const apiBaseUrl = getApiBaseUrl();
      console.log('🔗 API URL:', apiBaseUrl); // Debug logging

      const response = await fetch(`${apiBaseUrl}/api/v1/queries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // TODO: Add JWT authentication header in future stories
        },
        body: JSON.stringify(queryRequest)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new QueryApiError(
          data.message || 'Query failed',
          response.status,
          data.error,
          data.suggestions
        );
      }

      return data;
    } catch (error) {
      if (error instanceof QueryApiError) {
        throw error;
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new QueryApiError(
          'Unable to connect to the server. Please check your connection and try again.',
          0,
          'NETWORK_ERROR'
        );
      }

      throw new QueryApiError(
        'An unexpected error occurred. Please try again.',
        500,
        'UNKNOWN_ERROR'
      );
    }
  }
};