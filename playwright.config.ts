import { defineConfig, devices } from '@playwright/test';
import { appConfig } from './e2e/utils/config';
import { adminSession, panelSession } from './e2e/utils/auth-state';

const browserName = 'chromium';
// Headless by default, as Playwright itself is. HEADED=1 opens the browser (npm run test:headed).
const headless = process.env.HEADED !== '1';

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
    // Headed runs fill the maximised window instead of a 1280x720 box inside it (a free viewport
    // can't have a device scale factor). Headless keeps the fixed Desktop Chrome viewport so
    // results don't depend on the screen they run on.
    ...(headless
      ? {}
      : { viewport: null, deviceScaleFactor: undefined, launchOptions: { args: ['--start-maximized'] } }),
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
    // Logs in and out in its own browser; staging keeps other sessions alive, so this
    // runs alongside the token-based projects.
    {
      name: 'login',
      testMatch: /specs\/login\/.*\.spec\.ts/,
    },
    // A password reset revokes every token, including the saved one, so this project
    // exists only when asked for: npm run test:password-reset.
    ...(process.env.RESET_PASSWORD === '1'
      ? [
          {
            name: 'password-reset',
            testMatch: /specs\/password-reset\/.*\.spec\.ts/,
          },
        ]
      : []),
    // Reuses the saved access token while the API accepts it; logs in only when it doesn't.
    {
      name: 'auth-setup',
      testMatch: /auth\/auth\.setup\.ts/,
    },
    {
      name: browserName,
      dependencies: ['auth-setup'],
      testMatch: /specs\/.*\.spec\.ts/,
      testIgnore: /specs\/(login|password-reset|admin)\//,
      use: {
        storageState: panelSession.storageStatePath,
      },
    },
    // The admin panel: its own URL and saved session, reused the same way as the panel's.
    // admin-login signs in and out in its own browser; staging keeps the saved session alive.
    {
      name: 'admin-login',
      testMatch: /specs\/admin\/login\/.*\.spec\.ts/,
      use: {
        baseURL: appConfig.adminUrl || undefined,
      },
    },
    {
      name: 'admin-auth-setup',
      testMatch: /auth\/admin\.setup\.ts/,
      use: {
        baseURL: appConfig.adminUrl || undefined,
      },
    },
    {
      name: 'admin',
      dependencies: ['admin-auth-setup'],
      testMatch: /specs\/admin\/.*\.spec\.ts/,
      testIgnore: /specs\/admin\/(login|write)\//,
      use: {
        baseURL: appConfig.adminUrl || undefined,
        storageState: adminSession.storageStatePath,
      },
    },
    // Admin specs that create records on shared staging exist only when asked for:
    // npm run test:admin-write.
    ...(process.env.ADMIN_WRITE === '1'
      ? [
          {
            name: 'admin-write',
            dependencies: ['admin-auth-setup'],
            testMatch: /specs\/admin\/write\/.*\.spec\.ts/,
            use: {
              baseURL: appConfig.adminUrl || undefined,
              storageState: adminSession.storageStatePath,
            },
          },
        ]
      : []),
  ],
});
