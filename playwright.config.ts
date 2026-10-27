import { defineConfig, devices } from '@playwright/test';
import { appConfig } from './e2e/utils/config';
import { storageStatePath } from './e2e/utils/auth-state';

const browserName = 'chromium';
const headless = false;

export default defineConfig({
  testDir: './e2e',
  outputDir: 'artifacts/test-results',
  timeout: 60_000,
  expect: {
    timeout: appConfig.timeoutMs,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'artifacts/playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: appConfig.appUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: appConfig.timeoutMs,
    navigationTimeout: appConfig.timeoutMs,
  },
  projects: [
    {
      name: 'auth-setup',
      testMatch: /auth\/.*\.setup\.ts/,
      use: {
        browserName,
        headless,
      },
    },
    {
      name: browserName,
      dependencies: ['auth-setup'],
      testMatch: /specs\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        browserName,
        headless,
        storageState: storageStatePath,
      },
    },
  ],
});
