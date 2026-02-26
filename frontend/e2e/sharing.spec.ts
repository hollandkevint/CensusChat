import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests for CensusChat Sharing Feature
 *
 * Tests cover:
 * 1. Share Dialog - opening, closing, UI elements
 * 2. Expiration Options - selecting different expiration periods
 * 3. Title/Description - adding optional metadata
 * 4. Create Share - generating share links
 * 5. Copy Link - clipboard functionality
 * 6. Shared View Page - viewing shared queries at /share/[id]
 * 7. Share Expiration - handling expired shares
 * 8. Share Not Found - handling invalid share IDs
 */

// Test data for mocking API responses
const mockQueryResult = {
  sql: 'SELECT * FROM county_data WHERE state_fips = \'12\' LIMIT 10',
  data: [
    { county_name: 'Miami-Dade', state_name: 'Florida', population: 2716940, median_income: 55000 },
    { county_name: 'Broward', state_name: 'Florida', population: 1944375, median_income: 58000 },
    { county_name: 'Palm Beach', state_name: 'Florida', population: 1496770, median_income: 62000 },
  ],
  columns: ['county_name', 'state_name', 'population', 'median_income'],
  rowCount: 3,
};

const mockSharedQuery = {
  id: 'test-share-abc123',
  queryText: 'Show me population data for Florida counties',
  queryResult: mockQueryResult,
  category: 'demographics' as const,
  createdAt: Date.now() - 3600000, // 1 hour ago
  expiresAt: Date.now() + 604800000, // 7 days from now
  expirationOption: '7d' as const,
  viewCount: 5,
  title: 'Florida County Demographics',
  description: 'Population and income data for major Florida counties',
};

const mockExpiredShare = {
  ...mockSharedQuery,
  id: 'expired-share-xyz789',
  expiresAt: Date.now() - 3600000, // Expired 1 hour ago
};

test.describe('Share Dialog', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the share creation API
    await page.route('**/api/v1/share', async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            shareId: 'new-share-id-123',
            shareUrl: `${page.url()}/share/new-share-id-123`,
            expiresAt: Date.now() + 604800000,
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock the query API to return test data
    await page.route('**/api/v1/query', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockQueryResult.data,
          metadata: {
            queryTime: 0.5,
            totalRecords: 3,
            dataSource: 'US Census Bureau',
          },
        }),
      });
    });

    // Mock MCP resources endpoint
    await page.route('**/api/v1/mcp/resources', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
  });

  test('opens when share button is clicked', async ({ page }) => {
    await page.goto('/');

    // Submit a query first to get results with a share button
    const queryInput = page.locator('input[placeholder*="Ask about healthcare"]');
    await queryInput.fill('Show me Florida counties');
    await page.click('button:has-text("Send")');

    // Wait for results to load
    await expect(page.locator('button:has-text("Share")')).toBeVisible({ timeout: 10000 });

    // Click the share button
    await page.click('button:has-text("Share")');

    // Verify dialog appears
    await expect(page.getByRole('heading', { name: /Share Query Results/i })).toBeVisible();
    await expect(page.locator('.fixed.inset-0')).toBeVisible();
  });

  test('closes when X button is clicked', async ({ page }) => {
    await page.goto('/');

    // Submit a query and open share dialog
    const queryInput = page.locator('input[placeholder*="Ask about healthcare"]');
    await queryInput.fill('Show me Florida counties');
    await page.click('button:has-text("Send")');
    await expect(page.locator('button:has-text("Share")')).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("Share")');

    // Wait for dialog to open
    await expect(page.getByRole('heading', { name: /Share Query Results/i })).toBeVisible();

    // Click X button (close button in header)
    await page.locator('.fixed.inset-0 button').filter({ has: page.locator('svg') }).first().click();

    // Verify dialog is closed
    await expect(page.getByRole('heading', { name: /Share Query Results/i })).not.toBeVisible();
  });

  test('closes when Cancel button is clicked', async ({ page }) => {
    await page.goto('/');

    // Submit a query and open share dialog
    const queryInput = page.locator('input[placeholder*="Ask about healthcare"]');
    await queryInput.fill('Show me Florida counties');
    await page.click('button:has-text("Send")');
    await expect(page.locator('button:has-text("Share")')).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("Share")');

    // Wait for dialog to open
    await expect(page.getByRole('heading', { name: /Share Query Results/i })).toBeVisible();

    // Click Cancel button
    await page.click('button:has-text("Cancel")');

    // Verify dialog is closed
    await expect(page.getByRole('heading', { name: /Share Query Results/i })).not.toBeVisible();
  });

  test('displays query preview in dialog', async ({ page }) => {
    await page.goto('/');

    // Submit a specific query
    const queryText = 'Show me Medicare eligible seniors in Tampa Bay';
    const queryInput = page.locator('input[placeholder*="Ask about healthcare"]');
    await queryInput.fill(queryText);
    await page.click('button:has-text("Send")');
    await expect(page.locator('button:has-text("Share")')).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("Share")');

    // Verify query text is shown in the dialog
    await expect(page.locator('.fixed.inset-0')).toContainText('Query');
    await expect(page.locator('.fixed.inset-0')).toContainText('3 rows');
  });
});

test.describe('Expiration Options', () => {
  test.beforeEach(async ({ page }) => {
    // Mock APIs
    await page.route('**/api/v1/share', async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            shareId: 'share-with-expiration',
            expiresAt: Date.now() + 3600000, // Varies based on expiration
          }),
        });
      }
    });

    await page.route('**/api/v1/query', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockQueryResult.data,
          metadata: { queryTime: 0.5, totalRecords: 3, dataSource: 'US Census Bureau' },
        }),
      });
    });

    await page.route('**/api/v1/mcp/resources', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
  });

  const expirationOptions = [
    { value: '1h', label: '1 hour' },
    { value: '24h', label: '24 hours' },
    { value: '7d', label: '7 days' },
    { value: '30d', label: '30 days' },
    { value: 'never', label: 'Never' },
  ];

  test('displays all expiration options', async ({ page }) => {
    await page.goto('/');

    // Submit query and open dialog
    const queryInput = page.locator('input[placeholder*="Ask about healthcare"]');
    await queryInput.fill('Show me county data');
    await page.click('button:has-text("Send")');
    await expect(page.locator('button:has-text("Share")')).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("Share")');

    // Verify all expiration options are visible
    for (const option of expirationOptions) {
      await expect(page.getByRole('button', { name: option.label, exact: true })).toBeVisible();
    }
  });

  test('selects 7 days by default', async ({ page }) => {
    await page.goto('/');

    // Submit query and open dialog
    const queryInput = page.locator('input[placeholder*="Ask about healthcare"]');
    await queryInput.fill('Show me county data');
    await page.click('button:has-text("Send")');
    await expect(page.locator('button:has-text("Share")')).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("Share")');

    // Verify 7 days is selected (has active styling)
    const sevenDaysButton = page.getByRole('button', { name: '7 days', exact: true });
    await expect(sevenDaysButton).toHaveClass(/bg-blue-500/);
  });

  test('can select different expiration options', async ({ page }) => {
    await page.goto('/');

    // Submit query and open dialog
    const queryInput = page.locator('input[placeholder*="Ask about healthcare"]');
    await queryInput.fill('Show me county data');
    await page.click('button:has-text("Send")');
    await expect(page.locator('button:has-text("Share")')).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("Share")');

    // Select 1 hour expiration
    const oneHourButton = page.getByRole('button', { name: '1 hour', exact: true });
    await oneHourButton.click();
    await expect(oneHourButton).toHaveClass(/bg-blue-500/);

    // Verify 7 days is no longer selected
    const sevenDaysButton = page.getByRole('button', { name: '7 days', exact: true });
    await expect(sevenDaysButton).not.toHaveClass(/bg-blue-500/);

    // Select Never expiration
    const neverButton = page.getByRole('button', { name: 'Never', exact: true });
    await neverButton.click();
    await expect(neverButton).toHaveClass(/bg-blue-500/);
  });
});

test.describe('Title and Description', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/share', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            shareId: 'titled-share-123',
            expiresAt: Date.now() + 604800000,
          }),
        });
      }
    });

    await page.route('**/api/v1/query', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockQueryResult.data,
          metadata: { queryTime: 0.5, totalRecords: 3, dataSource: 'US Census Bureau' },
        }),
      });
    });

    await page.route('**/api/v1/mcp/resources', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
  });

  test('displays title and description input fields', async ({ page }) => {
    await page.goto('/');

    // Submit query and open dialog
    const queryInput = page.locator('input[placeholder*="Ask about healthcare"]');
    await queryInput.fill('Show me county data');
    await page.click('button:has-text("Send")');
    await expect(page.locator('button:has-text("Share")')).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("Share")');

    // Verify title and description fields exist
    await expect(page.getByPlaceholder(/Give your share a name/i)).toBeVisible();
    await expect(page.getByPlaceholder(/Add context about this query/i)).toBeVisible();
  });

  test('can add optional title', async ({ page }) => {
    await page.goto('/');

    // Submit query and open dialog
    const queryInput = page.locator('input[placeholder*="Ask about healthcare"]');
    await queryInput.fill('Show me county data');
    await page.click('button:has-text("Send")');
    await expect(page.locator('button:has-text("Share")')).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("Share")');

    // Fill in title
    const titleInput = page.getByPlaceholder(/Give your share a name/i);
    await titleInput.fill('My Custom Report Title');
    await expect(titleInput).toHaveValue('My Custom Report Title');
  });

  test('can add optional description', async ({ page }) => {
    await page.goto('/');

    // Submit query and open dialog
    const queryInput = page.locator('input[placeholder*="Ask about healthcare"]');
    await queryInput.fill('Show me county data');
    await page.click('button:has-text("Send")');
    await expect(page.locator('button:has-text("Share")')).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("Share")');

    // Fill in description
    const descriptionInput = page.getByPlaceholder(/Add context about this query/i);
    await descriptionInput.fill('This report shows population data for healthcare planning purposes.');
    await expect(descriptionInput).toHaveValue(
      'This report shows population data for healthcare planning purposes.'
    );
  });

  test('sends title and description in API request', async ({ page }) => {
    let capturedRequest: any = null;

    await page.route('**/api/v1/share', async (route) => {
      if (route.request().method() === 'POST') {
        capturedRequest = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            shareId: 'titled-share-123',
            expiresAt: Date.now() + 604800000,
          }),
        });
      }
    });

    await page.goto('/');

    // Submit query and open dialog
    const queryInput = page.locator('input[placeholder*="Ask about healthcare"]');
    await queryInput.fill('Show me county data');
    await page.click('button:has-text("Send")');
    await expect(page.locator('button:has-text("Share")')).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("Share")');

    // Fill in title and description
    await page.getByPlaceholder(/Give your share a name/i).fill('Healthcare Analysis');
    await page.getByPlaceholder(/Add context about this query/i).fill('Q4 demographics review');

    // Create the share
    await page.click('button:has-text("Create Link")');

    // Wait for success state
    await expect(page.getByRole('heading', { name: /Link Created/i })).toBeVisible();

    // Verify request contained title and description
    expect(capturedRequest).not.toBeNull();
    expect(capturedRequest.title).toBe('Healthcare Analysis');
    expect(capturedRequest.description).toBe('Q4 demographics review');
  });
});

test.describe('Create Share', () => {
  test('creates share and shows success state', async ({ page }) => {
    await page.route('**/api/v1/share', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            shareId: 'success-share-id',
            expiresAt: Date.now() + 604800000,
          }),
        });
      }
    });

    await page.route('**/api/v1/query', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockQueryResult.data,
          metadata: { queryTime: 0.5, totalRecords: 3, dataSource: 'US Census Bureau' },
        }),
      });
    });

    await page.route('**/api/v1/mcp/resources', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/');

    // Submit query and open dialog
    const queryInput = page.locator('input[placeholder*="Ask about healthcare"]');
    await queryInput.fill('Show me county data');
    await page.click('button:has-text("Send")');
    await expect(page.locator('button:has-text("Share")')).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("Share")');

    // Click Create Link button
    await page.click('button:has-text("Create Link")');

    // Verify success state
    await expect(page.getByRole('heading', { name: /Link Created/i })).toBeVisible();
    await expect(page.locator('text=Expires 7 days')).toBeVisible();

    // Verify share URL is displayed
    const urlInput = page.locator('input[readonly]');
    await expect(urlInput).toBeVisible();
    await expect(urlInput).toHaveValue(/\/share\/success-share-id/);
  });

  test('shows loading state while creating', async ({ page }) => {
    // Add delay to observe loading state
    await page.route('**/api/v1/share', async (route) => {
      if (route.request().method() === 'POST') {
        await new Promise((resolve) => setTimeout(resolve, 500));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            shareId: 'delayed-share-id',
            expiresAt: Date.now() + 604800000,
          }),
        });
      }
    });

    await page.route('**/api/v1/query', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockQueryResult.data,
          metadata: { queryTime: 0.5, totalRecords: 3, dataSource: 'US Census Bureau' },
        }),
      });
    });

    await page.route('**/api/v1/mcp/resources', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/');

    // Submit query and open dialog
    const queryInput = page.locator('input[placeholder*="Ask about healthcare"]');
    await queryInput.fill('Show me county data');
    await page.click('button:has-text("Send")');
    await expect(page.locator('button:has-text("Share")')).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("Share")');

    // Click Create Link and verify loading state
    await page.click('button:has-text("Create Link")');
    await expect(page.locator('text=Creating...')).toBeVisible();

    // Wait for completion
    await expect(page.getByRole('heading', { name: /Link Created/i })).toBeVisible();
  });

  test('shows error message on failure', async ({ page }) => {
    await page.route('**/api/v1/share', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Rate limit exceeded. Please try again later.',
          }),
        });
      }
    });

    await page.route('**/api/v1/query', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockQueryResult.data,
          metadata: { queryTime: 0.5, totalRecords: 3, dataSource: 'US Census Bureau' },
        }),
      });
    });

    await page.route('**/api/v1/mcp/resources', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/');

    // Submit query and open dialog
    const queryInput = page.locator('input[placeholder*="Ask about healthcare"]');
    await queryInput.fill('Show me county data');
    await page.click('button:has-text("Send")');
    await expect(page.locator('button:has-text("Share")')).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("Share")');

    // Try to create share
    await page.click('button:has-text("Create Link")');

    // Verify error is displayed
    await expect(page.locator('text=Rate limit exceeded. Please try again later.')).toBeVisible();
  });

  test('Done button closes dialog after successful creation', async ({ page }) => {
    await page.route('**/api/v1/share', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            shareId: 'done-test-id',
            expiresAt: Date.now() + 604800000,
          }),
        });
      }
    });

    await page.route('**/api/v1/query', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockQueryResult.data,
          metadata: { queryTime: 0.5, totalRecords: 3, dataSource: 'US Census Bureau' },
        }),
      });
    });

    await page.route('**/api/v1/mcp/resources', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/');

    // Submit query and open dialog
    const queryInput = page.locator('input[placeholder*="Ask about healthcare"]');
    await queryInput.fill('Show me county data');
    await page.click('button:has-text("Send")');
    await expect(page.locator('button:has-text("Share")')).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("Share")');

    // Create share
    await page.click('button:has-text("Create Link")');
    await expect(page.getByRole('heading', { name: /Link Created/i })).toBeVisible();

    // Click Done button
    await page.click('button:has-text("Done")');

    // Verify dialog is closed
    await expect(page.getByRole('heading', { name: /Link Created/i })).not.toBeVisible();
  });
});

test.describe('Copy Link', () => {
  test.beforeEach(async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.route('**/api/v1/share', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            shareId: 'copy-test-share-id',
            expiresAt: Date.now() + 604800000,
          }),
        });
      }
    });

    await page.route('**/api/v1/query', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockQueryResult.data,
          metadata: { queryTime: 0.5, totalRecords: 3, dataSource: 'US Census Bureau' },
        }),
      });
    });

    await page.route('**/api/v1/mcp/resources', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
  });

  test('copy button shows success state when clicked', async ({ page }) => {
    await page.goto('/');

    // Submit query and open dialog
    const queryInput = page.locator('input[placeholder*="Ask about healthcare"]');
    await queryInput.fill('Show me county data');
    await page.click('button:has-text("Send")');
    await expect(page.locator('button:has-text("Share")')).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("Share")');

    // Create share
    await page.click('button:has-text("Create Link")');
    await expect(page.getByRole('heading', { name: /Link Created/i })).toBeVisible();

    // Find and click copy button (button with copy icon in URL section)
    const copyButton = page.locator('button[title*="Copy"]');
    await copyButton.click();

    // Verify button shows success state (changes to check icon)
    await expect(page.locator('button[title="Copied!"]')).toBeVisible();
  });

  test('copies share URL to clipboard', async ({ page }) => {
    await page.goto('/');

    // Submit query and open dialog
    const queryInput = page.locator('input[placeholder*="Ask about healthcare"]');
    await queryInput.fill('Show me county data');
    await page.click('button:has-text("Send")');
    await expect(page.locator('button:has-text("Share")')).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("Share")');

    // Create share
    await page.click('button:has-text("Create Link")');
    await expect(page.getByRole('heading', { name: /Link Created/i })).toBeVisible();

    // Click copy button
    const copyButton = page.locator('button[title*="Copy"]');
    await copyButton.click();

    // Read clipboard and verify content
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('/share/copy-test-share-id');
  });
});

test.describe('Shared View Page', () => {
  test('displays shared query content', async ({ page }) => {
    await page.route('**/api/v1/share/test-share-abc123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          share: mockSharedQuery,
        }),
      });
    });

    await page.goto('/share/test-share-abc123');

    // Verify title is displayed
    await expect(page.getByRole('heading', { name: mockSharedQuery.title! })).toBeVisible();

    // Verify description is displayed
    await expect(page.locator(`text=${mockSharedQuery.description}`)).toBeVisible();

    // Verify query text is displayed
    await expect(page.locator(`text=${mockSharedQuery.queryText}`)).toBeVisible();

    // Verify view count is displayed
    await expect(page.locator(`text=${mockSharedQuery.viewCount} views`)).toBeVisible();

    // Verify row count is displayed
    await expect(page.locator(`text=${mockSharedQuery.queryResult.rowCount} rows`)).toBeVisible();
  });

  test('displays category badge', async ({ page }) => {
    await page.route('**/api/v1/share/test-share-abc123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          share: mockSharedQuery,
        }),
      });
    });

    await page.goto('/share/test-share-abc123');

    // Verify category badge is displayed
    await expect(page.locator('text=demographics')).toBeVisible();
  });

  test('displays data table with columns and rows', async ({ page }) => {
    await page.route('**/api/v1/share/test-share-abc123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          share: mockSharedQuery,
        }),
      });
    });

    await page.goto('/share/test-share-abc123');

    // Verify Query Results heading
    await expect(page.locator('h2:has-text("Query Results")')).toBeVisible();

    // Verify column headers are present
    for (const column of mockSharedQuery.queryResult.columns) {
      await expect(page.locator(`th:has-text("${column}")`)).toBeVisible();
    }

    // Verify data is displayed
    await expect(page.locator('td:has-text("Miami-Dade")')).toBeVisible();
    await expect(page.locator('td:has-text("Broward")')).toBeVisible();
  });

  test('displays SQL preview when available', async ({ page }) => {
    await page.route('**/api/v1/share/test-share-abc123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          share: mockSharedQuery,
        }),
      });
    });

    await page.goto('/share/test-share-abc123');

    // Verify SQL section is displayed
    await expect(page.locator('h2:has-text("Generated SQL")')).toBeVisible();
    await expect(page.locator(`text=SELECT * FROM county_data`)).toBeVisible();
  });

  test('displays loading state while fetching', async ({ page }) => {
    await page.route('**/api/v1/share/slow-share', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          share: mockSharedQuery,
        }),
      });
    });

    await page.goto('/share/slow-share');

    // Verify loading state
    await expect(page.locator('text=Loading shared query...')).toBeVisible();

    // Wait for content to load
    await expect(page.getByRole('heading', { name: mockSharedQuery.title! })).toBeVisible();
  });

  test('has back to CensusChat link', async ({ page }) => {
    await page.route('**/api/v1/share/test-share-abc123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          share: mockSharedQuery,
        }),
      });
    });

    await page.goto('/share/test-share-abc123');

    // Verify back link exists
    const backLink = page.locator('a:has-text("Back to CensusChat")');
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveAttribute('href', '/');
  });

  test('displays expiration information', async ({ page }) => {
    await page.route('**/api/v1/share/test-share-abc123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          share: mockSharedQuery,
        }),
      });
    });

    await page.goto('/share/test-share-abc123');

    // Verify expiration info is shown (Expires in X days)
    await expect(page.locator('text=/Expires in \\d+ days?/')).toBeVisible();
  });
});

test.describe('Share Expiration', () => {
  test('shows error message for expired shares', async ({ page }) => {
    await page.route('**/api/v1/share/expired-share-xyz789', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'This share has expired',
        }),
      });
    });

    await page.goto('/share/expired-share-xyz789');

    // Verify error state is shown
    await expect(page.getByRole('heading', { name: /Share Not Found/i })).toBeVisible();
    await expect(page.locator('text=This share has expired')).toBeVisible();
  });

  test('shows link to CensusChat from expired share page', async ({ page }) => {
    await page.route('**/api/v1/share/expired-share-xyz789', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'This share has expired',
        }),
      });
    });

    await page.goto('/share/expired-share-xyz789');

    // Verify link to CensusChat is shown
    const censuschatLink = page.locator('a:has-text("Go to CensusChat")');
    await expect(censuschatLink).toBeVisible();
    await expect(censuschatLink).toHaveAttribute('href', '/');
  });
});

test.describe('Share Not Found', () => {
  test('shows 404 state for invalid share ID', async ({ page }) => {
    await page.route('**/api/v1/share/invalid-id-xyz', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Share not found or expired',
        }),
      });
    });

    await page.goto('/share/invalid-id-xyz');

    // Verify not found state
    await expect(page.getByRole('heading', { name: /Share Not Found/i })).toBeVisible();
    await expect(
      page.locator('text=Share not found or expired')
    ).toBeVisible();
  });

  test('shows 404 state for non-existent share', async ({ page }) => {
    await page.route('**/api/v1/share/non-existent-share', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Share not found',
        }),
      });
    });

    await page.goto('/share/non-existent-share');

    // Verify not found state
    await expect(page.getByRole('heading', { name: /Share Not Found/i })).toBeVisible();
  });

  test('shows generic message when no specific error provided', async ({ page }) => {
    await page.route('**/api/v1/share/unknown-error-share', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
        }),
      });
    });

    await page.goto('/share/unknown-error-share');

    // Verify generic error message
    await expect(page.getByRole('heading', { name: /Share Not Found/i })).toBeVisible();
    await expect(
      page.locator('text=This shared link may have expired or been deleted.')
    ).toBeVisible();
  });

  test('displays error icon on not found page', async ({ page }) => {
    await page.route('**/api/v1/share/no-share', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Share not found',
        }),
      });
    });

    await page.goto('/share/no-share');

    // Verify error icon container is visible (red background with AlertCircle icon)
    const errorIconContainer = page.locator('.bg-red-100, .dark\\:bg-red-900\\/30');
    await expect(errorIconContainer.first()).toBeVisible();
  });

  test('handles network errors gracefully', async ({ page }) => {
    await page.route('**/api/v1/share/network-error-share', async (route) => {
      await route.abort('failed');
    });

    await page.goto('/share/network-error-share');

    // Verify error state is shown (network error will result in not found state)
    await expect(page.getByRole('heading', { name: /Share Not Found/i })).toBeVisible();
  });
});

test.describe('Open in New Tab', () => {
  test('has open in new tab button', async ({ page, context }) => {
    await page.route('**/api/v1/share', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            shareId: 'new-tab-test-id',
            expiresAt: Date.now() + 604800000,
          }),
        });
      }
    });

    await page.route('**/api/v1/query', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockQueryResult.data,
          metadata: { queryTime: 0.5, totalRecords: 3, dataSource: 'US Census Bureau' },
        }),
      });
    });

    await page.route('**/api/v1/mcp/resources', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/');

    // Submit query and open dialog
    const queryInput = page.locator('input[placeholder*="Ask about healthcare"]');
    await queryInput.fill('Show me county data');
    await page.click('button:has-text("Send")');
    await expect(page.locator('button:has-text("Share")')).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("Share")');

    // Create share
    await page.click('button:has-text("Create Link")');
    await expect(page.getByRole('heading', { name: /Link Created/i })).toBeVisible();

    // Verify open in new tab button exists
    const openNewTabButton = page.locator('button[title="Open in new tab"]');
    await expect(openNewTabButton).toBeVisible();
  });
});

test.describe('State Reset', () => {
  test('dialog resets state when reopened', async ({ page }) => {
    await page.route('**/api/v1/share', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            shareId: 'reset-test-id',
            expiresAt: Date.now() + 604800000,
          }),
        });
      }
    });

    await page.route('**/api/v1/query', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockQueryResult.data,
          metadata: { queryTime: 0.5, totalRecords: 3, dataSource: 'US Census Bureau' },
        }),
      });
    });

    await page.route('**/api/v1/mcp/resources', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/');

    // Submit query
    const queryInput = page.locator('input[placeholder*="Ask about healthcare"]');
    await queryInput.fill('Show me county data');
    await page.click('button:has-text("Send")');
    await expect(page.locator('button:has-text("Share")')).toBeVisible({ timeout: 10000 });

    // Open dialog and fill fields
    await page.click('button:has-text("Share")');
    await page.getByPlaceholder(/Give your share a name/i).fill('Test Title');
    await page.locator('button:has-text("1 hour")').click();

    // Close dialog
    await page.click('button:has-text("Cancel")');

    // Reopen dialog
    await page.click('button:has-text("Share")');

    // Verify state is reset
    const titleInput = page.getByPlaceholder(/Give your share a name/i);
    await expect(titleInput).toHaveValue('');

    // Verify default expiration is selected again
    const sevenDaysButton = page.locator('button:has-text("7 days")');
    await expect(sevenDaysButton).toHaveClass(/bg-blue-500/);
  });
});
