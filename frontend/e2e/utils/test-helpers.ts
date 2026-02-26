/**
 * Test helper utilities for Playwright e2e tests
 */

import { Page, Route, Request } from '@playwright/test';
import {
  mockQueryResponse,
  mockShareResponse,
  mockSharedQuery,
  mockAnalyticsDashboard,
  mockHealthResponse,
  mockErrorResponse
} from '../fixtures/mock-data';

const API_BASE = 'http://localhost:3001';

/**
 * Setup API mocks for common endpoints
 */
export async function setupApiMocks(page: Page, options: {
  mockQueries?: boolean;
  mockSharing?: boolean;
  mockAnalytics?: boolean;
  mockHealth?: boolean;
} = {}) {
  const {
    mockQueries = true,
    mockSharing = true,
    mockAnalytics = true,
    mockHealth = true
  } = options;

  // Mock query endpoint
  if (mockQueries) {
    await page.route(`${API_BASE}/api/v1/queries`, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockQueryResponse)
      });
    });
  }

  // Mock sharing endpoints
  if (mockSharing) {
    // Create share
    await page.route(`${API_BASE}/api/v1/share`, async (route: Route, request: Request) => {
      if (request.method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(mockShareResponse)
        });
      } else {
        await route.continue();
      }
    });

    // Get share
    await page.route(`${API_BASE}/api/v1/share/*`, async (route: Route, request: Request) => {
      if (request.method() === 'GET') {
        const url = request.url();
        if (url.includes('metadata')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              metadata: {
                exists: true,
                title: mockSharedQuery.title,
                category: mockSharedQuery.category,
                viewCount: mockSharedQuery.viewCount,
                rowCount: mockSharedQuery.queryResult.rowCount
              }
            })
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              share: mockSharedQuery
            })
          });
        }
      } else {
        await route.continue();
      }
    });
  }

  // Mock analytics endpoints
  if (mockAnalytics) {
    await page.route(`${API_BASE}/api/v1/analytics/**`, async (route: Route) => {
      const url = route.request().url();

      if (url.includes('/dashboard')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: mockAnalyticsDashboard
          })
        });
      } else if (url.includes('/track')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      } else if (url.includes('/summary')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: mockAnalyticsDashboard.summary
          })
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: {} })
        });
      }
    });
  }

  // Mock health endpoint
  if (mockHealth) {
    await page.route(`${API_BASE}/health`, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockHealthResponse)
      });
    });
  }
}

/**
 * Setup error mock for query endpoint
 */
export async function setupQueryErrorMock(page: Page) {
  await page.route(`${API_BASE}/api/v1/queries`, async (route: Route) => {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify(mockErrorResponse)
    });
  });
}

/**
 * Setup timeout mock for query endpoint
 */
export async function setupQueryTimeoutMock(page: Page, delayMs: number = 35000) {
  await page.route(`${API_BASE}/api/v1/queries`, async (route: Route) => {
    await new Promise(resolve => setTimeout(resolve, delayMs));
    await route.fulfill({
      status: 408,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        message: 'Query processing took too long',
        error: 'TIMEOUT'
      })
    });
  });
}

/**
 * Setup share not found mock
 */
export async function setupShareNotFoundMock(page: Page) {
  await page.route(`${API_BASE}/api/v1/share/*`, async (route: Route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: 'Share not found or expired'
      })
    });
  });
}

/**
 * Wait for API request to complete
 */
export async function waitForApiRequest(page: Page, urlPattern: string | RegExp): Promise<void> {
  await page.waitForResponse(
    response => {
      if (typeof urlPattern === 'string') {
        return response.url().includes(urlPattern);
      }
      return urlPattern.test(response.url());
    },
    { timeout: 10000 }
  );
}

/**
 * Submit a query in the chat interface
 */
export async function submitQuery(page: Page, query: string): Promise<void> {
  const input = page.getByPlaceholder(/ask about/i);
  await input.fill(query);
  await page.getByRole('button', { name: /send/i }).click();
}

/**
 * Wait for loading to complete
 */
export async function waitForQueryResult(page: Page): Promise<void> {
  // Wait for loading message to disappear
  await page.waitForFunction(() => {
    const loadingText = document.body.innerText;
    return !loadingText.includes('Analyzing your query...');
  }, { timeout: 15000 });
}

/**
 * Get text content from results table
 */
export async function getTableData(page: Page): Promise<string[][]> {
  const rows = await page.locator('table tbody tr').all();
  const data: string[][] = [];

  for (const row of rows) {
    const cells = await row.locator('td').allTextContents();
    data.push(cells);
  }

  return data;
}

/**
 * Check if element is visible with retry
 */
export async function isElementVisible(
  page: Page,
  selector: string,
  timeout: number = 5000
): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { state: 'visible', timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * Take screenshot with timestamp
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({
    path: `test-results/screenshots/${name}-${timestamp}.png`,
    fullPage: true
  });
}
