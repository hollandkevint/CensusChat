import type { QueryDataRow } from './query.types';

// Shape of the query result payload accepted by the export APIs
export interface ExportQueryResult {
  success: boolean;
  data: QueryDataRow[];
  metadata?: Record<string, unknown>;
}

export interface ExportRequest {
  queryId: string;
  format: 'excel' | 'csv';
  options: {
    includeMetadata: boolean;
    compression: boolean;
    maxRows: number;
    customFilename?: string;
  };
  queryResult: ExportQueryResult;
  queryText?: string;
}

export interface ExportResponse {
  success: boolean;
  exportId: string;
  filename: string;
  downloadUrl: string;
  metadata: {
    rowCount: number;
    fileSize: number;
    processingTime: number;
    queryExecutedAt: string;
  };
}

export interface ExportProgress {
  exportId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  estimatedTimeRemaining?: number;
  currentStep: string;
  error?: string;
}

// Well-known export error codes (the API may also return other string codes)
export type ExportErrorCode = 'MEMORY_OVERFLOW' | 'TIMEOUT' | 'FILE_SYSTEM_ERROR' | 'NETWORK_ERROR' | 'FORMAT_ERROR' | 'NO_DATA' | 'DATASET_TOO_LARGE';

export interface ExportError extends Error {
  code: string;
  details?: unknown;
}

export interface ExportButtonProps {
  queryResult: ExportQueryResult;
  queryText?: string;
  onExportStart?: () => void;
  onExportComplete?: (response: ExportResponse) => void;
  onExportError?: (error: ExportError) => void;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export interface ExportProgressProps {
  exportId: string;
  onComplete: (response: ExportResponse) => void;
  onError: (error: ExportError) => void;
  className?: string;
}


