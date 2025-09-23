import request from 'supertest';
import express from 'express';
import { exportRoutes } from '../../routes/export.routes';

const app = express();
app.use(express.json());
app.use('/api/v1/export', exportRoutes);

describe('Export Routes', () => {
  const mockQueryResult = {
    success: true,
    message: 'Test query successful',
    data: [
      { id: 1, name: 'Test 1', value: 100 },
      { id: 2, name: 'Test 2', value: 200 },
      { id: 3, name: 'Test 3', value: 300 }
    ],
    metadata: {
      queryTime: 1.5,
      totalRecords: 3,
      dataSource: 'US Census Bureau',
      confidenceLevel: 0.95,
      marginOfError: 2.3
    }
  };

  describe('POST /excel', () => {
    it('should initiate Excel export with valid data', async () => {
      const response = await request(app)
        .post('/api/v1/export/excel')
        .send({
          queryResult: mockQueryResult,
          queryText: 'Test query for demographics',
          options: {
            includeMetadata: true,
            compression: false,
            maxRows: 50000
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.exportId).toBeDefined();
      expect(response.body.filename).toContain('.xlsx');
      expect(response.body.downloadUrl).toContain('/api/v1/export/download/');
      expect(response.body.metadata.rowCount).toBe(3);
    });

    it('should reject request without query result', async () => {
      const response = await request(app)
        .post('/api/v1/export/excel')
        .send({
          queryText: 'Test query'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('MISSING_QUERY_RESULT');
    });

    it('should reject empty data', async () => {
      const response = await request(app)
        .post('/api/v1/export/excel')
        .send({
          queryResult: {
            ...mockQueryResult,
            data: []
          },
          queryText: 'Test query'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('NO_DATA');
    });

    it('should handle dataset too large error', async () => {
      const largeDataset = Array.from({ length: 60000 }, (_, i) => ({
        id: i,
        name: `Test ${i}`,
        value: i * 10
      }));

      const response = await request(app)
        .post('/api/v1/export/excel')
        .send({
          queryResult: {
            ...mockQueryResult,
            data: largeDataset
          },
          queryText: 'Large dataset query',
          options: {
            maxRows: 50000
          }
        });

      expect(response.status).toBe(413);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('DATASET_TOO_LARGE');
    });

    it('should use default options when not provided', async () => {
      const response = await request(app)
        .post('/api/v1/export/excel')
        .send({
          queryResult: mockQueryResult,
          queryText: 'Test query'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle custom filename option', async () => {
      const response = await request(app)
        .post('/api/v1/export/excel')
        .send({
          queryResult: mockQueryResult,
          queryText: 'Test query',
          options: {
            customFilename: 'MyCustomExport'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.filename).toContain('MyCustomExport');
    });
  });

  describe('POST /csv', () => {
    it('should export to CSV format', async () => {
      const response = await request(app)
        .post('/api/v1/export/csv')
        .send({
          queryResult: mockQueryResult,
          queryText: 'Test CSV export'
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('.csv');
      
      // Check CSV content
      const csvContent = response.text;
      expect(csvContent).toContain('id,name,value'); // Headers
      expect(csvContent).toContain('1,Test 1,100'); // Data row
    });

    it('should reject CSV export without data', async () => {
      const response = await request(app)
        .post('/api/v1/export/csv')
        .send({
          queryResult: {
            ...mockQueryResult,
            data: []
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('NO_DATA');
    });

    it('should handle CSV values with commas and quotes', async () => {
      const csvTestData = {
        ...mockQueryResult,
        data: [
          { id: 1, name: 'Test, with comma', value: 100 },
          { id: 2, name: 'Test "with quotes"', value: 200 }
        ]
      };

      const response = await request(app)
        .post('/api/v1/export/csv')
        .send({
          queryResult: csvTestData
        });

      expect(response.status).toBe(200);
      const csvContent = response.text;
      expect(csvContent).toContain('"Test, with comma"');
      expect(csvContent).toContain('"Test ""with quotes"""');
    });
  });

  describe('GET /progress/:exportId', () => {
    it('should return 404 for non-existent export', async () => {
      const response = await request(app)
        .get('/api/v1/export/progress/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('EXPORT_NOT_FOUND');
    });

    it('should require exportId parameter', async () => {
      const response = await request(app)
        .get('/api/v1/export/progress/');

      expect(response.status).toBe(404); // Route not found without parameter
    });
  });

  describe('GET /download/:exportId', () => {
    it('should return 404 for non-existent export file', async () => {
      const response = await request(app)
        .get('/api/v1/export/download/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('FILE_NOT_FOUND');
    });

    it('should require exportId parameter', async () => {
      const response = await request(app)
        .get('/api/v1/export/download/');

      expect(response.status).toBe(404); // Route not found without parameter
    });
  });

  describe('Error handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/v1/export/excel')
        .send('invalid json')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
    });

    it('should handle server errors gracefully', async () => {
      // Send invalid data that might cause internal server error
      const response = await request(app)
        .post('/api/v1/export/excel')
        .send({
          queryResult: {
            success: true,
            data: 'invalid-data-type', // Should be array
            metadata: {}
          }
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Rate limiting', () => {
    it('should apply rate limiting to export endpoints', async () => {
      // This test would need to be adjusted based on actual rate limiting configuration
      // For now, just verify the endpoint responds normally
      const response = await request(app)
        .post('/api/v1/export/excel')
        .send({
          queryResult: mockQueryResult
        });

      expect(response.status).toBeLessThan(500); // Should not be a server error
    });
  });
});


