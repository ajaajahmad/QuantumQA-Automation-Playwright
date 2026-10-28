import { test } from '../../fixtures/test-fixtures';
import { appConfig } from '../../utils/config';
import { readForgotPasswordAccount } from '../../utils/test-data';

// A dedicated throwaway account: the happy path changes its password on every run.
const account = readForgotPasswordAccount();

// Fresh each run, so the test never needs the old password and can't hit a reuse rule.
function uniquePassword(): string {
  return `Qa#${Date.now().toString().slice(-8)}`;
}

test.use({ storageState: { cookies: [], origins: [] }, useAuthenticatedSession: false });

test.describe('Forgot password', () => {
  test.skip(!account, 'Add a forgot-password row to e2e/test-data/userdata.json to run these tests.');

  test.beforeEach(async ({ page, loginPage, forgotPasswordPage }) => {
    await page.goto(appConfig.appUrl, { waitUntil: 'domcontentloaded' });
    await loginPage.openForgotPassword();
    await forgotPasswordPage.expectDisplayed();
  });

  test('shows required errors when fields are empty', async ({ forgotPasswordPage }) => {
    await forgotPasswordPage.clickConfirm();

    await forgotPasswordPage.expectRequiredFieldErrors();
  });

  test('rejects wrong mobile digits', async ({ forgotPasswordPage }) => {
    const wrongDigits = account!.mobileLast4 === '0000' ? '1111' : '0000';

    await forgotPasswordPage.requestOtp(account!.username, wrongDigits);

    await forgotPasswordPage.expectInvalidMobileDigitsError();
  });

  test('rejects a wrong OTP', async ({ forgotPasswordPage }) => {
    const wrongOtp = account!.otp === '000000' ? '111111' : '000000';

    await forgotPasswordPage.requestOtp(account!.username, account!.mobileLast4);
    await forgotPasswordPage.verifyOtpPage.expectDisplayed();
    await forgotPasswordPage.verifyOtpPage.submitOtp(wrongOtp);

    await forgotPasswordPage.verifyOtpPage.expectInvalidOtpError();
  });

  test('rejects a password that is too short', async ({ forgotPasswordPage }) => {
    const { resetPasswordPage } = forgotPasswordPage;

    await forgotPasswordPage.reachResetPasswordScreen(account!);
    await resetPasswordPage.enterPasswords('Asdf#12', 'Asdf#12');
    await resetPasswordPage.clickReset();

    await resetPasswordPage.expectInvalidPasswordError();
    await resetPasswordPage.expectDisplayed();
  });

  // Clicks Reset, which is safe only because the account is a throwaway: no test needs its current password.
  test('rejects a confirm password that does not match', async ({ forgotPasswordPage }) => {
    const { resetPasswordPage } = forgotPasswordPage;

    await forgotPasswordPage.reachResetPasswordScreen(account!);
    await resetPasswordPage.enterPasswords('Qwer#5678', 'Qwer#5679');
    await resetPasswordPage.expectConfirmPasswordFlagged();
    await resetPasswordPage.clickReset();

    await resetPasswordPage.expectMismatchError();
    await resetPasswordPage.expectDisplayed();
  });

  test.describe('happy path', () => {
    // A retry would reset the password again.
    test.describe.configure({ retries: 0 });

    test('resets the password and logs in with the new one', async ({ page, loginPage, forgotPasswordPage }) => {
      const newPassword = uniquePassword();
      test.info().annotations.push({ type: 'new password', description: newPassword });

      await forgotPasswordPage.resetPassword(account!, newPassword);

      await page.goto(appConfig.appUrl, { waitUntil: 'domcontentloaded' });
      await loginPage.userLogin(account!.username, newPassword);
    });
  });
});
