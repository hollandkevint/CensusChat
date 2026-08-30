import { test, expect } from '@playwright/test';

const LA = '/counties/california/los-angeles-county';

test.describe('county pages', () => {
  test('renders real ACS figures with their variable codes and vintage', async ({ page }) => {
    await page.goto(LA);

    await expect(page.getByRole('heading', { name: 'Los Angeles County, California' })).toBeVisible();

    // Values from the ACS 2020-2024 5-year API for FIPS 06037. If the snapshot
    // is regenerated at a new vintage these change, and that is the point:
    // the page must never show a figure the API did not return.
    await expect(page.getByText('1,487,700', { exact: true })).toBeVisible();
    await expect(page.getByText('15.2%', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('616,913', { exact: true })).toBeVisible();

    // R9: vintage in the page body, not only in metadata.
    await expect(
      page.getByText('American Community Survey 2020-2024 5-year estimates').first()
    ).toBeVisible();

    // R10: every metric carries the ACS variable code it came from.
    await expect(page.getByText('DP05_0024E').first()).toBeVisible();
    await expect(page.getByText('S2701_C05_013E')).toBeVisible();

    // R7: state and national benchmark columns.
    await expect(page.getByRole('columnheader', { name: 'United States' }).first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'California' }).first()).toBeVisible();
  });

  test('renders a missing metric as missing, never as zero or a fallback', async ({ page }) => {
    // De Baca County, New Mexico is the one county in the snapshot for which
    // the Census Bureau does not publish median household income.
    await page.goto('/counties/new-mexico/de-baca-county');

    const row = page.getByRole('row').filter({ hasText: 'Median household income' });
    await expect(row).toContainText('—');
    await expect(row).not.toContainText('$0');
    // The state value is still shown; it is not substituted for the county.
    await expect(row).toContainText('$64,059');
    await expect(page.getByText('does not publish this estimate')).toBeVisible();
  });

  test('links peer counties and the county index', async ({ page }) => {
    await page.goto(LA);
    await page.getByRole('link', { name: 'Cook County, Illinois' }).click();
    await expect(page).toHaveURL(/\/counties\/illinois\/cook-county$/);
    await expect(page.getByRole('heading', { name: 'Cook County, Illinois' })).toBeVisible();
  });

  test('an unknown county slug is a 404', async ({ page }) => {
    const response = await page.goto('/counties/california/not-a-real-county');
    expect(response?.status()).toBe(404);
  });

  test('a chat call to action prefills the chat input without sending', async ({ page }) => {
    await page.goto(LA);

    const cta = page.getByRole('link', { name: /How many of the 1,487,700 residents/ });
    await expect(cta).toBeVisible();
    await cta.click();

    await expect(page).toHaveURL(/\/\?q=/);
    const input = page.getByPlaceholder(/ask/i).first();
    await expect(input).toHaveValue(/How many of the 1,487,700 residents aged 65 and over/);

    // Prefilled, not sent: the greeting is still the only assistant message.
    await expect(page.getByText('Analyzing your query...')).toHaveCount(0);
  });

  test('?q= survives characters that need encoding', async ({ page }) => {
    const q = 'seniors & income > 50% in Dade County?';
    await page.goto(`/?q=${encodeURIComponent(q)}`);
    await expect(page.getByPlaceholder(/ask/i).first()).toHaveValue(q);
  });

  test('the chat input stays empty with no q parameter', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByPlaceholder(/ask/i).first()).toHaveValue('');
    await expect(page.getByText(/Hi! I'm here to help you analyze Census data/)).toBeVisible();
  });
});
