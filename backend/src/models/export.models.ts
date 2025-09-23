export interface ExportRequest {
  queryId: string;
  format: 'excel' | 'csv';
  options: {
    includeMetadata: boolean;
    compression: boolean;
    maxRows: number;
    customFilename?: string;
  };
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

export interface ExcelWorkbook {
  dataSheet: {
    name: 'Query Results';
    headers: string[];
    data: any[][];
    formatting: ExcelFormatting;
  };
  metadataSheet: {
    name: 'Query Information';
    queryText: string;
    executedAt: string;
    dataSource: string;
    rowCount: number;
    geographyLevel: string;
  };
  dictionarySheet?: {
    name: 'Data Dictionary';
    variables: VariableDefinition[];
  };
}

export interface ExcelFormatting {
  headerStyle: {
    font: { bold: boolean; color: { argb: string } };
    fill: { type: 'pattern'; pattern: 'solid'; fgColor: { argb: string } };
    border: { top: any; left: any; bottom: any; right: any };
  };
  dataStyle: {
    font: { size: number };
    alignment: { horizontal: string; vertical: string };
  };
  numberFormat: string;
}

export interface VariableDefinition {
  code: string;
  label: string;
  concept: string;
  description: string;
  dataType: string;
  universe: string;
}

export interface ExportError extends Error {
  code: 'MEMORY_OVERFLOW' | 'TIMEOUT' | 'FILE_SYSTEM_ERROR' | 'NETWORK_ERROR' | 'FORMAT_ERROR';
  details?: any;
}

export interface QueryResultForExport {
  success: boolean;
  message: string;
  data: any[];
  metadata: {
    queryTime: number;
    totalRecords: number;
    dataSource: string;
    confidenceLevel: number;
    marginOfError: number;
    queryText: string;
    executedAt: string;
    geographyLevel?: string;
    variables?: string[];
  };
}
