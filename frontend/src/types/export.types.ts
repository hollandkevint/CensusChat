export interface ExportRequest {
  queryId: string;
  format: 'excel' | 'csv';
  options: {
    includeMetadata: boolean;
    compression: boolean;
    maxRows: number;
    customFilename?: string;
  };
  queryResult: any;
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

export interface ExportError extends Error {
  code: 'MEMORY_OVERFLOW' | 'TIMEOUT' | 'FILE_SYSTEM_ERROR' | 'NETWORK_ERROR' | 'FORMAT_ERROR' | 'NO_DATA' | 'DATASET_TOO_LARGE';
  details?: any;
}

export interface ExportButtonProps {
  queryResult: any;
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


