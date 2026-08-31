import { test, expect, Page } from '@playwright/test';

/**
 * E2E tests for the CensusChat query flow.
 *
 * The backend is not required: the two endpoints the UI calls
 * (POST /api/v1/queries and GET /api/v1/mcp/resources) are mocked
 * with Playwright route interception, so these tests exercise the
 * real Next.js app end-to-end from the browser's point of view.
 */

const QUERY_ENDPOINT = '**/api/v1/queries';
const RESOURCES_ENDPOINT = '**/api/v1/mcp/resources';

const mockSuccessResponse = {
  success: true,
  message: 'Found 2 counties matching your criteria.',
  data: [
    {
      county_name: 'Miami-Dade',
      state_name: 'Florida',
      population: 2716940,
      median_income: 57815
    },
    {
      county_name: 'Broward',
      state_name: 'Florida',
      population: 1944375,
      median_income: 60922
    }
  ],
  metadata: {
    queryTime: 1.42,
    totalRecords: 2,
    dataSource: 'US Census Bureau ACS 5-Year',
    confidenceLevel: 0.95,
    marginOfError: 2.3
  }
};

async function mockNoUIResources(page: Page) {
  // Force the static-table fallback path (no MCP Apps iframe)
  await page.route(RESOURCES_ENDPOINT, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
  );
}

test.describe('landing page', () => {
  test('renders the app shell', async ({ page }) => {
    await mockNoUIResources(page);
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'CensusChat' })).toBeVisible();
    await expect(
      page.getByPlaceholder('Ask about healthcare demographics...')
    ).toBeVisible();
    // The assistant greets the user before any query is sent
    await expect(
      page.getByText(/help you analyze Census data/i)
    ).toBeVisible();
  });

  test('send button is disabled until a query is typed', async ({ page }) => {
    await mockNoUIResources(page);
    await page.goto('/');

    const send = page.getByRole('button', { name: 'Send' });
    await expect(send).toBeDisabled();

    await page
      .getByPlaceholder('Ask about healthcare demographics...')
      .fill('Show me Medicare eligible seniors in Florida');
    await expect(send).toBeEnabled();
  });
});

test.describe('query flow (mocked backend)', () => {
  test('submits a query and renders results with a data table and export button', async ({
    page
  }) => {
    await mockNoUIResources(page);
    await page.route(QUERY_ENDPOINT, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSuccessResponse)
      })
    );

    await page.goto('/');

    const input = page.getByPlaceholder('Ask about healthcare demographics...');
    await input.fill('Show me Medicare eligible seniors in Florida');
    await page.getByRole('button', { name: 'Send' }).click();

    // The user's message is echoed into the transcript (exact match — the
    // assistant greeting quotes a longer example containing this phrase)
    await expect(
      page.getByText('Show me Medicare eligible seniors in Florida', { exact: true })
    ).toBeVisible();

    // The mocked assistant response arrives
    await expect(
      page.getByText('Found 2 counties matching your criteria.')
    ).toBeVisible();

    // The static data table renders the mocked rows
    await expect(page.getByRole('cell', { name: 'Miami-Dade' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Broward' })).toBeVisible();
    // Numbers are locale-formatted by the table renderer
    await expect(page.getByRole('cell', { name: '2,716,940' })).toBeVisible();

    // Query metadata is displayed
    await expect(page.getByText(/US Census Bureau ACS 5-Year/)).toBeVisible();

    // The export affordance is offered for result sets
    await expect(
      page.getByRole('button', { name: /export/i }).first()
    ).toBeVisible();
  });

  test('shows an error message with suggestions when the API rejects the query', async ({
    page
  }) => {
    await mockNoUIResources(page);
    await page.route(QUERY_ENDPOINT, (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'I could not translate that into a Census query.',
          error: 'VALIDATION_ERROR',
          suggestions: [
            'Try naming a state or county',
            'Ask about a demographic measure like income or age'
          ]
        })
      })
    );

    await page.goto('/');

    await page
      .getByPlaceholder('Ask about healthcare demographics...')
      .fill('gibberish query about nothing');
    await page.getByRole('button', { name: 'Send' }).click();

    await expect(
      page.getByText('I could not translate that into a Census query.')
    ).toBeVisible();
    await expect(page.getByText('Suggestions:')).toBeVisible();
    await expect(page.getByText('Try naming a state or county')).toBeVisible();
  });

  test('recovers to an idle state after a network failure', async ({ page }) => {
    await mockNoUIResources(page);
    await page.route(QUERY_ENDPOINT, (route) => route.abort('connectionrefused'));

    await page.goto('/');

    const input = page.getByPlaceholder('Ask about healthcare demographics...');
    await input.fill('Show me counties in Texas');
    await page.getByRole('button', { name: 'Send' }).click();

    // A friendly connection error is surfaced (not a crash)
    await expect(
      page.getByText(/unable to connect to the server/i)
    ).toBeVisible();

    // The UI returns to an idle, usable state
    await expect(input).toBeEnabled();
    await input.fill('follow-up query');
    await expect(page.getByRole('button', { name: 'Send' })).toBeEnabled();
  });
});
