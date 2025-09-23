import { useState, useCallback } from 'react';
import { exportApi, downloadBlob, ExportApiError } from '../lib/api/exportApi';
import { ExportRequest, ExportResponse, ExportProgress } from '../types/export.types';

interface UseExportOptions {
  onSuccess?: (response: ExportResponse) => void;
  onError?: (error: ExportApiError) => void;
  onProgress?: (progress: ExportProgress) => void;
  pollInterval?: number; // milliseconds
  maxRetries?: number;
}

interface UseExportReturn {
  isExporting: boolean;
  progress: ExportProgress | null;
  error: ExportApiError | null;
  exportToExcel: (queryResult: any, options?: Partial<ExportRequest['options']>, queryText?: string) => Promise<void>;
  exportToCSV: (queryResult: any, queryText?: string) => Promise<void>;
  clearError: () => void;
  cancelExport: () => void;
}

export const useExport = (options: UseExportOptions = {}): UseExportReturn => {
  const {
    onSuccess,
    onError,
    onProgress,
    pollInterval = 1000,
    maxRetries = 3
  } = options;

  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<ExportApiError | null>(null);
  const [currentExportId, setCurrentExportId] = useState<string | null>(null);
  const [pollTimeoutId, setPollTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const cancelExport = useCallback(() => {
    if (pollTimeoutId) {
      clearTimeout(pollTimeoutId);
      setPollTimeoutId(null);
    }
    setIsExporting(false);
    setProgress(null);
    setCurrentExportId(null);
  }, [pollTimeoutId]);

  const pollProgress = useCallback(async (exportId: string, retryCount = 0) => {
    try {
      const progressData = await exportApi.getExportProgress(exportId);
      setProgress(progressData);
      onProgress?.(progressData);

      if (progressData.status === 'completed') {
        // Download the file
        try {
          const blob = await exportApi.downloadExportFile(exportId);
          const filename = `CensusChat_Export_${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.xlsx`;
          downloadBlob(blob, filename);

          const mockResponse: ExportResponse = {
            success: true,
            exportId,
            filename,
            downloadUrl: '',
            metadata: {
              rowCount: 0,
              fileSize: blob.size,
              processingTime: 0,
              queryExecutedAt: new Date().toISOString()
            }
          };

          onSuccess?.(mockResponse);
          setIsExporting(false);
          setCurrentExportId(null);
        } catch (downloadError) {
          const exportError = downloadError instanceof ExportApiError 
            ? downloadError 
            : new ExportApiError('Failed to download export file', 'DOWNLOAD_FAILED');
          setError(exportError);
          onError?.(exportError);
          setIsExporting(false);
        }
        return;
      }

      if (progressData.status === 'failed') {
        const exportError = new ExportApiError(
          progressData.error || 'Export failed',
          'EXPORT_FAILED'
        );
        setError(exportError);
        onError?.(exportError);
        setIsExporting(false);
        setCurrentExportId(null);
        return;
      }

      // Continue polling if still processing
      if (progressData.status === 'processing' || progressData.status === 'queued') {
        const timeoutId = setTimeout(() => pollProgress(exportId, 0), pollInterval);
        setPollTimeoutId(timeoutId);
      }

    } catch (error) {
      if (retryCount < maxRetries) {
        // Retry after a short delay
        const timeoutId = setTimeout(() => pollProgress(exportId, retryCount + 1), pollInterval * 2);
        setPollTimeoutId(timeoutId);
      } else {
        const exportError = error instanceof ExportApiError 
          ? error 
          : new ExportApiError('Failed to check export progress', 'PROGRESS_CHECK_FAILED');
        setError(exportError);
        onError?.(exportError);
        setIsExporting(false);
        setCurrentExportId(null);
      }
    }
  }, [onSuccess, onError, onProgress, pollInterval, maxRetries]);

  const exportToExcel = useCallback(async (
    queryResult: any,
    exportOptions: Partial<ExportRequest['options']> = {},
    queryText?: string
  ) => {
    if (isExporting) return;

    setIsExporting(true);
    setError(null);
    setProgress(null);

    try {
      // Validate query result
      if (!queryResult || !queryResult.data || !Array.isArray(queryResult.data)) {
        throw new ExportApiError('Invalid query result data', 'INVALID_DATA');
      }

      if (queryResult.data.length === 0) {
        throw new ExportApiError('No data available for export', 'NO_DATA');
      }

      const request: ExportRequest = {
        queryId: `export-${Date.now()}`,
        format: 'excel',
        options: {
          includeMetadata: true,
          compression: false,
          maxRows: 50000,
          ...exportOptions
        },
        queryResult,
        queryText
      };

      const response = await exportApi.exportToExcel(request);
      setCurrentExportId(response.exportId);

      // Start polling for progress
      pollProgress(response.exportId);

    } catch (error) {
      const exportError = error instanceof ExportApiError 
        ? error 
        : new ExportApiError('Failed to initiate Excel export', 'EXPORT_FAILED');
      setError(exportError);
      onError?.(exportError);
      setIsExporting(false);
    }
  }, [isExporting, pollProgress, onError]);

  const exportToCSV = useCallback(async (queryResult: any, queryText?: string) => {
    if (isExporting) return;

    setIsExporting(true);
    setError(null);
    setProgress(null);

    try {
      // Validate query result
      if (!queryResult || !queryResult.data || !Array.isArray(queryResult.data)) {
        throw new ExportApiError('Invalid query result data', 'INVALID_DATA');
      }

      if (queryResult.data.length === 0) {
        throw new ExportApiError('No data available for export', 'NO_DATA');
      }

      const blob = await exportApi.exportToCSV(queryResult, queryText);
      const filename = `CensusChat_Export_${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.csv`;
      downloadBlob(blob, filename);

      const mockResponse: ExportResponse = {
        success: true,
        exportId: `csv-${Date.now()}`,
        filename,
        downloadUrl: '',
        metadata: {
          rowCount: queryResult.data.length,
          fileSize: blob.size,
          processingTime: 0,
          queryExecutedAt: new Date().toISOString()
        }
      };

      onSuccess?.(mockResponse);
      setIsExporting(false);

    } catch (error) {
      const exportError = error instanceof ExportApiError 
        ? error 
        : new ExportApiError('Failed to export to CSV', 'CSV_EXPORT_FAILED');
      setError(exportError);
      onError?.(exportError);
      setIsExporting(false);
    }
  }, [isExporting, onSuccess, onError]);

  return {
    isExporting,
    progress,
    error,
    exportToExcel,
    exportToCSV,
    clearError,
    cancelExport
  };
};


