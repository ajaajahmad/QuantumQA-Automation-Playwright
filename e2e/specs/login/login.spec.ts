import { test } from '../../fixtures/test-fixtures';
import { appConfig } from '../../utils/config';
import { readUserCredentials } from '../../utils/test-data';

const users = readUserCredentials();

test.use({ useAuthenticatedSession: false });

test.beforeEach(async ({ page }) => {
  await page.goto(appConfig.appUrl, { waitUntil: 'domcontentloaded' });
});

test.describe('Login', () => {
  for (const [index, user] of users.entries()) {
    test(`logs in and out with valid credential row ${index + 1}`, async ({ loginPage, logoutComponent }) => {
      await loginPage.userLogin(user.username, user.password);

      await logoutComponent.userLogout();
      await loginPage.expectDisplayed();
    });
  }
});

test.describe('Login validation', () => {
  test('shows an error when username is empty', async ({ loginPage }) => {
    await loginPage.enterPassword('any-password');
    await loginPage.clickLoginButton();

    await loginPage.expectEmptyUsernameError();
  });

  test('shows an error when password is empty', async ({ loginPage }) => {
    await loginPage.enterUsername('any.user@example.com');
    await loginPage.clickLoginButton();

    await loginPage.expectEmptyPasswordError();
  });

  // Uses a non-existent account so repeated runs can't lock out a real user.
  test('shows an error for invalid credentials', async ({ loginPage }) => {
    await loginPage.enterUsername('invalid.user@example.com');
    await loginPage.enterPassword('wrong-password');
    await loginPage.clickLoginButton();

    await loginPage.expectInvalidCredentialsError();
  });
});
