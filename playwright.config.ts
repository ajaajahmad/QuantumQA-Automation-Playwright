import { defineConfig, devices } from '@playwright/test';
import { appConfig } from './e2e/utils/config';
import { storageStatePath } from './e2e/utils/auth-state';

const browserName = 'chromium';
// Headed locally; CI runners have no display, so run headless there.
const headless = !!process.env.CI;

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
    ...devices['Desktop Chrome'],
    browserName,
    headless,
    baseURL: appConfig.appUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: appConfig.timeoutMs,
    navigationTimeout: appConfig.timeoutMs,
  },
  projects: [
    // Runs before auth-setup: logging out here can end other sessions for the same
    // user, so it must finish before the shared session is saved.
    {
      name: 'login',
      testMatch: /specs\/login\/.*\.spec\.ts/,
    },
    // Changes the shared account's password, so nothing else may log in with it meanwhile.
    // auth-setup runs after it and reads the new password from userdata.json.
    {
      name: 'password-reset',
      dependencies: ['login'],
      testMatch: /specs\/password-reset\/.*\.spec\.ts/,
    },
    {
      name: 'auth-setup',
      dependencies: ['password-reset'],
      testMatch: /auth\/.*\.setup\.ts/,
    },
    {
      name: browserName,
      dependencies: ['auth-setup'],
      testMatch: /specs\/.*\.spec\.ts/,
      testIgnore: /specs\/(login|password-reset)\//,
      use: {
        storageState: storageStatePath,
      },
    },
  ],
});
