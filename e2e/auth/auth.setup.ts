import { test } from '../fixtures/test-fixtures';
import { appConfig } from '../utils/config';
import { saveAuthState } from '../utils/auth-state';
import { readUserCredentials } from '../utils/test-data';

test.use({ useAuthenticatedSession: false });

test('authenticate and persist browser state', async ({ page, loginPage }) => {
  const [user] = readUserCredentials();

  if (!user) {
    throw new Error('Auth setup requires at least one credential row.');
  }

  await page.goto(appConfig.appUrl, { waitUntil: 'domcontentloaded' });

  await loginPage.userLogin(user.username, user.password, user.otp);

  await saveAuthState(page);
});
