import { expect, test } from '../../../fixtures/admin-fixtures';
import type { NewAdminUser } from '../../../pages/admin/users/create-user.page';

// Writes: the creating test leaves one permanent user per run under the Compiled Test
// organization, because deleting users is outside what these specs may do. Opt-in only:
// npm run test:admin-write.

function newUser(): NewAdminUser {
  const stamp = Date.now().toString();

  return {
    organization: 'Compiled Test',
    companyName: 'QA Automation',
    fullName: 'QA Automation User',
    username: `qa_auto_${stamp}`,
    email: `qa_auto_${stamp}@example.com`,
    mobile: `9${stamp.slice(-9)}`,
    dltEntityId: `1${stamp}${stamp.slice(-5)}`.slice(0, 19),
    currencyUnit: 'INR',
    amount: '1',
    timeZone: 'Asia/Kolkata',
    country: 'India',
    expiresInYear: new Date().getFullYear() + 1,
  };
}

test.describe('Create User', () => {
  test('Cancel leaves the form without saving', async ({ page, createUserPage }) => {
    const posts: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST') posts.push(new URL(request.url()).pathname);
    });

    await createUserPage.open();
    await createUserPage.enterDetails(newUser());
    await createUserPage.cancel();

    await expect(page).toHaveURL(/#\/organizations\/user$/);
    expect(posts.filter((path) => path.endsWith('/api/v1/users'))).toEqual([]);
  });

  test('creates a user, then refuses the same username again', async ({ createUserPage }) => {
    const user = newUser();
    await createUserPage.open();
    await createUserPage.enterDetails(user);

    const created = await createUserPage.save();
    expect(created, `server answered: ${created.message}`).toMatchObject({ success: true });
    await createUserPage.expectSavedAndOpened(user);

    await createUserPage.open();
    await createUserPage.enterDetails({ ...user, email: `dup_${user.email}` });

    const duplicate = await createUserPage.save();
    expect(duplicate.success, `server answered: ${duplicate.message}`).toBe(false);
  });
});
