import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import { ExcelExportService } from '../services/excelExportService';
import { ExportRequest, QueryResultForExport } from '../models/export.models';
import { queryRateLimit } from '../middleware/rateLimiting';

const router = Router();
const exportService = new ExcelExportService();

/**
 * @route POST /api/v1/export/excel
 * @desc Export query results to Excel format
 * @access Public (will be protected when auth is implemented)
 */
router.post('/excel', queryRateLimit, async (req: Request, res: Response) => {
  try {
    const exportRequest: ExportRequest = {
      queryId: req.body.queryId || 'direct-export',
      format: 'excel',
      options: {
        includeMetadata: req.body.options?.includeMetadata ?? true,
        compression: req.body.options?.compression ?? false,
        maxRows: req.body.options?.maxRows ?? 50000,
        customFilename: req.body.options?.customFilename
      }
    };

    // Validate request body
    if (!req.body.queryResult) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_QUERY_RESULT',
        message: 'Query result data is required for export'
      });
    }

    // Transform the query result to match our export interface
    const queryResult: QueryResultForExport = {
      success: req.body.queryResult.success ?? true,
      message: req.body.queryResult.message ?? 'Query executed successfully',
      data: req.body.queryResult.data || [],
      metadata: {
        queryTime: req.body.queryResult.metadata?.queryTime ?? 0,
        totalRecords: req.body.queryResult.metadata?.totalRecords ?? req.body.queryResult.data?.length ?? 0,
        dataSource: req.body.queryResult.metadata?.dataSource ?? 'US Census Bureau',
        confidenceLevel: req.body.queryResult.metadata?.confidenceLevel ?? 0.95,
        marginOfError: req.body.queryResult.metadata?.marginOfError ?? 2.3,
        queryText: req.body.queryText || 'Census data query',
        executedAt: req.body.queryResult.metadata?.executedAt ?? new Date().toISOString(),
        geographyLevel: req.body.queryResult.metadata?.geographyLevel,
        variables: req.body.queryResult.metadata?.variables
      }
    };

    // Perform the export
    const exportResponse = await exportService.exportToExcel(queryResult, exportRequest);

    res.json(exportResponse);

  } catch (error) {
    console.error('Excel export error:', error);

    // Handle specific export errors
    if (error instanceof Error) {
      if (error.message.includes('Dataset too large')) {
        return res.status(413).json({
          success: false,
          error: 'DATASET_TOO_LARGE',
          message: error.message
        });
      }

      if (error.message.includes('memory')) {
        return res.status(507).json({
          success: false,
          error: 'INSUFFICIENT_STORAGE',
          message: 'Dataset too large to process. Please try a smaller query or contact support.'
        });
      }

      if (error.message.includes('No data available')) {
        return res.status(400).json({
          success: false,
          error: 'NO_DATA',
          message: 'No data available for export'
        });
      }
    }

    res.status(500).json({
      success: false,
      error: 'EXPORT_FAILED',
      message: 'Failed to generate Excel export',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @route GET /api/v1/export/progress/:exportId
 * @desc Get export progress status
 * @access Public (will be protected when auth is implemented)
 */
router.get('/progress/:exportId', (req: Request, res: Response) => {
  try {
    const { exportId } = req.params;
    
    if (!exportId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_EXPORT_ID',
        message: 'Export ID is required'
      });
    }

    const progress = ExcelExportService.getProgress(exportId);
    
    if (!progress) {
      return res.status(404).json({
        success: false,
        error: 'EXPORT_NOT_FOUND',
        message: 'Export not found or expired'
      });
    }

    res.json({
      success: true,
      progress
    });

  } catch (error) {
    console.error('Progress check error:', error);
    res.status(500).json({
      success: false,
      error: 'PROGRESS_CHECK_FAILED',
      message: 'Failed to check export progress'
    });
  }
});

/**
 * @route GET /api/v1/export/download/:exportId
 * @desc Download completed export file
 * @access Public (will be protected when auth is implemented)
 */
router.get('/download/:exportId', async (req: Request, res: Response) => {
  try {
    const { exportId } = req.params;
    
    if (!exportId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_EXPORT_ID',
        message: 'Export ID is required'
      });
    }

    // Get the export file
    const exportFile = await exportService.getExportFile(exportId);
    
    if (!exportFile) {
      return res.status(404).json({
        success: false,
        error: 'FILE_NOT_FOUND',
        message: 'Export file not found or expired'
      });
    }

    // Check if file exists
    if (!fs.existsSync(exportFile.filePath)) {
      return res.status(404).json({
        success: false,
        error: 'FILE_NOT_FOUND',
        message: 'Export file not found on disk'
      });
    }

    // Set appropriate headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${exportFile.filename}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Stream the file
    const fileStream = fs.createReadStream(exportFile.filePath);
    
    fileStream.on('error', (error) => {
      console.error('File stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'FILE_STREAM_ERROR',
          message: 'Error streaming export file'
        });
      }
    });

    fileStream.on('end', () => {
      // Clean up progress tracking after successful download
      ExcelExportService.clearProgress(exportId);
    });

    fileStream.pipe(res);

  } catch (error) {
    console.error('Download error:', error);
    
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'DOWNLOAD_FAILED',
        message: 'Failed to download export file'
      });
    }
  }
});

/**
 * @route POST /api/v1/export/csv
 * @desc Export query results to CSV format (fallback option)
 * @access Public (will be protected when auth is implemented)
 */
router.post('/csv', queryRateLimit, async (req: Request, res: Response) => {
  try {
    // Validate request body
    if (!req.body.queryResult || !req.body.queryResult.data) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_QUERY_RESULT',
        message: 'Query result data is required for export'
      });
    }

    const data = req.body.queryResult.data;
    
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'NO_DATA',
        message: 'No data available for export'
      });
    }

    // Generate CSV content
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','), // Header row
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escape commas and quotes in CSV
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ];

    const csvContent = csvRows.join('\n');
    const filename = `CensusChat_Export_${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.csv`;

    // Set CSV headers
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    res.send(csvContent);

  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({
      success: false,
      error: 'CSV_EXPORT_FAILED',
      message: 'Failed to generate CSV export'
    });
  }
});

export { router as exportRoutes };
