import { test } from '../../../fixtures/admin-fixtures';

// Read-only: opens Users > Create User and never saves. The form schema (GET users/form/input)
// marks every SMPP field disabled on create, so only ticking Enable SMPP should unlock them.

test.describe('Create User SMPP Configuration', () => {
  // Known defect: all six SMPP fields take input while Enable SMPP is unticked, though the schema
  // marks them disabled. This passes while the defect exists and fails once it's fixed: then remove
  // test.fail.
  test('keeps the SMPP fields locked until Enable SMPP is ticked', async ({ createUserPage }) => {
    test.fail(true, 'Staging lets the SMPP fields take input before Enable SMPP is ticked.');
    await createUserPage.open();

    await createUserPage.form.expectSmppEnabled(false);
    await createUserPage.form.expectSmppFieldsEditable(false);
  });

  test('unlocks the SMPP fields when Enable SMPP is ticked', async ({ createUserPage }) => {
    await createUserPage.open();

    await createUserPage.form.tickEnableSmpp();

    await createUserPage.form.expectSmppFieldsEditable(true);
  });
});
