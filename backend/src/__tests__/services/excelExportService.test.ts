import { ExcelExportService } from '../../services/excelExportService';
import { ExportRequest, QueryResultForExport } from '../../models/export.models';
import * as fs from 'fs';
import * as path from 'path';

describe('ExcelExportService', () => {
  let exportService: ExcelExportService;
  const testTempDir = path.join(process.cwd(), 'temp', 'test-exports');

  beforeEach(() => {
    exportService = new ExcelExportService();
    
    // Ensure test temp directory exists
    if (!fs.existsSync(testTempDir)) {
      fs.mkdirSync(testTempDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testTempDir)) {
      const files = fs.readdirSync(testTempDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(testTempDir, file));
      });
    }
  });

  afterAll(() => {
    // Remove test directory
    if (fs.existsSync(testTempDir)) {
      fs.rmSync(testTempDir, { recursive: true, force: true });
    }
  });

  const createMockQueryResult = (rowCount: number = 10): QueryResultForExport => ({
    success: true,
    message: 'Test query successful',
    data: Array.from({ length: rowCount }, (_, i) => ({
      id: i + 1,
      name: `Test Record ${i + 1}`,
      value: Math.floor(Math.random() * 1000),
      category: i % 2 === 0 ? 'Category A' : 'Category B',
      date: new Date().toISOString().split('T')[0]
    })),
    metadata: {
      queryTime: 1.5,
      totalRecords: rowCount,
      dataSource: 'US Census Bureau',
      confidenceLevel: 0.95,
      marginOfError: 2.3,
      queryText: 'Test query for demographics',
      executedAt: new Date().toISOString(),
      geographyLevel: 'State',
      variables: ['population', 'income', 'age']
    }
  });

  const createMockExportRequest = (options: Partial<ExportRequest['options']> = {}): ExportRequest => ({
    queryId: 'test-query-123',
    format: 'excel',
    options: {
      includeMetadata: true,
      compression: false,
      maxRows: 50000,
      ...options
    }
  });

  describe('exportToExcel', () => {
    it('should successfully export small dataset to Excel', async () => {
      const queryResult = createMockQueryResult(5);
      const exportRequest = createMockExportRequest();

      const result = await exportService.exportToExcel(queryResult, exportRequest);

      expect(result.success).toBe(true);
      expect(result.exportId).toBeDefined();
      expect(result.filename).toContain('.xlsx');
      expect(result.metadata.rowCount).toBe(5);
      expect(result.metadata.processingTime).toBeGreaterThan(0);
    });

    it('should handle medium dataset (1000 rows)', async () => {
      const queryResult = createMockQueryResult(1000);
      const exportRequest = createMockExportRequest();

      const result = await exportService.exportToExcel(queryResult, exportRequest);

      expect(result.success).toBe(true);
      expect(result.metadata.rowCount).toBe(1000);
      expect(result.metadata.fileSize).toBeGreaterThan(0);
    });

    it('should use streaming for large datasets (>10000 rows)', async () => {
      const queryResult = createMockQueryResult(15000);
      const exportRequest = createMockExportRequest();

      const result = await exportService.exportToExcel(queryResult, exportRequest);

      expect(result.success).toBe(true);
      expect(result.metadata.rowCount).toBe(15000);
      
      // Should complete within reasonable time even for large dataset
      expect(result.metadata.processingTime).toBeLessThan(30);
    });

    it('should reject datasets exceeding maxRows limit', async () => {
      const queryResult = createMockQueryResult(60000);
      const exportRequest = createMockExportRequest({ maxRows: 50000 });

      await expect(exportService.exportToExcel(queryResult, exportRequest))
        .rejects.toThrow('Dataset too large');
    });

    it('should reject empty datasets', async () => {
      const queryResult = createMockQueryResult(0);
      const exportRequest = createMockExportRequest();

      await expect(exportService.exportToExcel(queryResult, exportRequest))
        .rejects.toThrow('No data available for export');
    });

    it('should reject failed query results', async () => {
      const queryResult: QueryResultForExport = {
        ...createMockQueryResult(10),
        success: false
      };
      const exportRequest = createMockExportRequest();

      await expect(exportService.exportToExcel(queryResult, exportRequest))
        .rejects.toThrow('Cannot export failed query results');
    });

    it('should include metadata when requested', async () => {
      const queryResult = createMockQueryResult(5);
      const exportRequest = createMockExportRequest({ includeMetadata: true });

      const result = await exportService.exportToExcel(queryResult, exportRequest);

      expect(result.success).toBe(true);
      // Metadata inclusion is tested by checking the service doesn't throw
      // Actual Excel file content would need integration tests
    });

    it('should exclude metadata when not requested', async () => {
      const queryResult = createMockQueryResult(5);
      const exportRequest = createMockExportRequest({ includeMetadata: false });

      const result = await exportService.exportToExcel(queryResult, exportRequest);

      expect(result.success).toBe(true);
    });

    it('should use custom filename when provided', async () => {
      const queryResult = createMockQueryResult(5);
      const exportRequest = createMockExportRequest({ 
        customFilename: 'MyCustomExport' 
      });

      const result = await exportService.exportToExcel(queryResult, exportRequest);

      expect(result.filename).toContain('MyCustomExport');
      expect(result.filename).toContain('.xlsx');
    });
  });

  describe('progress tracking', () => {
    it('should track progress during export', async () => {
      const queryResult = createMockQueryResult(1000);
      const exportRequest = createMockExportRequest();

      // Start export in background
      const exportPromise = exportService.exportToExcel(queryResult, exportRequest);
      
      // Wait a moment for export to start
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = await exportPromise;
      const progress = ExcelExportService.getProgress(result.exportId);

      expect(progress).toBeDefined();
      expect(progress?.status).toBe('completed');
      expect(progress?.progress).toBe(100);
    });

    it('should clear progress after completion', async () => {
      const queryResult = createMockQueryResult(5);
      const exportRequest = createMockExportRequest();

      const result = await exportService.exportToExcel(queryResult, exportRequest);
      
      // Clear progress manually (simulating download completion)
      ExcelExportService.clearProgress(result.exportId);
      
      const progress = ExcelExportService.getProgress(result.exportId);
      expect(progress).toBeNull();
    });
  });

  describe('file management', () => {
    it('should create export file that can be retrieved', async () => {
      const queryResult = createMockQueryResult(5);
      const exportRequest = createMockExportRequest();

      const result = await exportService.exportToExcel(queryResult, exportRequest);
      const exportFile = await exportService.getExportFile(result.exportId);

      expect(exportFile).toBeDefined();
      expect(exportFile?.filename).toBe(result.filename);
      expect(fs.existsSync(exportFile?.filePath || '')).toBe(true);
    });

    it('should return null for non-existent export', async () => {
      const exportFile = await exportService.getExportFile('non-existent-id');
      expect(exportFile).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle invalid data gracefully', async () => {
      const queryResult: QueryResultForExport = {
        success: true,
        message: 'Test',
        data: [null, undefined, {}] as any,
        metadata: {
          queryTime: 1,
          totalRecords: 3,
          dataSource: 'Test',
          confidenceLevel: 0.95,
          marginOfError: 2.3,
          queryText: 'Test',
          executedAt: new Date().toISOString()
        }
      };
      const exportRequest = createMockExportRequest();

      // Should not throw, but handle gracefully
      const result = await exportService.exportToExcel(queryResult, exportRequest);
      expect(result.success).toBe(true);
    });

    it('should handle memory pressure gracefully', async () => {
      // This test would need to be run in a controlled environment
      // with memory limits to properly test memory handling
      const queryResult = createMockQueryResult(100);
      const exportRequest = createMockExportRequest();

      const result = await exportService.exportToExcel(queryResult, exportRequest);
      expect(result.success).toBe(true);
    });
  });
});


