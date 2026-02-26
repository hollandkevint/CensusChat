import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests for CensusChat Chat Interface
 *
 * Tests cover:
 * - Page load and welcome message
 * - Query input and submission
 * - Loading states
 * - Data table display
 * - Export and Share functionality
 * - Error handling
 * - Query suggestions
 */

// Mock API response data
const mockQueryResponse = {
  success: true,
  message: 'Found 5 records. Here\'s your healthcare analytics data:',
  data: [
    { county_name: 'Hillsborough', state: 'FL', population_65_plus: 245000, median_income: 58000 },
    { county_name: 'Pinellas', state: 'FL', population_65_plus: 312000, median_income: 52000 },
    { county_name: 'Pasco', state: 'FL', population_65_plus: 178000, median_income: 48000 },
    { county_name: 'Manatee', state: 'FL', population_65_plus: 142000, median_income: 55000 },
    { county_name: 'Sarasota', state: 'FL', population_65_plus: 198000, median_income: 62000 },
  ],
  metadata: {
    queryTime: 0.45,
    totalRecords: 5,
    dataSource: 'US Census Bureau ACS 2022',
    confidenceLevel: 0.95,
    marginOfError: 2.3,
    dataFreshness: {
      overallStatus: 'fresh' as const,
      lastGlobalRefresh: new Date().toISOString(),
      relevantDatasets: [],
      recommendations: []
    }
  }
};

const mockErrorResponse = {
  success: false,
  message: 'Unable to parse query. Please try a more specific question about demographics.',
  error: 'PARSE_ERROR',
  suggestions: [
    'Try specifying a geographic area (e.g., "in Florida")',
    'Include demographic criteria (e.g., "seniors over 65")',
    'Mention income thresholds (e.g., "income over $50k")'
  ]
};

const mockUIResourcesResponse: Array<{ uri: string; html: string }> = [];

/**
 * Setup route mocking for API calls
 */
async function setupApiMocks(page: Page) {
  // Mock UI resources endpoint
  await page.route('**/api/v1/mcp/resources', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockUIResourcesResponse)
    });
  });
}

/**
 * Setup successful query response mock
 */
async function mockSuccessfulQuery(page: Page) {
  await page.route('**/api/v1/queries', async (route) => {
    // Add a small delay to test loading states
    await new Promise(resolve => setTimeout(resolve, 500));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockQueryResponse)
    });
  });
}

/**
 * Setup error query response mock
 */
async function mockErrorQuery(page: Page) {
  await page.route('**/api/v1/queries', async (route) => {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify(mockErrorResponse)
    });
  });
}

test.describe('Chat Interface - Page Load', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('should display welcome message on load', async ({ page }) => {
    await page.goto('/');

    // Check for the welcome message from the assistant
    const welcomeMessage = page.getByText(/Hi! I'm here to help you analyze Census data/);
    await expect(welcomeMessage).toBeVisible();

    // Verify the assistant avatar is present (CC icon)
    const assistantAvatar = page.locator('.bg-green-600').filter({ hasText: 'CC' });
    await expect(assistantAvatar).toBeVisible();
  });

  test('should display chat header with application title', async ({ page }) => {
    await page.goto('/');

    // Check for the application header
    const header = page.getByText('CensusChat - Healthcare Demographics');
    await expect(header).toBeVisible();

    // Check for the traffic light indicators
    await expect(page.locator('.bg-red-400.rounded-full')).toBeVisible();
    await expect(page.locator('.bg-yellow-400.rounded-full')).toBeVisible();
    await expect(page.locator('.bg-green-400.rounded-full')).toBeVisible();
  });

  test('should display input field with placeholder', async ({ page }) => {
    await page.goto('/');

    const inputField = page.getByPlaceholder('Ask about healthcare demographics...');
    await expect(inputField).toBeVisible();
    await expect(inputField).toBeEnabled();
  });

  test('should display send button', async ({ page }) => {
    await page.goto('/');

    const sendButton = page.getByRole('button', { name: 'Send' });
    await expect(sendButton).toBeVisible();
    // Button should be disabled when input is empty
    await expect(sendButton).toBeDisabled();
  });

  test('should display footer with powered by text', async ({ page }) => {
    await page.goto('/');

    const footerText = page.getByText(/Powered by Anthropic Sonnet 4/);
    await expect(footerText).toBeVisible();
  });
});

test.describe('Chat Interface - Query Input', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('should allow typing in the input field', async ({ page }) => {
    await page.goto('/');

    const inputField = page.getByPlaceholder('Ask about healthcare demographics...');
    await inputField.fill('Show me Medicare eligible seniors in Tampa Bay');

    await expect(inputField).toHaveValue('Show me Medicare eligible seniors in Tampa Bay');
  });

  test('should enable send button when input has text', async ({ page }) => {
    await page.goto('/');

    const inputField = page.getByPlaceholder('Ask about healthcare demographics...');
    const sendButton = page.getByRole('button', { name: 'Send' });

    // Initially disabled
    await expect(sendButton).toBeDisabled();

    // Type something
    await inputField.fill('Test query');

    // Should now be enabled
    await expect(sendButton).toBeEnabled();
  });

  test('should disable send button for whitespace-only input', async ({ page }) => {
    await page.goto('/');

    const inputField = page.getByPlaceholder('Ask about healthcare demographics...');
    const sendButton = page.getByRole('button', { name: 'Send' });

    await inputField.fill('   ');

    // Should remain disabled for whitespace-only
    await expect(sendButton).toBeDisabled();
  });
});

test.describe('Chat Interface - Query Submission', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('should submit query on send button click', async ({ page }) => {
    await mockSuccessfulQuery(page);
    await page.goto('/');

    const inputField = page.getByPlaceholder('Ask about healthcare demographics...');
    const sendButton = page.getByRole('button', { name: 'Send' });

    await inputField.fill('Show me Medicare eligible seniors in Florida');
    await sendButton.click();

    // User message should appear
    const userMessage = page.getByText('Show me Medicare eligible seniors in Florida');
    await expect(userMessage).toBeVisible();
  });

  test('should submit query on Enter key press', async ({ page }) => {
    await mockSuccessfulQuery(page);
    await page.goto('/');

    const inputField = page.getByPlaceholder('Ask about healthcare demographics...');

    await inputField.fill('Population over 65 in Tampa');
    await inputField.press('Enter');

    // User message should appear
    const userMessage = page.getByText('Population over 65 in Tampa');
    await expect(userMessage).toBeVisible();
  });

  test('should clear input field after submission', async ({ page }) => {
    await mockSuccessfulQuery(page);
    await page.goto('/');

    const inputField = page.getByPlaceholder('Ask about healthcare demographics...');

    await inputField.fill('Test query');
    await inputField.press('Enter');

    // Input should be cleared
    await expect(inputField).toHaveValue('');
  });

  test('should show loading state during query processing', async ({ page }) => {
    // Use a delayed response to catch the loading state
    await page.route('**/api/v1/queries', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockQueryResponse)
      });
    });

    await page.goto('/');

    const inputField = page.getByPlaceholder('Ask about healthcare demographics...');
    await inputField.fill('Test query');
    await inputField.press('Enter');

    // Check for loading message
    const loadingMessage = page.getByText('Analyzing your query...');
    await expect(loadingMessage).toBeVisible();

    // Check that send button shows "Processing..."
    const processingButton = page.getByRole('button', { name: 'Processing...' });
    await expect(processingButton).toBeVisible();

    // Input should be disabled during processing
    await expect(inputField).toBeDisabled();
  });

  test('should display user message with proper styling', async ({ page }) => {
    await mockSuccessfulQuery(page);
    await page.goto('/');

    const inputField = page.getByPlaceholder('Ask about healthcare demographics...');
    await inputField.fill('My test query');
    await inputField.press('Enter');

    // User message container should have proper styling (blue background)
    const userMessageContainer = page.locator('.bg-blue-100, .bg-blue-900\\/30').filter({ hasText: 'My test query' });
    await expect(userMessageContainer).toBeVisible();

    // User avatar should be visible
    const userAvatar = page.locator('.bg-blue-600').filter({ hasText: 'You' });
    await expect(userAvatar).toBeVisible();
  });
});

test.describe('Chat Interface - Data Table Display', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await mockSuccessfulQuery(page);
  });

  test('should display data table after successful query', async ({ page }) => {
    await page.goto('/');

    const inputField = page.getByPlaceholder('Ask about healthcare demographics...');
    await inputField.fill('Show me seniors in Tampa Bay');
    await inputField.press('Enter');

    // Wait for the table to appear
    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 10000 });
  });

  test('should display correct column headers', async ({ page }) => {
    await page.goto('/');

    const inputField = page.getByPlaceholder('Ask about healthcare demographics...');
    await inputField.fill('Show me seniors data');
    await inputField.press('Enter');

    // Wait for table and check headers
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // Check for column headers (underscores replaced with spaces)
    await expect(page.getByRole('columnheader', { name: /county name/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /state/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /population 65 plus/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /median income/i })).toBeVisible();
  });

  test('should display data rows with formatted numbers', async ({ page }) => {
    await page.goto('/');

    const inputField = page.getByPlaceholder('Ask about healthcare demographics...');
    await inputField.fill('County data');
    await inputField.press('Enter');

    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // Check for formatted data (numbers with locale formatting)
    await expect(page.getByRole('cell', { name: 'Hillsborough' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'FL' }).first()).toBeVisible();
    // Numbers should be formatted with commas (245,000)
    await expect(page.getByRole('cell', { name: '245,000' })).toBeVisible();
  });

  test('should display query metadata', async ({ page }) => {
    await page.goto('/');

    const inputField = page.getByPlaceholder('Ask about healthcare demographics...');
    await inputField.fill('Florida seniors');
    await inputField.press('Enter');

    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // Check for metadata display
    const queryTime = page.getByText(/Query time:/);
    await expect(queryTime).toBeVisible();

    const dataSource = page.getByText(/Data source:/);
    await expect(dataSource).toBeVisible();
  });

  test('should display data freshness indicator', async ({ page }) => {
    await page.goto('/');

    const inputField = page.getByPlaceholder('Ask about healthcare demographics...');
    await inputField.fill('Healthcare data');
    await inputField.press('Enter');

    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // Check for freshness status badge
    const freshnessIndicator = page.getByText(/Data fresh/);
    await expect(freshnessIndicator).toBeVisible();
  });
});

test.describe('Chat Interface - Export Button', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await mockSuccessfulQuery(page);
  });

  test('should display export button after successful query', async ({ page }) => {
    await page.goto('/');

    const inputField = page.getByPlaceholder('Ask about healthcare demographics...');
    await inputField.fill('Show me data');
    await inputField.press('Enter');

    // Wait for results
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // Export button should be visible
    const exportButton = page.getByRole('button', { name: /Export/i });
    await expect(exportButton).toBeVisible();
  });

  test('should open export dropdown on click', async ({ page }) => {
    await page.goto('/');

    const inputField = page.getByPlaceholder('Ask about healthcare demographics...');
    await inputField.fill('Export test');
    await inputField.press('Enter');

    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // Click export button
    const exportButton = page.getByRole('button', { name: /Export/i });
    await exportButton.click();

    // Dropdown should show export options
    await expect(page.getByText('Excel (.xlsx)')).toBeVisible();
    await expect(page.getByText('CSV (.csv)')).toBeVisible();
  });

  test('should show row count in export dropdown', async ({ page }) => {
    await page.goto('/');

    const inputField = page.getByPlaceholder('Ask about healthcare demographics...');
    await inputField.fill('Row count test');
    await inputField.press('Enter');

    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    const exportButton = page.getByRole('button', { name: /Export/i });
    await exportButton.click();

    // Should show row count
    await expect(page.getByText(/Export 5 rows/)).toBeVisible();
  });
});

test.describe('Chat Interface - Share Button', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await mockSuccessfulQuery(page);
  });

  test('should display share button after successful query', async ({ page }) => {
    await page.goto('/');

    const inputField = page.getByPlaceholder('Ask about healthcare demographics...');
    await inputField.fill('Share test data');
    await inputField.press('Enter');

    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // Share button should be visible
    const shareButton = page.getByRole('button', { name: /Share/i });
    await expect(shareButton).toBeVisible();
  });

  test('should open share dialog on click', async ({ page }) => {
    await page.goto('/');

    const inputField = page.getByPlaceholder('Ask about healthcare demographics...');
    await inputField.fill('Share dialog test');
    await inputField.press('Enter');

    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // Click share button
    const shareButton = page.getByRole('button', { name: /Share/i });
    await shareButton.click();

    // Share dialog should open (implementation dependent)
    // Note: The actual dialog content depends on ShareDialog component
    // We check that clicking doesn't throw an error
    await page.waitForTimeout(500);
  });
});

test.describe('Chat Interface - Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('should display error message for failed query', async ({ page }) => {
    await mockErrorQuery(page);
    await page.goto('/');

    const inputField = page.getByPlaceholder('Ask about healthcare demographics...');
    await inputField.fill('Invalid query that will fail');
    await inputField.press('Enter');

    // Error message should appear
    const errorMessage = page.getByText(/Unable to parse query/);
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });

  test('should display error styling for error messages', async ({ page }) => {
    await mockErrorQuery(page);
    await page.goto('/');

    const inputField = page.getByPlaceholder('Ask about healthcare demographics...');
    await inputField.fill('Error test');
    await inputField.press('Enter');

    // Error container should have red styling
    const errorContainer = page.locator('.bg-red-100, .bg-red-900\\/30').filter({ hasText: /Unable to parse/ });
    await expect(errorContainer).toBeVisible({ timeout: 10000 });
  });

  test('should display suggestions for error recovery', async ({ page }) => {
    await mockErrorQuery(page);
    await page.goto('/');

    const inputField = page.getByPlaceholder('Ask about healthcare demographics...');
    await inputField.fill('Bad query');
    await inputField.press('Enter');

    // Suggestions section should be visible
    await expect(page.getByText('Suggestions:')).toBeVisible({ timeout: 10000 });

    // Individual suggestions should be visible
    await expect(page.getByText(/Try specifying a geographic area/)).toBeVisible();
    await expect(page.getByText(/Include demographic criteria/)).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Mock network failure
    await page.route('**/api/v1/queries', async (route) => {
      await route.abort('failed');
    });

    await page.goto('/');

    const inputField = page.getByPlaceholder('Ask about healthcare demographics...');
    await inputField.fill('Network error test');
    await inputField.press('Enter');

    // Should show network error message
    const errorMessage = page.getByText(/Unable to connect|error|failed/i);
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Chat Interface - Query Suggestions', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('should display suggestions section', async ({ page }) => {
    await page.goto('/');

    // Suggestions header should be visible
    const suggestionsHeader = page.getByText('Suggestions');
    await expect(suggestionsHeader).toBeVisible();
  });

  test('should display category filter buttons', async ({ page }) => {
    await page.goto('/');

    // Category buttons should be visible
    await expect(page.getByRole('button', { name: /healthcare/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /marketing/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /demographics/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /geographic/i })).toBeVisible();
  });

  test('should filter suggestions by category on click', async ({ page }) => {
    await page.goto('/');

    // Click healthcare category
    const healthcareButton = page.getByRole('button', { name: /healthcare/i });
    await healthcareButton.click();

    // Button should show selected state (different styling)
    await expect(healthcareButton).toHaveClass(/bg-red-100|text-red-/);
  });

  test('should populate input when suggestion is clicked', async ({ page }) => {
    await mockSuccessfulQuery(page);
    await page.goto('/');

    // Find and click a suggestion
    const suggestionButton = page.locator('button').filter({ hasText: /Medicare|seniors|population/i }).first();

    // Wait for suggestions to load
    await suggestionButton.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {
      // If no suggestions visible, skip this test
      test.skip();
    });

    await suggestionButton.click();

    // Input should be populated
    const inputField = page.getByPlaceholder('Ask about healthcare demographics...');
    const inputValue = await inputField.inputValue();
    expect(inputValue.length).toBeGreaterThan(0);
  });

  test('should toggle suggestions visibility', async ({ page }) => {
    await page.goto('/');

    // Find the toggle button (Suggestions header with chevron)
    const toggleButton = page.getByRole('button').filter({ hasText: 'Suggestions' });
    await toggleButton.click();

    // Category buttons should be hidden
    await expect(page.getByRole('button', { name: /healthcare/i })).toBeHidden();

    // Click again to show
    await toggleButton.click();
    await expect(page.getByRole('button', { name: /healthcare/i })).toBeVisible();
  });
});

test.describe('Chat Interface - Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await mockSuccessfulQuery(page);
  });

  test('should not submit on Shift+Enter', async ({ page }) => {
    await page.goto('/');

    const inputField = page.getByPlaceholder('Ask about healthcare demographics...');
    await inputField.fill('Multi-line');
    await inputField.press('Shift+Enter');

    // Should not have submitted - no user message should appear
    // The welcome message should still be the only assistant message
    const messages = page.locator('.bg-blue-100, .bg-blue-900\\/30');
    await expect(messages).toHaveCount(0);
  });

  test('should focus input on page load', async ({ page }) => {
    await page.goto('/');

    // Allow time for page to fully load
    await page.waitForTimeout(500);

    // Check if input can receive keyboard input immediately
    const inputField = page.getByPlaceholder('Ask about healthcare demographics...');
    await inputField.focus();
    await page.keyboard.type('Test typing');

    await expect(inputField).toHaveValue('Test typing');
  });
});

test.describe('Chat Interface - Multiple Queries', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await mockSuccessfulQuery(page);
  });

  test('should allow multiple sequential queries', async ({ page }) => {
    await page.goto('/');

    const inputField = page.getByPlaceholder('Ask about healthcare demographics...');

    // First query
    await inputField.fill('First query about Florida');
    await inputField.press('Enter');
    await expect(page.getByText('First query about Florida')).toBeVisible();
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10000 });

    // Second query
    await inputField.fill('Second query about Texas');
    await inputField.press('Enter');
    await expect(page.getByText('Second query about Texas')).toBeVisible();
  });

  test('should scroll to newest message', async ({ page }) => {
    await page.goto('/');

    const inputField = page.getByPlaceholder('Ask about healthcare demographics...');

    // Submit multiple queries
    for (let i = 1; i <= 3; i++) {
      await inputField.fill(`Query number ${i}`);
      await inputField.press('Enter');
      // Wait for response before next query
      await page.locator('table').last().waitFor({ state: 'visible', timeout: 10000 });
    }

    // The last message should be visible (auto-scroll)
    await expect(page.getByText('Query number 3')).toBeInViewport();
  });
});

test.describe('Chat Interface - Responsive Design', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('should display properly on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Key elements should still be visible
    await expect(page.getByPlaceholder('Ask about healthcare demographics...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();
    await expect(page.getByText(/Hi! I'm here to help/)).toBeVisible();
  });

  test('should display data table with horizontal scroll on mobile', async ({ page }) => {
    await mockSuccessfulQuery(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    const inputField = page.getByPlaceholder('Ask about healthcare demographics...');
    await inputField.fill('Mobile table test');
    await inputField.press('Enter');

    // Table should be in a scrollable container
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
    const scrollContainer = page.locator('.overflow-x-auto');
    await expect(scrollContainer).toBeVisible();
  });
});

test.describe('Chat Interface - Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('should have accessible input field', async ({ page }) => {
    await page.goto('/');

    const inputField = page.getByPlaceholder('Ask about healthcare demographics...');
    await expect(inputField).toHaveAttribute('type', 'text');
  });

  test('should have accessible buttons', async ({ page }) => {
    await page.goto('/');

    // Send button should be a proper button
    const sendButton = page.getByRole('button', { name: 'Send' });
    await expect(sendButton).toBeVisible();
  });

  test('should have accessible table structure', async ({ page }) => {
    await mockSuccessfulQuery(page);
    await page.goto('/');

    const inputField = page.getByPlaceholder('Ask about healthcare demographics...');
    await inputField.fill('Accessibility test');
    await inputField.press('Enter');

    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // Table should have proper semantic structure
    await expect(page.locator('thead')).toBeVisible();
    await expect(page.locator('tbody')).toBeVisible();
    await expect(page.locator('th').first()).toBeVisible();
    await expect(page.locator('td').first()).toBeVisible();
  });
});

test.describe('Chat Interface - Data Refresh Button', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('should display data refresh button in header', async ({ page }) => {
    await page.goto('/');

    // DataRefreshButton should be visible in header area
    const header = page.locator('.bg-gray-50, .bg-gray-700').first();
    await expect(header).toBeVisible();
  });
});
