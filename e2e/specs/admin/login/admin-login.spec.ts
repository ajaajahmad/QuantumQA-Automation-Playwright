import { test } from '../../../fixtures/admin-fixtures';
import { appConfig } from '../../../utils/config';
import { readAdminCredentials } from '../../../utils/test-data';

// The admin account is shared, so a wrong password or OTP is never tried on it: the negative
// cases use a made-up username. Only the first test signs in for real.
const unknownUser = { username: 'no.such.admin@example.com', password: 'Wrong@12345' };

test.use({ useAuthenticatedSession: false });

test.beforeEach(async ({ adminLoginPage }) => {
  await adminLoginPage.open();
});

test.describe('Admin login', () => {
  test('logs in with the OTP, lands on Organizations and signs out', async ({
    page,
    adminLoginPage,
    adminHeader,
    organizationsPage,
  }) => {
    const admin = readAdminCredentials();

    await adminLoginPage.login(admin.username, admin.password, admin.otp);
    await organizationsPage.expectDisplayed();

    await adminHeader.signOut();
    await adminLoginPage.expectLoggedOut();

    // Back must not reopen Organizations once the session has ended.
    await page.goBack();
    await adminLoginPage.expectLoggedOut();
  });

  test('redirects to login when Organizations is opened without a session', async ({ page, adminLoginPage }) => {
    await page.goto(new URL('#/organizations/listing', appConfig.adminUrl).toString(), { waitUntil: 'domcontentloaded' });

    await adminLoginPage.expectLoggedOut();
  });
});

test.describe('Admin login validation', () => {
  test('shows both errors when username and password are empty', async ({ adminLoginPage }) => {
    await adminLoginPage.clickSignIn();

    await adminLoginPage.expectEmptyUsernameError();
    await adminLoginPage.expectEmptyPasswordError();
  });

  test('shows an error when the password is empty', async ({ adminLoginPage }) => {
    await adminLoginPage.enterUsername(unknownUser.username);
    await adminLoginPage.clickSignIn();

    await adminLoginPage.expectEmptyPasswordError();
  });

  test('shows an error for an unknown username', async ({ adminLoginPage }) => {
    await adminLoginPage.enterUsername(unknownUser.username);
    await adminLoginPage.enterPassword(unknownUser.password);
    await adminLoginPage.clickSignIn();

    await adminLoginPage.expectInvalidCredentialsError();
  });

  test('submits the form with the Enter key', async ({ adminLoginPage }) => {
    await adminLoginPage.enterUsername(unknownUser.username);
    await adminLoginPage.enterPassword(unknownUser.password);
    await adminLoginPage.submitWithEnter();

    await adminLoginPage.expectInvalidCredentialsError();
  });
});
