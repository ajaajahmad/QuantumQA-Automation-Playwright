import { test } from '../../fixtures/test-fixtures';
import type { ResetPasswordPage } from '../../pages/login/reset-password.page';
import { appConfig } from '../../utils/config';
import { readForgotPasswordAccount, updateUserPassword } from '../../utils/test-data';

// This is the same account auth setup logs in with. Every password these tests submit should be
// refused or is the current one, so userdata.json stays valid; expectResetRefused covers the case
// where the app wrongly accepts one.
const account = readForgotPasswordAccount();

// If staging ever accepts one of these passwords, the account's password really changes. Store it
// before failing, so later runs can still log in.
async function expectResetRefused(resetPasswordPage: ResetPasswordPage, submittedPassword: string): Promise<void> {
  if ((await resetPasswordPage.submitReset()) === 'accepted') {
    updateUserPassword(account!.username, submittedPassword);
    throw new Error('Staging accepted a password it should refuse. userdata.json now holds that password.');
  }
}

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

  test('requires the username when only the mobile digits are given', async ({ forgotPasswordPage }) => {
    await forgotPasswordPage.enterMobileLast4(account!.mobileLast4);
    await forgotPasswordPage.clickConfirm();

    await forgotPasswordPage.expectUsernameRequiredError();
  });

  test('limits the mobile digits to 4 characters', async ({ forgotPasswordPage }) => {
    await forgotPasswordPage.enterMobileLast4('123456');

    await forgotPasswordPage.expectMobileLast4Value('1234');
  });

  for (const [label, digits] of [
    ['fewer than 4', '12'],
    ['non-numeric', 'ab1c'],
  ]) {
    test(`rejects ${label} mobile digits`, async ({ forgotPasswordPage }) => {
      await forgotPasswordPage.requestOtp(account!.username, digits);

      await forgotPasswordPage.expectInvalidMobileError();
      await forgotPasswordPage.expectDisplayed();
    });
  }

  test('rejects wrong mobile digits', async ({ forgotPasswordPage }) => {
    const wrongDigits = account!.mobileLast4 === '0000' ? '1111' : '0000';

    await forgotPasswordPage.requestOtp(account!.username, wrongDigits);

    await forgotPasswordPage.expectInvalidCombinationError();
  });

  test('rejects an unknown username', async ({ forgotPasswordPage }) => {
    await forgotPasswordPage.requestOtp('no.such.user.qa@example.com', account!.mobileLast4);

    await forgotPasswordPage.expectInvalidCombinationError();
  });

  test('cancel returns to the login page', async ({ loginPage, forgotPasswordPage }) => {
    await forgotPasswordPage.cancel();

    await loginPage.expectLoggedOut();
  });

  test('rejects a wrong OTP', async ({ forgotPasswordPage }) => {
    const wrongOtp = account!.otp === '000000' ? '111111' : '000000';

    await forgotPasswordPage.requestOtp(account!.username, account!.mobileLast4);
    await forgotPasswordPage.verifyOtpPage.expectDisplayed();
    await forgotPasswordPage.verifyOtpPage.submitOtp(wrongOtp);

    await forgotPasswordPage.verifyOtpPage.expectInvalidOtpError();
  });

  test('cancelling OTP verification returns to login after confirmation', async ({ loginPage, forgotPasswordPage }) => {
    await forgotPasswordPage.requestOtp(account!.username, account!.mobileLast4);
    await forgotPasswordPage.verifyOtpPage.expectDisplayed();
    await forgotPasswordPage.verifyOtpPage.cancel();

    await loginPage.expectLoggedOut();
  });

  test.describe('Reset password', () => {
    test.beforeEach(async ({ forgotPasswordPage }) => {
      await forgotPasswordPage.reachResetPasswordScreen(account!);
    });

    test('shows required errors when both fields are empty', async ({ forgotPasswordPage }) => {
      const { resetPasswordPage } = forgotPasswordPage;

      await resetPasswordPage.clickReset();

      await resetPasswordPage.expectRequiredErrors();
      await resetPasswordPage.expectDisplayed();
    });

    test('rejects a password that is too short', async ({ forgotPasswordPage }) => {
      const { resetPasswordPage } = forgotPasswordPage;

      await resetPasswordPage.enterPasswords('Asdf#12', 'Asdf#12');
      await expectResetRefused(resetPasswordPage, 'Asdf#12');

      await resetPasswordPage.expectInvalidPasswordError();
      await resetPasswordPage.expectDisplayed();
    });

    test('rejects a password longer than 20 characters', async ({ forgotPasswordPage }) => {
      const { resetPasswordPage } = forgotPasswordPage;
      const tooLong = `Abcd#1234${'x'.repeat(24)}`;

      await resetPasswordPage.enterPasswords(tooLong, tooLong);
      await expectResetRefused(resetPasswordPage, tooLong);

      await resetPasswordPage.expectMaxLengthError();
      await resetPasswordPage.expectDisplayed();
    });

    for (const [missing, password] of [
      ['an uppercase letter', 'abcd#1234'],
      ['a lowercase letter', 'ABCD#1234'],
      ['a digit', 'Abcd#efgh'],
      ['a special character', 'Abcd12345'],
    ]) {
      test(`rejects a password without ${missing}`, async ({ forgotPasswordPage }) => {
        const { resetPasswordPage } = forgotPasswordPage;

        await resetPasswordPage.enterPasswords(password, password);
        await expectResetRefused(resetPasswordPage, password);

        await resetPasswordPage.expectInvalidPasswordError();
        await resetPasswordPage.expectDisplayed();
      });
    }

    // New Password is the current one, so even if the app submitted it, nothing would change.
    test('rejects a confirm password that does not match', async ({ forgotPasswordPage }) => {
      const { resetPasswordPage } = forgotPasswordPage;

      await resetPasswordPage.enterPasswords(account!.password, `${account!.password}x`);
      await resetPasswordPage.expectConfirmPasswordFlagged();
      await expectResetRefused(resetPasswordPage, account!.password);

      await resetPasswordPage.expectMismatchError();
      await resetPasswordPage.expectDisplayed();
    });

    // Staging keeps the last 3 passwords, so resetting to the current one is refused and
    // nothing changes. The successful reset is in specs/password-reset (on demand).
    test('rejects reusing a recent password', async ({ forgotPasswordPage }) => {
      const { resetPasswordPage } = forgotPasswordPage;

      await resetPasswordPage.enterPasswords(account!.password, account!.password);
      await expectResetRefused(resetPasswordPage, account!.password);

      await resetPasswordPage.expectPasswordReuseError();
      await resetPasswordPage.expectDisplayed();
    });

    test('masks the new password and toggles its visibility', async ({ forgotPasswordPage }) => {
      const { resetPasswordPage } = forgotPasswordPage;

      await resetPasswordPage.enterPasswords('Abcd#1234', '');
      await resetPasswordPage.expectNewPasswordMasked();

      await resetPasswordPage.toggleNewPasswordVisibility();
      await resetPasswordPage.expectNewPasswordShown();

      await resetPasswordPage.toggleNewPasswordVisibility();
      await resetPasswordPage.expectNewPasswordMasked();
    });

    test('cancel returns to the login page after confirmation', async ({ loginPage, forgotPasswordPage }) => {
      await forgotPasswordPage.resetPasswordPage.cancel();

      await loginPage.expectLoggedOut();
    });
  });
});
