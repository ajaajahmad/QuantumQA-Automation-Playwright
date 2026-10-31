import { test } from '../../fixtures/test-fixtures';
import { appConfig } from '../../utils/config';
import { readForgotPasswordAccount } from '../../utils/test-data';

// This is the same account auth setup logs in with, so every password these tests submit
// is either rejected by the app or the current one: userdata.json can never go stale.
const account = readForgotPasswordAccount();

test.use({ useAuthenticatedSession: false });

test.describe('Forgot password', () => {
  test.skip(!account, 'Add mobile_last_four_digits and one_time_password to a userdata.json row to run these tests.');

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

  // The app rejects this before submitting, so the password stays unchanged.
  test('rejects a password that is too short', async ({ forgotPasswordPage }) => {
    const { resetPasswordPage } = forgotPasswordPage;

    await forgotPasswordPage.reachResetPasswordScreen(account!);
    await resetPasswordPage.enterPasswords('Asdf#12', 'Asdf#12');
    await resetPasswordPage.clickReset();

    await resetPasswordPage.expectInvalidPasswordError();
    await resetPasswordPage.expectDisplayed();
  });

  // New Password is the current one, so even if the app submitted it, nothing would change.
  test('rejects a confirm password that does not match', async ({ forgotPasswordPage }) => {
    const { resetPasswordPage } = forgotPasswordPage;

    await forgotPasswordPage.reachResetPasswordScreen(account!);
    await resetPasswordPage.enterPasswords(account!.password, `${account!.password}x`);
    await resetPasswordPage.expectConfirmPasswordFlagged();
    await resetPasswordPage.clickReset();

    await resetPasswordPage.expectMismatchError();
    await resetPasswordPage.expectDisplayed();
  });

  // Staging keeps the last 3 passwords, so resetting to the current one is refused and
  // nothing changes. A successful reset needs a throwaway account, since this one is shared.
  test('rejects reusing a recent password', async ({ forgotPasswordPage }) => {
    const { resetPasswordPage } = forgotPasswordPage;

    await forgotPasswordPage.reachResetPasswordScreen(account!);
    await resetPasswordPage.enterPasswords(account!.password, account!.password);
    await resetPasswordPage.clickReset();

    await resetPasswordPage.expectPasswordReuseError();
    await resetPasswordPage.expectDisplayed();
  });
});
