import { Workbook, stream } from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { 
  ExportRequest, 
  ExportResponse, 
  ExportProgress, 
  QueryResultForExport, 
  ExportError,
  VariableDefinition 
} from '../models/export.models';
import { ExcelFormattingUtils } from '../utils/excelFormatting';

export class ExcelExportService {
  private static readonly TEMP_DIR = path.join(process.cwd(), 'temp', 'exports');
  private static readonly MAX_MEMORY_USAGE = 500 * 1024 * 1024; // 500MB
  private static readonly CHUNK_SIZE = 1000; // Process 1000 rows at a time
  private static progressMap = new Map<string, ExportProgress>();

  constructor() {
    // Ensure temp directory exists
    this.ensureTempDirectory();
  }

  private ensureTempDirectory(): void {
    if (!fs.existsSync(ExcelExportService.TEMP_DIR)) {
      fs.mkdirSync(ExcelExportService.TEMP_DIR, { recursive: true });
    }
  }

  async exportToExcel(
    queryResult: QueryResultForExport, 
    request: ExportRequest
  ): Promise<ExportResponse> {
    const exportId = uuidv4();
    const startTime = Date.now();

    try {
      // Initialize progress tracking
      this.updateProgress(exportId, {
        exportId,
        status: 'processing',
        progress: 0,
        currentStep: 'Initializing export...'
      });

      // Validate request and data
      this.validateExportRequest(request, queryResult);

      // Generate filename
      const filename = ExcelFormattingUtils.generateFilename(
        this.getQueryType(queryResult),
        request.options.customFilename
      );

      const filePath = path.join(ExcelExportService.TEMP_DIR, filename);

      // Check if we need streaming for large datasets
      const useStreaming = queryResult.data.length > 10000;

      let fileSize: number;
      if (useStreaming) {
        fileSize = await this.createStreamingExcel(queryResult, request, filePath, exportId);
      } else {
        fileSize = await this.createStandardExcel(queryResult, request, filePath, exportId);
      }

      const processingTime = (Date.now() - startTime) / 1000;

      // Update progress to completed
      this.updateProgress(exportId, {
        exportId,
        status: 'completed',
        progress: 100,
        currentStep: 'Export completed successfully'
      });

      // Schedule file cleanup after 1 hour
      this.scheduleFileCleanup(filePath, 60 * 60 * 1000);

      return {
        success: true,
        exportId,
        filename,
        downloadUrl: `/api/v1/export/download/${exportId}`,
        metadata: {
          rowCount: queryResult.data.length,
          fileSize,
          processingTime,
          queryExecutedAt: queryResult.metadata.executedAt
        }
      };

    } catch (error) {
      this.updateProgress(exportId, {
        exportId,
        status: 'failed',
        progress: 0,
        currentStep: 'Export failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw this.createExportError(error);
    }
  }

  private async createStandardExcel(
    queryResult: QueryResultForExport,
    request: ExportRequest,
    filePath: string,
    exportId: string
  ): Promise<number> {
    const workbook = new Workbook();

    // Set workbook properties
    workbook.creator = 'CensusChat';
    workbook.lastModifiedBy = 'CensusChat Export Service';
    workbook.created = new Date();
    workbook.modified = new Date();

    this.updateProgress(exportId, {
      exportId,
      status: 'processing',
      progress: 20,
      currentStep: 'Creating data worksheet...'
    });

    // Create data worksheet
    await this.createDataWorksheet(workbook, queryResult, exportId);

    this.updateProgress(exportId, {
      exportId,
      status: 'processing',
      progress: 60,
      currentStep: 'Creating metadata worksheet...'
    });

    // Create metadata worksheet if requested
    if (request.options.includeMetadata) {
      this.createMetadataWorksheet(workbook, queryResult);
    }

    this.updateProgress(exportId, {
      exportId,
      status: 'processing',
      progress: 80,
      currentStep: 'Creating data dictionary...'
    });

    // Create data dictionary worksheet
    const variables = this.extractVariableDefinitions(queryResult);
    if (variables.length > 0) {
      this.createDataDictionaryWorksheet(workbook, variables);
    }

    this.updateProgress(exportId, {
      exportId,
      status: 'processing',
      progress: 90,
      currentStep: 'Writing file to disk...'
    });

    // Write to file
    await workbook.xlsx.writeFile(filePath);

    // Get file size
    const stats = fs.statSync(filePath);
    return stats.size;
  }

  private async createStreamingExcel(
    queryResult: QueryResultForExport,
    request: ExportRequest,
    filePath: string,
    exportId: string
  ): Promise<number> {
    const workbook = new stream.xlsx.WorkbookWriter({
      filename: filePath,
      useStyles: true,
      useSharedStrings: true
    });

    // Set workbook properties
    workbook.creator = 'CensusChat';
    workbook.lastModifiedBy = 'CensusChat Export Service';
    workbook.created = new Date();
    workbook.modified = new Date();

    this.updateProgress(exportId, {
      exportId,
      status: 'processing',
      progress: 10,
      currentStep: 'Initializing streaming export...'
    });

    // Create and stream data worksheet
    await this.createStreamingDataWorksheet(workbook, queryResult, exportId);

    // Create metadata worksheet if requested
    if (request.options.includeMetadata) {
      this.updateProgress(exportId, {
        exportId,
        status: 'processing',
        progress: 80,
        currentStep: 'Adding metadata...'
      });
      
      const metadataWorksheet = workbook.addWorksheet('Query Information');
      ExcelFormattingUtils.formatMetadataSheet(metadataWorksheet, queryResult.metadata);
      metadataWorksheet.commit();
    }

    this.updateProgress(exportId, {
      exportId,
      status: 'processing',
      progress: 95,
      currentStep: 'Finalizing file...'
    });

    // Commit the workbook
    await workbook.commit();

    // Get file size
    const stats = fs.statSync(filePath);
    return stats.size;
  }

  private async createDataWorksheet(
    workbook: Workbook,
    queryResult: QueryResultForExport,
    exportId: string
  ): Promise<void> {
    const worksheet = workbook.addWorksheet('Query Results');
    const data = queryResult.data;

    if (data.length === 0) {
      worksheet.getCell('A1').value = 'No data available';
      return;
    }

    // Get headers from first row
    const headers = Object.keys(data[0]);
    
    // Add headers
    headers.forEach((header, index) => {
      worksheet.getCell(1, index + 1).value = header;
    });

    // Apply header formatting
    ExcelFormattingUtils.applyHeaderFormatting(worksheet, 1, headers.length);

    // Add data rows
    data.forEach((row, rowIndex) => {
      headers.forEach((header, colIndex) => {
        worksheet.getCell(rowIndex + 2, colIndex + 1).value = row[header];
      });

      // Update progress periodically
      if (rowIndex % 1000 === 0) {
        const progress = 20 + Math.floor((rowIndex / data.length) * 40);
        this.updateProgress(exportId, {
          exportId,
          status: 'processing',
          progress,
          currentStep: `Processing row ${rowIndex + 1} of ${data.length}...`
        });
      }
    });

    // Apply data formatting
    if (data.length > 0) {
      ExcelFormattingUtils.applyDataFormatting(worksheet, 2, data.length + 1, headers.length);
    }

    // Auto-size columns
    ExcelFormattingUtils.autoSizeColumns(worksheet);

    // Add conditional formatting for better readability
    if (data.length > 1) {
      const range = `A2:${String.fromCharCode(64 + headers.length)}${data.length + 1}`;
      ExcelFormattingUtils.addConditionalFormatting(worksheet, range);
    }
  }

  private async createStreamingDataWorksheet(
    workbook: stream.xlsx.WorkbookWriter,
    queryResult: QueryResultForExport,
    exportId: string
  ): Promise<void> {
    const worksheet = workbook.addWorksheet('Query Results');
    const data = queryResult.data;

    if (data.length === 0) {
      worksheet.getCell('A1').value = 'No data available';
      worksheet.commit();
      return;
    }

    // Get headers from first row
    const headers = Object.keys(data[0]);
    
    // Add headers
    headers.forEach((header, index) => {
      worksheet.getCell(1, index + 1).value = header;
    });

    // Apply header formatting
    ExcelFormattingUtils.applyHeaderFormatting(worksheet, 1, headers.length);

    // Process data in chunks to manage memory
    const totalRows = data.length;
    const chunkSize = ExcelExportService.CHUNK_SIZE;

    for (let i = 0; i < totalRows; i += chunkSize) {
      const chunk = data.slice(i, Math.min(i + chunkSize, totalRows));
      
      chunk.forEach((row, chunkIndex) => {
        const rowIndex = i + chunkIndex;
        headers.forEach((header, colIndex) => {
          worksheet.getCell(rowIndex + 2, colIndex + 1).value = row[header];
        });
      });

      // Update progress
      const progress = 10 + Math.floor(((i + chunk.length) / totalRows) * 60);
      this.updateProgress(exportId, {
        exportId,
        status: 'processing',
        progress,
        currentStep: `Processing rows ${i + 1}-${i + chunk.length} of ${totalRows}...`
      });

      // Check memory usage
      if (process.memoryUsage().heapUsed > ExcelExportService.MAX_MEMORY_USAGE) {
        throw new Error('Memory usage exceeded limit during export');
      }
    }

    // Auto-size columns
    ExcelFormattingUtils.autoSizeColumns(worksheet);

    // Commit the worksheet
    worksheet.commit();
  }

  private createMetadataWorksheet(workbook: Workbook, queryResult: QueryResultForExport): void {
    const worksheet = workbook.addWorksheet('Query Information');
    ExcelFormattingUtils.formatMetadataSheet(worksheet, queryResult.metadata);
  }

  private createDataDictionaryWorksheet(workbook: Workbook, variables: VariableDefinition[]): void {
    const worksheet = workbook.addWorksheet('Data Dictionary');
    ExcelFormattingUtils.createDataDictionarySheet(worksheet, variables);
  }

  private extractVariableDefinitions(queryResult: QueryResultForExport): VariableDefinition[] {
    // This would typically come from a Census variable metadata service
    // For now, we'll create basic definitions from the data structure
    const variables: VariableDefinition[] = [];
    
    if (queryResult.data.length > 0) {
      const headers = Object.keys(queryResult.data[0]);
      
      headers.forEach(header => {
        variables.push({
          code: header,
          label: this.formatHeaderLabel(header),
          concept: 'Demographics',
          description: `Census variable: ${header}`,
          dataType: this.inferDataType(queryResult.data, header),
          universe: 'Total Population'
        });
      });
    }

    return variables;
  }

  private formatHeaderLabel(header: string): string {
    return header
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  private inferDataType(data: any[], column: string): string {
    if (data.length === 0) return 'Unknown';
    
    const firstValue = data[0][column];
    if (typeof firstValue === 'number') return 'Numeric';
    if (typeof firstValue === 'string') {
      // Check if it's a numeric string
      if (!isNaN(parseFloat(firstValue))) return 'Numeric';
      return 'Text';
    }
    if (typeof firstValue === 'boolean') return 'Boolean';
    if (firstValue instanceof Date) return 'Date';
    
    return 'Unknown';
  }

  private getQueryType(queryResult: QueryResultForExport): string {
    // Extract query type from metadata or query text
    const queryText = queryResult.metadata.queryText?.toLowerCase() || '';
    
    if (queryText.includes('income')) return 'Income';
    if (queryText.includes('population')) return 'Population';
    if (queryText.includes('housing')) return 'Housing';
    if (queryText.includes('education')) return 'Education';
    if (queryText.includes('employment')) return 'Employment';
    
    return 'Demographics';
  }

  private validateExportRequest(request: ExportRequest, queryResult: QueryResultForExport): void {
    if (!queryResult.success) {
      throw new Error('Cannot export failed query results');
    }

    if (!queryResult.data || queryResult.data.length === 0) {
      throw new Error('No data available for export');
    }

    if (queryResult.data.length > request.options.maxRows) {
      throw new Error(`Dataset too large: ${queryResult.data.length} rows exceeds limit of ${request.options.maxRows}`);
    }
  }

  private updateProgress(exportId: string, progress: Partial<ExportProgress>): void {
    const currentProgress = ExcelExportService.progressMap.get(exportId) || {
      exportId,
      status: 'queued' as const,
      progress: 0,
      currentStep: 'Initializing...'
    };

    const updatedProgress = { ...currentProgress, ...progress };
    ExcelExportService.progressMap.set(exportId, updatedProgress);
  }

  static getProgress(exportId: string): ExportProgress | null {
    return ExcelExportService.progressMap.get(exportId) || null;
  }

  private createExportError(error: unknown): ExportError {
    const exportError = new Error(
      error instanceof Error ? error.message : 'Unknown export error'
    ) as ExportError;

    if (error instanceof Error) {
      if (error.message.includes('memory')) {
        exportError.code = 'MEMORY_OVERFLOW';
      } else if (error.message.includes('timeout')) {
        exportError.code = 'TIMEOUT';
      } else if (error.message.includes('file') || error.message.includes('ENOENT')) {
        exportError.code = 'FILE_SYSTEM_ERROR';
      } else if (error.message.includes('network') || error.message.includes('connection')) {
        exportError.code = 'NETWORK_ERROR';
      } else {
        exportError.code = 'FORMAT_ERROR';
      }
    } else {
      exportError.code = 'FORMAT_ERROR';
    }

    exportError.details = error;
    return exportError;
  }

  private scheduleFileCleanup(filePath: string, delayMs: number): void {
    setTimeout(() => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Cleaned up temporary export file: ${filePath}`);
        }
      } catch (error) {
        console.error(`Failed to cleanup export file ${filePath}:`, error);
      }
    }, delayMs);
  }

  async getExportFile(exportId: string): Promise<{ filePath: string; filename: string } | null> {
    const progress = ExcelExportService.progressMap.get(exportId);
    
    if (!progress || progress.status !== 'completed') {
      return null;
    }

    // Find the file in temp directory
    const files = fs.readdirSync(ExcelExportService.TEMP_DIR);
    const exportFile = files.find(file => file.includes(exportId) || 
      ExcelExportService.progressMap.get(exportId)?.currentStep.includes(file));

    if (!exportFile) {
      return null;
    }

    const filePath = path.join(ExcelExportService.TEMP_DIR, exportFile);
    
    if (!fs.existsSync(filePath)) {
      return null;
    }

    return {
      filePath,
      filename: exportFile
    };
  }

  static clearProgress(exportId: string): void {
    ExcelExportService.progressMap.delete(exportId);
  }
}


