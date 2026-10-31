import { test } from '../../fixtures/test-fixtures';
import { appConfig } from '../../utils/config';
import { generateSimilarPassword } from '../../utils/password';
import {
  clearPendingPassword,
  pendingPasswordPath,
  readForgotPasswordAccount,
  readPendingPassword,
  savePendingPassword,
  updateUserPassword,
} from '../../utils/test-data';

// Changes the real password of the account every other test logs in with, so this runs in
// its own project: after the login specs and before auth setup reads userdata.json.
const account = readForgotPasswordAccount();

test.use({ useAuthenticatedSession: false });

test.describe('Password reset', () => {
  test.skip(!account, 'Add mobile_last_four_digits and one_time_password to a userdata.json row to run this test.');

  test('resets the password and stores the new one in userdata.json', async ({
    page,
    loginPage,
    forgotPasswordPage,
  }) => {
    const { resetPasswordPage } = forgotPasswordPage;

    if (readPendingPassword()) {
      throw new Error(
        `${pendingPasswordPath} is left from a reset that was never confirmed. Log in with the password in it: ` +
          'if it works, copy it into userdata.json. Then delete the file and run again.',
      );
    }

    const newPassword = generateSimilarPassword(account!.password);

    await page.goto(appConfig.appUrl, { waitUntil: 'domcontentloaded' });
    await loginPage.openForgotPassword();
    await forgotPasswordPage.reachResetPasswordScreen(account!);

    // Saved before submitting: if the app accepts it but a later step fails, the password isn't lost.
    savePendingPassword({ username: account!.username, password: newPassword });

    await resetPasswordPage.enterPasswords(newPassword, newPassword);
    await resetPasswordPage.clickReset();
    await resetPasswordPage.expectResetAccepted();

    // Logging in with the new password is what proves it changed; only then is userdata.json updated.
    await page.goto(appConfig.appUrl, { waitUntil: 'domcontentloaded' });
    await loginPage.userLogin(account!.username, newPassword, account!.otp);

    updateUserPassword(account!.username, newPassword);
    clearPendingPassword();
  });
});
