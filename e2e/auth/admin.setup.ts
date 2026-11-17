import { test } from '../fixtures/admin-fixtures';
import { adminSession, isSavedTokenValid, saveAuthState } from '../utils/auth-state';
import { readAdminCredentials } from '../utils/test-data';

test.use({ useAuthenticatedSession: false });

test('authenticate the admin and persist browser state', async ({ page, request, adminLoginPage }) => {
  if (await isSavedTokenValid(request, adminSession)) {
    test.info().annotations.push({ type: 'auth', description: 'Reused the saved admin access token.' });
    return;
  }

  const admin = readAdminCredentials();

  await adminLoginPage.open();
  await adminLoginPage.login(admin.username, admin.password, admin.otp);

  await saveAuthState(page, adminSession);
});
