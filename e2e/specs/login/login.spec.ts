import { expect, test } from '../../fixtures/test-fixtures';
import { appConfig } from '../../utils/config';
import { readUserCredentials } from '../../utils/test-data';

const users = readUserCredentials();

test.use({ storageState: { cookies: [], origins: [] }, useAuthenticatedSession: false });

test.describe('Login', () => {
  for (const [index, user] of users.entries()) {
    test(`logs in with valid credential row ${index + 1}`, async ({ page, loginPage, logoutComponent }) => {
      await page.goto(appConfig.appUrl, { waitUntil: 'domcontentloaded' });

      await expect(page.locator("//input[@formcontrolname='username']")).toBeVisible();
      await loginPage.userLogin(user.username, user.password);
      await expect(page.locator("//input[@formcontrolname='username']")).toBeHidden();

      await logoutComponent.userLogout();
    });
  }
});