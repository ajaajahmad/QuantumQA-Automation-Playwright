import { expect, test } from '../../fixtures/test-fixtures';
import { appConfig } from '../../utils/config';
import { readUserCredentials } from '../../utils/test-data';

const users = readUserCredentials();

test.use({ useAuthenticatedSession: false });

test.beforeEach(async ({ page }) => {
  await page.goto(appConfig.appUrl, { waitUntil: 'domcontentloaded' });
});

test.describe('Login', () => {
  for (const [index, user] of users.entries()) {
    test(`logs in and out with valid credential row ${index + 1}`, async ({ page, loginPage, logoutComponent }) => {
      await loginPage.userLogin(user.username, user.password, user.otp);

      await logoutComponent.userLogout();
      await loginPage.expectDisplayed();

      // Back must not reopen the dashboard from history once the session has ended.
      await page.goBack();
      await loginPage.expectLoggedOut();
    });
  }

  test('redirects to login when the dashboard is opened without a session', async ({ page, loginPage }) => {
    await page.goto(new URL('/dashboard/home', appConfig.appUrl).toString(), { waitUntil: 'domcontentloaded' });

    await loginPage.expectLoggedOut();
    await expect(page).toHaveURL(/\/auth\/login/);
  });
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

  test('shows both errors when username and password are empty', async ({ loginPage }) => {
    await loginPage.clickLoginButton();

    await loginPage.expectEmptyUsernameError();
    await loginPage.expectEmptyPasswordError();
  });

  test('flags a username with surrounding spaces as invalid', async ({ loginPage }) => {
    await loginPage.enterUsername('  any.user@example.com  ');
    await loginPage.enterPassword('any-password');
    await loginPage.clickLoginButton();

    await loginPage.expectInvalidUsernameError();
  });

  // Uses a non-existent account so repeated runs can't lock out a real user.
  test('shows an error for invalid credentials', async ({ loginPage }) => {
    await loginPage.enterUsername('invalid.user@example.com');
    await loginPage.enterPassword('wrong-password');
    await loginPage.clickLoginButton();

    await loginPage.expectInvalidCredentialsError();
  });

  test('submits the form with the Enter key', async ({ loginPage }) => {
    await loginPage.enterUsername('invalid.user@example.com');
    await loginPage.enterPassword('wrong-password');
    await loginPage.submitWithEnter();

    await loginPage.expectInvalidCredentialsError();
  });

  test('masks the password and toggles its visibility', async ({ loginPage }) => {
    await loginPage.enterPassword('any-password');
    await loginPage.expectPasswordMasked();

    await loginPage.togglePasswordVisibility();
    await loginPage.expectPasswordShown();

    await loginPage.togglePasswordVisibility();
    await loginPage.expectPasswordMasked();
  });
});

test.describe('Two-factor authentication', () => {
  const [user] = users;

  test.skip(!user.otp, 'Add one_time_password to the first userdata.json row to run these tests.');

  test('rejects a wrong OTP and stays on the 2FA screen', async ({ loginPage }) => {
    const wrongOtp = user.otp === '000000' ? '111111' : '000000';

    await loginPage.openTwoFactorScreen(user.username, user.password);
    await loginPage.twoFactorPage.validateOtp(wrongOtp);

    await loginPage.twoFactorPage.expectInvalidOtpError();
    await loginPage.twoFactorPage.expectDisplayed();
  });

  test('cancel returns to the login page after confirmation', async ({ loginPage }) => {
    await loginPage.openTwoFactorScreen(user.username, user.password);
    await loginPage.twoFactorPage.cancel();

    await loginPage.expectLoggedOut();
  });
});
