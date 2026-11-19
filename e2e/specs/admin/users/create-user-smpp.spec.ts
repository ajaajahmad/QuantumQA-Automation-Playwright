import { expect, test } from '../../../fixtures/admin-fixtures';
import { getUserSmpp } from '../../../utils/admin-api';

// Read-only: opens Users > Create User and a user's edit page and never saves. The form schema
// (GET users/form/input) marks every SMPP field disabled on create, so only ticking Enable SMPP
// should unlock them. Titles carry the INF-14706 test plan's IDs.

test.describe('Create User SMPP Configuration', () => {
  test('ADM-01 offers Enable SMPP unticked on Create User', async ({ createUserPage }) => {
    await createUserPage.open();

    await createUserPage.form.expectSmppEnabled(false);
  });

  // The newest qa_auto_ user, whichever way its SMPP is set: the box must show what is stored.
  test('ADM-01 shows Enable SMPP on the edit page as the user has it', async ({
    adminApi,
    usersPage,
    editUserPage,
  }) => {
    await usersPage.open();
    const [user] = await usersPage.search('qa_auto_');
    test.skip(!user, 'No qa_auto_ user to open.');

    await usersPage.openEdit(user.username);
    await editUserPage.expectOpened(user.username);

    const { is_smpp_enabled } = await getUserSmpp(adminApi, user.id);
    await editUserPage.form.expectSmppEnabled(is_smpp_enabled === 1);
    expect(editUserPage.userId()).toBe(user.id);
  });

  // Known defect: all six SMPP fields take input while Enable SMPP is unticked, though the schema
  // marks them disabled. This passes while the defect exists and fails once it's fixed: then remove
  // test.fail.
  test('ADM-02 keeps the SMPP fields locked until Enable SMPP is ticked', async ({ createUserPage }) => {
    test.fail(true, 'Staging lets the SMPP fields take input before Enable SMPP is ticked.');
    await createUserPage.open();

    await createUserPage.form.expectSmppEnabled(false);
    await createUserPage.form.expectSmppFieldsEditable(false);
  });

  test('ADM-02 unlocks the SMPP fields when Enable SMPP is ticked', async ({ createUserPage }) => {
    await createUserPage.open();

    await createUserPage.form.tickEnableSmpp();

    await createUserPage.form.expectSmppFieldsEditable(true);
  });
});
