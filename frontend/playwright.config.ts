import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright e2e configuration.
 *
 * Boots the Next.js dev server and runs browser tests against it.
 * Backend API calls are mocked per-test with route interception,
 * so no database or backend process is required.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // In environments with a pre-provisioned Chromium (e.g. CI images,
        // remote sandboxes), point at it via PW_CHROMIUM_PATH instead of
        // downloading a browser matched to the Playwright version.
        ...(process.env.PW_CHROMIUM_PATH
          ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } }
          : {})
      }
    }
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
