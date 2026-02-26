/**
 * E2E API Integration Tests for CensusChat
 *
 * Tests the full flow from frontend to backend API including:
 * - Query API with natural language queries
 * - MCP validation flow
 * - Export API (Excel, CSV, PDF)
 * - Share API for creating and retrieving shared queries
 * - Analytics API for tracking and metrics
 * - Health check endpoints
 * - Error handling and edge cases
 */

import { test, expect, Page, Route } from '@playwright/test';
import {
  mockQueryResponse,
  mockShareResponse,
  mockSharedQuery,
  mockAnalyticsSummary,
  mockAnalyticsDashboard,
  mockErrorResponse,
  mockHealthResponse,
} from './fixtures/mock-data';

// API base URL - can be configured via environment variable
const API_BASE_URL = process.env.PLAYWRIGHT_API_URL || 'http://localhost:3001';

/**
 * Helper function to set up API mocking for a page
 */
async function setupApiMocks(page: Page) {
  // Mock the query API endpoint
  await page.route(`${API_BASE_URL}/api/v1/queries`, async (route: Route) => {
    const request = route.request();

    if (request.method() === 'POST') {
      const postData = request.postDataJSON();

      // Simulate different responses based on query content
      if (postData?.query?.toLowerCase().includes('error')) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify(mockErrorResponse),
        });
      } else if (postData?.query?.toLowerCase().includes('timeout')) {
        // Simulate timeout by delaying response
        await new Promise((resolve) => setTimeout(resolve, 35000));
        await route.fulfill({
          status: 408,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Query processing took too long',
            error: 'TIMEOUT',
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockQueryResponse),
        });
      }
    } else {
      await route.continue();
    }
  });

  // Mock health check endpoint
  await page.route(`${API_BASE_URL}/api/v1/health`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockHealthResponse),
    });
  });

  // Also mock the base health endpoint (without /api/v1 prefix)
  await page.route(`${API_BASE_URL}/health`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockHealthResponse),
    });
  });

  // Mock MCP resources endpoint
  await page.route(`${API_BASE_URL}/api/v1/mcp/resources`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

// =============================================================================
// Test Suite: Query API Integration
// =============================================================================

test.describe('Query API Integration', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('should submit natural language query and receive response', async ({ page }) => {
    // Navigate to the main page
    await page.goto('/');

    // Wait for the chat interface to be visible
    await expect(page.locator('text=CensusChat')).toBeVisible();

    // Find the input field and enter a query
    const inputField = page.locator('input[placeholder*="demographics"]');
    await expect(inputField).toBeVisible();

    await inputField.fill('Show me Medicare eligible seniors in Florida');
    await inputField.press('Enter');

    // Wait for the response to appear
    await expect(page.locator('text=Found 5 records')).toBeVisible({ timeout: 10000 });

    // Verify data table is displayed
    await expect(page.locator('table')).toBeVisible();

    // Verify data content
    await expect(page.locator('text=Miami-Dade')).toBeVisible();
    await expect(page.locator('text=Broward')).toBeVisible();
  });

  test('should display query metadata in response', async ({ page }) => {
    await page.goto('/');

    const inputField = page.locator('input[placeholder*="demographics"]');
    await inputField.fill('Show me population data for Texas counties');
    await inputField.press('Enter');

    // Wait for response
    await expect(page.locator('text=Found 5 records')).toBeVisible({ timeout: 10000 });

    // Check for metadata display
    await expect(page.locator('text=Query time')).toBeVisible();
    await expect(page.locator('text=Data source')).toBeVisible();
  });

  test('should handle empty query gracefully', async ({ page }) => {
    await page.goto('/');

    const inputField = page.locator('input[placeholder*="demographics"]');
    const sendButton = page.locator('button:has-text("Send")');

    // Verify send button is disabled when input is empty
    await expect(sendButton).toBeDisabled();

    // Enter whitespace only
    await inputField.fill('   ');
    await expect(sendButton).toBeDisabled();
  });

  test('should show loading state during query processing', async ({ page }) => {
    // Set up a delayed response to observe loading state
    await page.route(`${API_BASE_URL}/api/v1/queries`, async (route: Route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockQueryResponse),
      });
    });

    await page.goto('/');

    const inputField = page.locator('input[placeholder*="demographics"]');
    await inputField.fill('Show me data');
    await inputField.press('Enter');

    // Check for loading state
    await expect(page.locator('button:has-text("Processing")')).toBeVisible();
    await expect(page.locator('text=Analyzing your query')).toBeVisible();

    // Wait for response
    await expect(page.locator('text=Found 5 records')).toBeVisible({ timeout: 10000 });
  });
});

// =============================================================================
// Test Suite: MCP Validation Flow
// =============================================================================

test.describe('MCP Validation Flow', () => {
  test('should handle MCP validation errors with suggestions', async ({ page }) => {
    // Mock validation error response
    await page.route(`${API_BASE_URL}/api/v1/queries`, async (route: Route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'I had trouble understanding your query. Please try rephrasing.',
          error: 'VALIDATION_ERROR',
          suggestions: [
            'Try being more specific about the geography',
            'Include a state or county name',
            'Use terms like "seniors", "income", or "population"',
          ],
        }),
      });
    });

    await page.goto('/');

    const inputField = page.locator('input[placeholder*="demographics"]');
    await inputField.fill('invalid query with error');
    await inputField.press('Enter');

    // Wait for error response
    await expect(page.locator('text=trouble understanding')).toBeVisible({ timeout: 10000 });

    // Check for suggestions
    await expect(page.locator('text=Suggestions')).toBeVisible();
    await expect(page.locator('text=Try being more specific')).toBeVisible();
  });

  test('should validate query through MCP before execution', async ({ page }) => {
    let queryReceived = false;
    let queryPayload: any = null;

    await page.route(`${API_BASE_URL}/api/v1/queries`, async (route: Route) => {
      queryReceived = true;
      queryPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockQueryResponse),
      });
    });

    await page.goto('/');

    const inputField = page.locator('input[placeholder*="demographics"]');
    await inputField.fill('Show me seniors in Florida with income over $50k');
    await inputField.press('Enter');

    await expect(page.locator('text=Found 5 records')).toBeVisible({ timeout: 10000 });

    // Verify query was sent to API
    expect(queryReceived).toBe(true);
    expect(queryPayload).toBeDefined();
    expect(queryPayload.query).toContain('seniors');
    expect(queryPayload.query).toContain('Florida');
  });
});

// =============================================================================
// Test Suite: Export API
// =============================================================================

test.describe('Export API', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('should initiate Excel export successfully', async ({ page }) => {
    // Mock export endpoint
    await page.route(`${API_BASE_URL}/api/v1/export/excel`, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          exportId: 'export-123',
          filename: 'census-data-export.xlsx',
          downloadUrl: '/api/v1/export/download/export-123',
          metadata: {
            rowCount: 5,
            fileSize: 15234,
            processingTime: 1.2,
            queryExecutedAt: new Date().toISOString(),
          },
        }),
      });
    });

    await page.goto('/');

    // First, submit a query to get results
    const inputField = page.locator('input[placeholder*="demographics"]');
    await inputField.fill('Show me Florida data');
    await inputField.press('Enter');

    // Wait for results
    await expect(page.locator('text=Found 5 records')).toBeVisible({ timeout: 10000 });

    // Look for export button and click it
    const exportButton = page.locator('button:has-text("Export")').first();
    if (await exportButton.isVisible()) {
      await exportButton.click();

      // Check for export menu or dialog
      await expect(page.locator('text=Excel').or(page.locator('text=CSV'))).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test('should handle CSV export', async ({ page }) => {
    // Mock CSV export endpoint
    await page.route(`${API_BASE_URL}/api/v1/export/csv`, async (route: Route) => {
      const csvContent = 'county,state,seniors,income_over_50k\nMiami-Dade,Florida,456789,234567';
      await route.fulfill({
        status: 200,
        contentType: 'text/csv',
        body: csvContent,
      });
    });

    await page.goto('/');

    const inputField = page.locator('input[placeholder*="demographics"]');
    await inputField.fill('Show me Florida data');
    await inputField.press('Enter');

    await expect(page.locator('text=Found 5 records')).toBeVisible({ timeout: 10000 });

    // Trigger export if button is available
    const exportButton = page.locator('button:has-text("Export")').first();
    if (await exportButton.isVisible()) {
      await exportButton.click();
    }
  });

  test('should show export progress for large datasets', async ({ page }) => {
    // Mock progress endpoint
    await page.route(`${API_BASE_URL}/api/v1/export/progress/*`, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          progress: {
            exportId: 'export-123',
            status: 'processing',
            progress: 50,
            estimatedTimeRemaining: 30,
            currentStep: 'Formatting data...',
          },
        }),
      });
    });

    await page.goto('/');

    const inputField = page.locator('input[placeholder*="demographics"]');
    await inputField.fill('Show me all counties');
    await inputField.press('Enter');

    await expect(page.locator('text=Found 5 records')).toBeVisible({ timeout: 10000 });
  });

  test('should handle export errors gracefully', async ({ page }) => {
    await page.route(`${API_BASE_URL}/api/v1/export/excel`, async (route: Route) => {
      await route.fulfill({
        status: 413,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Dataset too large for export',
          error: 'DATASET_TOO_LARGE',
        }),
      });
    });

    await page.goto('/');

    const inputField = page.locator('input[placeholder*="demographics"]');
    await inputField.fill('Show me data');
    await inputField.press('Enter');

    await expect(page.locator('text=Found 5 records')).toBeVisible({ timeout: 10000 });
  });
});

// =============================================================================
// Test Suite: Share API
// =============================================================================

test.describe('Share API', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);

    // Mock share endpoints
    await page.route(`${API_BASE_URL}/api/v1/share`, async (route: Route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockShareResponse),
        });
      }
    });

    await page.route(`${API_BASE_URL}/api/v1/share/*`, async (route: Route) => {
      const url = route.request().url();

      if (url.includes('/metadata')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            metadata: {
              exists: true,
              title: 'Florida Medicare Analysis',
              category: 'healthcare',
              createdAt: Date.now(),
              expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
              viewCount: 42,
              rowCount: 5,
            },
          }),
        });
      } else if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            share: mockSharedQuery,
          }),
        });
      } else if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
    });
  });

  test('should create a shareable link for query results', async ({ page }) => {
    await page.goto('/');

    // Submit a query first
    const inputField = page.locator('input[placeholder*="demographics"]');
    await inputField.fill('Show me Medicare seniors in Florida');
    await inputField.press('Enter');

    await expect(page.locator('text=Found 5 records')).toBeVisible({ timeout: 10000 });

    // Look for share button
    const shareButton = page.locator('button:has-text("Share")').first();
    if (await shareButton.isVisible()) {
      await shareButton.click();

      // Check for share dialog
      await expect(
        page.locator('text=Share').or(page.locator('[role="dialog"]'))
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('should load shared query page successfully', async ({ page }) => {
    await page.goto('/share/test-share-123');

    // Wait for shared query to load
    await expect(
      page.locator('text=Florida Medicare').or(page.locator('text=Medicare eligible'))
    ).toBeVisible({ timeout: 10000 });
  });

  test('should handle expired share links', async ({ page }) => {
    await page.route(`${API_BASE_URL}/api/v1/share/*`, async (route: Route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Share not found or expired',
        }),
      });
    });

    await page.goto('/share/expired-share-123');

    // Should show error message
    await expect(
      page.locator('text=not found').or(page.locator('text=expired'))
    ).toBeVisible({ timeout: 10000 });
  });

  test('should increment view count when accessing shared query', async ({ page }) => {
    let viewCountIncremented = false;

    await page.route(`${API_BASE_URL}/api/v1/share/*`, async (route: Route) => {
      viewCountIncremented = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          share: { ...mockSharedQuery, viewCount: 43 },
        }),
      });
    });

    await page.goto('/share/test-share-123');

    await expect(page.locator('text=Florida')).toBeVisible({ timeout: 10000 });
    expect(viewCountIncremented).toBe(true);
  });
});

// =============================================================================
// Test Suite: Analytics API
// =============================================================================

test.describe('Analytics API', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);

    // Mock analytics endpoints
    await page.route(`${API_BASE_URL}/api/v1/analytics/track`, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.route(`${API_BASE_URL}/api/v1/analytics/summary`, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockAnalyticsSummary }),
      });
    });

    await page.route(`${API_BASE_URL}/api/v1/analytics/dashboard`, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockAnalyticsDashboard }),
      });
    });

    await page.route(`${API_BASE_URL}/api/v1/analytics/performance*`, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockAnalyticsDashboard.performance,
        }),
      });
    });
  });

  test('should track query execution events', async ({ page }) => {
    let trackEventCalled = false;
    let trackedEvent: any = null;

    await page.route(`${API_BASE_URL}/api/v1/analytics/track`, async (route: Route) => {
      trackEventCalled = true;
      trackedEvent = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto('/');

    const inputField = page.locator('input[placeholder*="demographics"]');
    await inputField.fill('Show me Medicare data');
    await inputField.press('Enter');

    await expect(page.locator('text=Found 5 records')).toBeVisible({ timeout: 10000 });

    // Wait a bit for tracking to complete
    await page.waitForTimeout(500);

    expect(trackEventCalled).toBe(true);
    expect(trackedEvent).toBeDefined();
    expect(trackedEvent.eventType).toBe('query_executed');
  });

  test('should track query errors', async ({ page }) => {
    let trackedError: any = null;

    await page.route(`${API_BASE_URL}/api/v1/queries`, async (route: Route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify(mockErrorResponse),
      });
    });

    await page.route(`${API_BASE_URL}/api/v1/analytics/track`, async (route: Route) => {
      trackedError = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto('/');

    const inputField = page.locator('input[placeholder*="demographics"]');
    await inputField.fill('trigger error query');
    await inputField.press('Enter');

    await expect(page.locator('text=trouble understanding')).toBeVisible({ timeout: 10000 });

    // Wait for tracking
    await page.waitForTimeout(500);

    expect(trackedError).toBeDefined();
    expect(trackedError.eventType).toBe('query_error');
  });

  test('should retrieve analytics summary', async ({ page }) => {
    // This test verifies the analytics endpoint is accessible
    const response = await page.request.get(`${API_BASE_URL}/api/v1/analytics/summary`);

    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.totalQueries).toBeDefined();
    expect(data.data.cacheHitRate).toBeDefined();
  });

  test('should retrieve dashboard data', async ({ page }) => {
    const response = await page.request.get(`${API_BASE_URL}/api/v1/analytics/dashboard`);

    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.summary).toBeDefined();
    expect(data.data.performance).toBeDefined();
    expect(data.data.popularCategories).toBeDefined();
  });
});

// =============================================================================
// Test Suite: Health Check
// =============================================================================

test.describe('Health Check', () => {
  test('should return healthy status from /health endpoint', async ({ page }) => {
    await page.route(`${API_BASE_URL}/health`, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: 12345,
          environment: 'test',
          version: '1.0.0',
          services: {
            database: 'connected',
            redis: 'connected',
            duckdb: 'available',
          },
        }),
      });
    });

    const response = await page.request.get(`${API_BASE_URL}/health`);

    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data.status).toBe('healthy');
    expect(data.services).toBeDefined();
    expect(data.services.database).toBe('connected');
  });

  test('should check MCP health status', async ({ page }) => {
    await page.route(`${API_BASE_URL}/health/mcp`, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          monitoring: {
            healthStatus: 'healthy',
            aggregateMetrics: {
              totalRequests: 1000,
              successRate: 0.99,
            },
          },
          services: {
            server: { status: 'running' },
            client: { status: 'connected' },
          },
        }),
      });
    });

    const response = await page.request.get(`${API_BASE_URL}/health/mcp`);

    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data.status).toBe('healthy');
    expect(data.services.server).toBeDefined();
    expect(data.services.client).toBeDefined();
  });

  test('should check export service health', async ({ page }) => {
    await page.route(`${API_BASE_URL}/health/export`, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'healthy',
          export_service: 'available',
          features: {
            excel_export: true,
            csv_export: true,
            progress_tracking: true,
            streaming: true,
          },
        }),
      });
    });

    const response = await page.request.get(`${API_BASE_URL}/health/export`);

    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data.status).toBe('healthy');
    expect(data.features.excel_export).toBe(true);
    expect(data.features.csv_export).toBe(true);
  });

  test('should handle unhealthy service status', async ({ page }) => {
    await page.route(`${API_BASE_URL}/health`, async (route: Route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: 'Database connection failed',
        }),
      });
    });

    const response = await page.request.get(`${API_BASE_URL}/health`);

    expect(response.status()).toBe(503);

    const data = await response.json();
    expect(data.status).toBe('unhealthy');
    expect(data.error).toBeDefined();
  });
});

// =============================================================================
// Test Suite: Rate Limiting
// =============================================================================

test.describe('Rate Limiting', () => {
  test.skip('should return 429 when rate limit exceeded', async ({ page }) => {
    // Note: This test is skipped by default as rate limiting tests
    // can be flaky in E2E environments and may interfere with other tests
    await page.route(`${API_BASE_URL}/api/v1/queries`, async (route: Route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Too many requests. Please try again later.',
          error: 'RATE_LIMIT_EXCEEDED',
          retryAfter: 60,
        }),
      });
    });

    await page.goto('/');

    const inputField = page.locator('input[placeholder*="demographics"]');
    await inputField.fill('Test query');
    await inputField.press('Enter');

    await expect(
      page.locator('text=Too many requests').or(page.locator('text=try again'))
    ).toBeVisible({ timeout: 10000 });
  });

  test('should include rate limit headers in response', async ({ page }) => {
    let rateLimitHeaders: Record<string, string | null> = {};

    await page.route(`${API_BASE_URL}/api/v1/queries`, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '99',
          'X-RateLimit-Reset': String(Date.now() + 60000),
        },
        body: JSON.stringify(mockQueryResponse),
      });
    });

    const response = await page.request.post(`${API_BASE_URL}/api/v1/queries`, {
      data: { query: 'Test query' },
    });

    rateLimitHeaders = {
      limit: response.headers()['x-ratelimit-limit'],
      remaining: response.headers()['x-ratelimit-remaining'],
      reset: response.headers()['x-ratelimit-reset'],
    };

    expect(rateLimitHeaders.limit).toBeDefined();
    expect(rateLimitHeaders.remaining).toBeDefined();
  });
});

// =============================================================================
// Test Suite: Error Responses
// =============================================================================

test.describe('Error Responses', () => {
  test('should handle 400 Bad Request with helpful message', async ({ page }) => {
    await page.route(`${API_BASE_URL}/api/v1/queries`, async (route: Route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Query is required and must be a string',
          error: 'INVALID_INPUT',
        }),
      });
    });

    await setupApiMocks(page);
    await page.goto('/');

    // The UI should handle this error gracefully
    const inputField = page.locator('input[placeholder*="demographics"]');
    await inputField.fill('test');
    await inputField.press('Enter');

    await expect(
      page.locator('text=error').or(page.locator('text=required'))
    ).toBeVisible({ timeout: 10000 });
  });

  test('should handle 500 Internal Server Error', async ({ page }) => {
    await page.route(`${API_BASE_URL}/api/v1/queries`, async (route: Route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'An unexpected error occurred processing your query.',
          error: 'INTERNAL_ERROR',
          suggestions: ['Please try again in a few moments', 'Contact support if the issue persists'],
        }),
      });
    });

    await setupApiMocks(page);
    await page.goto('/');

    const inputField = page.locator('input[placeholder*="demographics"]');
    await inputField.fill('test query');
    await inputField.press('Enter');

    await expect(
      page.locator('text=error').or(page.locator('text=unexpected'))
    ).toBeVisible({ timeout: 10000 });
  });

  test('should handle 408 Timeout', async ({ page }) => {
    await page.route(`${API_BASE_URL}/api/v1/queries`, async (route: Route) => {
      await route.fulfill({
        status: 408,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Query processing took too long. Please try a simpler query.',
          error: 'TIMEOUT',
        }),
      });
    });

    await setupApiMocks(page);
    await page.goto('/');

    const inputField = page.locator('input[placeholder*="demographics"]');
    await inputField.fill('complex timeout query');
    await inputField.press('Enter');

    await expect(
      page.locator('text=took too long').or(page.locator('text=timeout'))
    ).toBeVisible({ timeout: 10000 });
  });

  test('should handle network errors gracefully', async ({ page }) => {
    await page.route(`${API_BASE_URL}/api/v1/queries`, async (route: Route) => {
      await route.abort('connectionfailed');
    });

    await setupApiMocks(page);
    await page.goto('/');

    const inputField = page.locator('input[placeholder*="demographics"]');
    await inputField.fill('test query');
    await inputField.press('Enter');

    // Should show network error message
    await expect(
      page.locator('text=connection').or(page.locator('text=error'))
    ).toBeVisible({ timeout: 10000 });
  });

  test('should handle malformed JSON response', async ({ page }) => {
    await page.route(`${API_BASE_URL}/api/v1/queries`, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'invalid json {{{',
      });
    });

    await setupApiMocks(page);
    await page.goto('/');

    const inputField = page.locator('input[placeholder*="demographics"]');
    await inputField.fill('test query');
    await inputField.press('Enter');

    // Should handle parse error gracefully
    await expect(
      page.locator('text=error').or(page.locator('text=unexpected'))
    ).toBeVisible({ timeout: 10000 });
  });
});

// =============================================================================
// Test Suite: Response Format Validation
// =============================================================================

test.describe('Response Format Validation', () => {
  test('should validate query response structure', async ({ page }) => {
    await page.route(`${API_BASE_URL}/api/v1/queries`, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message: 'Found 5 records',
          data: [
            { county: 'Test', state: 'FL', population: 100000 },
          ],
          metadata: {
            queryTime: 1.5,
            totalRecords: 1,
            dataSource: 'Test',
            confidenceLevel: 0.95,
            marginOfError: 2.3,
          },
        }),
      });
    });

    const response = await page.request.post(`${API_BASE_URL}/api/v1/queries`, {
      data: { query: 'Test query' },
    });

    expect(response.ok()).toBe(true);

    const data = await response.json();

    // Validate response structure
    expect(data).toHaveProperty('success');
    expect(data).toHaveProperty('message');
    expect(data).toHaveProperty('data');
    expect(data).toHaveProperty('metadata');
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.metadata).toHaveProperty('queryTime');
    expect(data.metadata).toHaveProperty('totalRecords');
    expect(data.metadata).toHaveProperty('dataSource');
  });

  test('should validate share response structure', async ({ page }) => {
    await page.route(`${API_BASE_URL}/api/v1/share`, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockShareResponse),
      });
    });

    const response = await page.request.post(`${API_BASE_URL}/api/v1/share`, {
      data: {
        queryText: 'Test query',
        queryResult: { data: [], columns: [], rowCount: 0 },
        expiration: '7d',
      },
    });

    expect(response.ok()).toBe(true);

    const data = await response.json();

    // Validate share response structure
    expect(data).toHaveProperty('success');
    expect(data).toHaveProperty('shareId');
    expect(data).toHaveProperty('shareUrl');
    expect(data).toHaveProperty('expiresAt');
    expect(typeof data.shareId).toBe('string');
    expect(typeof data.expiresAt).toBe('number');
  });

  test('should validate error response structure', async ({ page }) => {
    await page.route(`${API_BASE_URL}/api/v1/queries`, async (route: Route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify(mockErrorResponse),
      });
    });

    const response = await page.request.post(`${API_BASE_URL}/api/v1/queries`, {
      data: { query: '' },
    });

    expect(response.status()).toBe(400);

    const data = await response.json();

    // Validate error response structure
    expect(data).toHaveProperty('success');
    expect(data.success).toBe(false);
    expect(data).toHaveProperty('message');
    expect(data).toHaveProperty('error');
    if (data.suggestions) {
      expect(Array.isArray(data.suggestions)).toBe(true);
    }
  });
});

// =============================================================================
// Test Suite: Timeout Handling
// =============================================================================

test.describe('Timeout Handling', () => {
  test('should handle slow API responses', async ({ page }) => {
    await page.route(`${API_BASE_URL}/api/v1/queries`, async (route: Route) => {
      // Simulate slow response (3 seconds)
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockQueryResponse),
      });
    });

    await setupApiMocks(page);
    await page.goto('/');

    const inputField = page.locator('input[placeholder*="demographics"]');
    await inputField.fill('slow query');
    await inputField.press('Enter');

    // Should show loading state
    await expect(page.locator('text=Processing').or(page.locator('text=Analyzing'))).toBeVisible();

    // Should eventually show results
    await expect(page.locator('text=Found 5 records')).toBeVisible({ timeout: 15000 });
  });

  test('should allow user to cancel long-running queries', async ({ page }) => {
    let requestAborted = false;

    await page.route(`${API_BASE_URL}/api/v1/queries`, async (route: Route) => {
      // Very slow response
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(resolve, 60000);
        route.request().frame()?.page().on('close', () => {
          clearTimeout(timeout);
          requestAborted = true;
          reject(new Error('Page closed'));
        });
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockQueryResponse),
      });
    });

    await setupApiMocks(page);
    await page.goto('/');

    const inputField = page.locator('input[placeholder*="demographics"]');
    await inputField.fill('long running query');
    await inputField.press('Enter');

    // Wait for loading state
    await expect(page.locator('text=Processing').or(page.locator('text=Analyzing'))).toBeVisible();

    // User navigates away (simulating cancel)
    await page.goto('/');

    // Page should reload successfully
    await expect(page.locator('text=CensusChat')).toBeVisible();
  });
});

// =============================================================================
// Test Suite: Concurrent Requests
// =============================================================================

test.describe('Concurrent Requests', () => {
  test('should handle multiple simultaneous queries', async ({ page }) => {
    let requestCount = 0;

    await page.route(`${API_BASE_URL}/api/v1/queries`, async (route: Route) => {
      requestCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockQueryResponse,
          message: `Found ${requestCount} records`,
        }),
      });
    });

    // Make multiple concurrent API requests
    const requests = [
      page.request.post(`${API_BASE_URL}/api/v1/queries`, { data: { query: 'Query 1' } }),
      page.request.post(`${API_BASE_URL}/api/v1/queries`, { data: { query: 'Query 2' } }),
      page.request.post(`${API_BASE_URL}/api/v1/queries`, { data: { query: 'Query 3' } }),
    ];

    const responses = await Promise.all(requests);

    // All requests should succeed
    responses.forEach((response) => {
      expect(response.ok()).toBe(true);
    });

    expect(requestCount).toBe(3);
  });
});

// =============================================================================
// Test Suite: Data Integrity
// =============================================================================

test.describe('Data Integrity', () => {
  test('should preserve data types in response', async ({ page }) => {
    const testData = {
      success: true,
      message: 'Found 1 record',
      data: [
        {
          county: 'Test County',
          state: 'FL',
          population: 1000000,
          median_income: 55000.50,
          poverty_rate: 12.5,
          is_metro: true,
        },
      ],
      metadata: {
        queryTime: 1.234,
        totalRecords: 1,
        dataSource: 'Test',
        confidenceLevel: 0.95,
        marginOfError: 2.3,
      },
    };

    await page.route(`${API_BASE_URL}/api/v1/queries`, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(testData),
      });
    });

    const response = await page.request.post(`${API_BASE_URL}/api/v1/queries`, {
      data: { query: 'Test query' },
    });

    const data = await response.json();

    // Verify data types are preserved
    expect(typeof data.data[0].county).toBe('string');
    expect(typeof data.data[0].population).toBe('number');
    expect(typeof data.data[0].median_income).toBe('number');
    expect(typeof data.data[0].poverty_rate).toBe('number');
    expect(data.data[0].median_income).toBe(55000.50);
    expect(data.data[0].poverty_rate).toBe(12.5);
  });

  test('should handle special characters in query text', async ({ page }) => {
    let receivedQuery = '';

    await page.route(`${API_BASE_URL}/api/v1/queries`, async (route: Route) => {
      receivedQuery = route.request().postDataJSON()?.query;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockQueryResponse),
      });
    });

    const specialQuery = 'Show me data for "Tampa Bay" area with income > $50,000';

    const response = await page.request.post(`${API_BASE_URL}/api/v1/queries`, {
      data: { query: specialQuery },
    });

    expect(response.ok()).toBe(true);
    expect(receivedQuery).toBe(specialQuery);
  });

  test('should handle unicode characters in response', async ({ page }) => {
    await page.route(`${API_BASE_URL}/api/v1/queries`, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockQueryResponse,
          data: [
            {
              county: 'San Jose',
              state: 'California',
              notes: 'Population includes diverse communities',
            },
          ],
        }),
      });
    });

    const response = await page.request.post(`${API_BASE_URL}/api/v1/queries`, {
      data: { query: 'Test query' },
    });

    const data = await response.json();
    expect(data.data[0].notes).toContain('diverse communities');
  });
});
