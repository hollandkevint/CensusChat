import axios, { AxiosResponse } from 'axios';
import { ExportRequest, ExportResponse, ExportProgress, ExportError } from '../../types/export.types';

// Use internal URL for server-side calls (SSR/API routes) and public URL for client-side calls
const getApiBaseUrl = () => {
  // Check if we're running on the server side
  if (typeof window === 'undefined') {
    return process.env.INTERNAL_API_URL || 'http://backend:3001';
  }
  // Client-side: use public URL
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
};

export class ExportApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ExportApiError';
  }
}

export const exportApi = {
  /**
   * Export query results to Excel format
   */
  async exportToExcel(request: ExportRequest): Promise<ExportResponse> {
    try {
      const apiBaseUrl = getApiBaseUrl();
      const response: AxiosResponse<ExportResponse> = await axios.post(
        `${apiBaseUrl}/api/v1/export/excel`,
        request,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 120000, // 2 minutes timeout for export initiation
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data;
        throw new ExportApiError(
          errorData?.message || 'Failed to export to Excel',
          errorData?.error || 'EXPORT_FAILED',
          error.response?.status,
          errorData?.details
        );
      }
      throw new ExportApiError('Network error during export', 'NETWORK_ERROR');
    }
  },

  /**
   * Export query results to CSV format (fallback)
   */
  async exportToCSV(queryResult: any, queryText?: string): Promise<Blob> {
    try {
      const response = await axios.post(
        `${getApiBaseUrl()}/api/v1/export/csv`,
        {
          queryResult,
          queryText
        },
        {
          responseType: 'blob',
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 60000, // 1 minute timeout for CSV export
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.status === 413 
          ? 'Dataset too large for export'
          : 'Failed to export to CSV';
        
        throw new ExportApiError(
          errorMessage,
          'CSV_EXPORT_FAILED',
          error.response?.status
        );
      }
      throw new ExportApiError('Network error during CSV export', 'NETWORK_ERROR');
    }
  },

  /**
   * Get export progress status
   */
  async getExportProgress(exportId: string): Promise<ExportProgress> {
    try {
      const response: AxiosResponse<{ success: boolean; progress: ExportProgress }> = await axios.get(
        `${getApiBaseUrl()}/api/v1/export/progress/${exportId}`,
        {
          timeout: 10000, // 10 seconds timeout for progress check
        }
      );

      if (!response.data.success) {
        throw new ExportApiError(
          'Failed to get export progress',
          'PROGRESS_CHECK_FAILED'
        );
      }

      return response.data.progress;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data;
        throw new ExportApiError(
          errorData?.message || 'Failed to check export progress',
          errorData?.error || 'PROGRESS_CHECK_FAILED',
          error.response?.status
        );
      }
      throw new ExportApiError('Network error during progress check', 'NETWORK_ERROR');
    }
  },

  /**
   * Download completed export file
   */
  async downloadExportFile(exportId: string, filename?: string): Promise<Blob> {
    try {
      const response = await axios.get(
        `${getApiBaseUrl()}/api/v1/export/download/${exportId}`,
        {
          responseType: 'blob',
          timeout: 300000, // 5 minutes timeout for large file downloads
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.status === 404 
          ? 'Export file not found or expired'
          : 'Failed to download export file';
        
        throw new ExportApiError(
          errorMessage,
          'DOWNLOAD_FAILED',
          error.response?.status
        );
      }
      throw new ExportApiError('Network error during file download', 'NETWORK_ERROR');
    }
  }
};

/**
 * Utility function to trigger file download in browser
 */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

/**
 * Utility function to format file size
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Utility function to format processing time
 */
export const formatProcessingTime = (seconds: number): string => {
  if (seconds < 1) return '< 1 second';
  if (seconds < 60) return `${Math.round(seconds)} seconds`;
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  
  if (remainingSeconds === 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
  
  return `${minutes}m ${remainingSeconds}s`;
};


