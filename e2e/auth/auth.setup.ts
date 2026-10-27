import { test } from '@playwright/test';
import { LoginPage } from '../pages/login/login.page';
import { appConfig } from '../utils/config';
import { saveAuthState } from '../utils/auth-state';
import { readUserCredentials } from '../utils/test-data';

test('authenticate and persist browser state', async ({ page }) => {
  const [user] = readUserCredentials();

  if (!user) {
    throw new Error('Auth setup requires at least one credential row.');
  }

  await page.goto(appConfig.appUrl, { waitUntil: 'domcontentloaded' });

  const loginPage = new LoginPage(page);
  await loginPage.userLogin(user.username, user.password);

  await saveAuthState(page);
});
