import { expect, test } from '../../../fixtures/admin-fixtures';
import type { EditUserPage, UserDetailsUpdate } from '../../../pages/admin/users/edit-user.page';
import type { AdminUser, UsersPage } from '../../../pages/admin/users/users.page';

// Writes: edits only users the Create User spec made (qa_auto_<timestamp>), never anyone else's,
// and changes nothing that needs approval (see UserDetailsUpdate). Opt-in only:
// npm run test:admin-write.

// The newest qa_auto_ user made before this test started, so a Create User test running in
// another worker is never edited while it still checks its own user.
async function openCreatedUser(usersPage: UsersPage, editUserPage: EditUserPage): Promise<AdminUser> {
  const startedAt = Date.now();
  await usersPage.open();
  const user = (await usersPage.search('qa_auto_')).find((candidate) => {
    const stamp = /^qa_auto_(\d{13})$/.exec(candidate.username)?.[1];
    return stamp !== undefined && Number(stamp) < startedAt;
  });

  if (!user) {
    throw new Error('No qa_auto_ user to edit yet: run the Create User spec first.');
  }

  await usersPage.openEdit(user.username);
  await editUserPage.expectOpened(user.username);
  return user;
}

// Full name takes only letters and spaces, so its suffix spells the timestamp's digits as letters.
function newDetails(): UserDetailsUpdate {
  const stamp = Date.now().toString();
  const letters = stamp.slice(-6).replace(/\d/g, (digit) => 'abcdefghij'[Number(digit)]);

  return {
    companyName: `QA Automation ${stamp.slice(-6)}`,
    fullName: `QA Automation User ${letters}`,
    state: 'Maharashtra',
    city: 'Pune',
    zipCode: `411${stamp.slice(-3)}`,
    address: `Test address ${stamp}`,
    sessionTimeout: 30 + (Number(stamp) % 30),
  };
}

test.describe('Update User', () => {
  test('Cancel leaves the edit page without saving', async ({ page, usersPage, editUserPage }) => {
    const puts: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'PUT') puts.push(new URL(request.url()).pathname);
    });

    await openCreatedUser(usersPage, editUserPage);
    await editUserPage.enterDetails(newDetails());
    await editUserPage.cancel();

    await usersPage.expectDisplayed();
    expect(puts.filter((path) => /\/api\/v1\/users\/\d+$/.test(path))).toEqual([]);
  });

  test('updates the details of a user the Create User spec made', async ({ usersPage, editUserPage }) => {
    const user = await openCreatedUser(usersPage, editUserPage);
    const details = newDetails();
    await editUserPage.enterDetails(details);

    const updated = await editUserPage.update();
    expect(updated, `server answered: ${updated.message}`).toMatchObject({ success: true });
    await editUserPage.expectUpdated();

    await usersPage.open();
    await usersPage.search(user.username);
    await usersPage.openEdit(user.username);
    await editUserPage.expectOpened(user.username);
    await editUserPage.expectDetails(details);
  });
});
