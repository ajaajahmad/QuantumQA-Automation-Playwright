import { expect, test } from '../../../fixtures/admin-fixtures';
import type { AdminUserDetails } from '../../../pages/admin/admin-group/admin-user-form.page';
import type { SaveResult } from '../../../pages/admin/components/user-form.component';
import {
  createRole,
  findRoles,
  getAdminList,
  getAdminUserProfile,
  getFeatures,
  getPermissions,
  getUserFeatureValues,
  getUserPermissionIds,
} from '../../../utils/admin-api';
import { appConfig } from '../../../utils/config';
import { monthsAhead } from '../../../utils/date-time';
import { randomDigits, uniqueSuffix } from '../../../utils/random';

// Writes, opt-in only (npm run test:admin-write). Each run creates one permanent admin user,
// qa_auto_<stamp>@<official_email_domain>, Inactive and expiring next month, then edits only that
// user. Admin users can't be deleted. The server takes only official-domain emails for admin users,
// so the domain comes from config/qa.properties (gitignored) and the specs skip without it. Every
// such user holds "QA Auto Admin User Role", a role of the specs' own with no permissions, created
// the first time a run needs it; with Inactive status and no permissions the account can do
// nothing. The password is random and kept nowhere.

test.describe.configure({ mode: 'serial' });

const roleName = 'QA Auto Admin User Role';
const stamp = uniqueSuffix().toLowerCase();

const user: AdminUserDetails = {
  fullName: 'QA Automation Admin',
  username: `qa_auto_${stamp}@${appConfig.officialEmailDomain}`,
  password: `Qa!${randomDigits(4)}${stamp}Z`,
  mobile: `9${randomDigits(9)}`,
  countries: ['India'],
  state: 'Delhi',
  city: 'New Delhi',
  zipcode: '110001',
  address: 'QA automation, not a real address',
  role: roleName,
  expiresOn: monthsAhead(1),
  status: 'Inactive',
};

// The update picks the country again, since the create saves none.
const edited = {
  fullName: 'QA Automation Admin Edited',
  countries: ['India'],
  state: 'Haryana',
  city: 'Gurugram',
  zipcode: '122001',
  address: 'QA automation, edited',
};

type Api = Parameters<typeof findRoles>[0];

let createAnswer: SaveResult | undefined;
type AdminUserRow = { id: number; username: string; status: string; role: string };

async function ensureRole(api: Api): Promise<void> {
  if (!(await findRoles(api, roleName)).some((role) => role.role === roleName)) {
    await createRole(api, roleName);
  }
}

async function theUser(api: Api): Promise<AdminUserRow> {
  const [found] = (await getAdminList<AdminUserRow>(api, 'auth/users', { queryterm: user.username })).data.items.filter(
    (row) => row.username === user.username,
  );
  expect(found, `the admin user ${user.username} should exist`).toBeTruthy();
  return found;
}

test.describe('Admin Users, writing', () => {
  test.skip(!appConfig.officialEmailDomain, 'Set official_email_domain in config/qa.properties; admin users need an official email.');

  // Known defect (pinned below): the server saves the user but answers "Something went wrong.", so
  // this test checks what was saved, and keeps the answer for the pinned test.
  test('creates an inactive admin user the list and edit page show', async ({ adminApi, adminUsersPage, adminUserFormPage }) => {
    await ensureRole(adminApi);
    await adminUsersPage.open();
    await adminUsersPage.openCreate();
    await adminUserFormPage.enter(user);

    createAnswer = await adminUserFormPage.save();

    // The page shows the false "Something went wrong." error; the answer is pinned below.
    await adminUserFormPage.messageDialog.closeIfShown();
    await adminUsersPage.open();
    const results = await adminUsersPage.search<AdminUserRow>(user.username);
    expect(results.data.items).toEqual([expect.objectContaining({ username: user.username, role: roleName })]);
    expect(results.data.items[0].status.toLowerCase()).toBe('inactive');
    await adminUsersPage.table.expectRowsOf(results);

    // The edit page shows what was stored; the Countries the form sent are pinned below.
    const { id } = results.data.items[0];
    const saved = await getAdminUserProfile(adminApi, id);
    await adminUsersPage.table.clickRowAction(user.username, 'Edit');
    await adminUserFormPage.expectEditForm(id);
    await adminUserFormPage.expectValues({ ...user, countries: saved.countries });
  });

  // Known defects, pinned: the create above saves the user without the Countries it sent (they come
  // back empty) and answers success: false, "Something went wrong." (status_code 500). These pass
  // while the defects exist and fail once they're fixed: then remove test.fail. Neither sends anything.
  test('answers success to a create that saved the user', async () => {
    test.fail(true, 'Staging answers "Something went wrong." to an admin user create that succeeded.');

    expect(createAnswer, `server answered: ${createAnswer?.message}`).toMatchObject({ success: true });
  });

  test('keeps the countries picked on create', async ({ adminApi }) => {
    const { id } = await theUser(adminApi);
    test.fail(true, 'Staging saves a new admin user without its Countries.');

    expect((await getAdminUserProfile(adminApi, id)).countries).toEqual(user.countries);
  });

  test('refuses the same username again', async ({ adminApi, adminUsersPage, adminUserFormPage }) => {
    await adminUsersPage.open();
    await adminUsersPage.openCreate();
    await adminUserFormPage.enter({ ...user, mobile: `9${randomDigits(9)}` });

    const duplicate = await adminUserFormPage.save();

    expect(duplicate).toMatchObject({ success: false, message: 'Username already exist, Email id already exist' });
    await adminUserFormPage.messageDialog.expectShown('Error', 'Username already exist, Email id already exist');
    await adminUserFormPage.messageDialog.close();
    const matches = (await getAdminList<AdminUserRow>(adminApi, 'auth/users', { queryterm: user.username })).data.items;
    expect(matches.filter((row) => row.username === user.username)).toHaveLength(1);
  });

  test('updates the user details', async ({ adminApi, adminUsersPage, adminUserFormPage }) => {
    const { id } = await theUser(adminApi);
    await adminUsersPage.open();
    await adminUsersPage.search(user.username);
    await adminUsersPage.table.clickRowAction(user.username, 'Edit');
    await adminUserFormPage.expectEditForm(id);
    await adminUserFormPage.enter(edited);

    const updated = await adminUserFormPage.update();

    expect(updated, `server answered: ${updated.message}`).toMatchObject({ success: true });
    await adminUserFormPage.messageDialog.expectShown('Success', 'User Updated Successfully');
    await adminUserFormPage.messageDialog.close();
    await adminUsersPage.open();
    await adminUsersPage.search(user.username);
    await adminUsersPage.table.clickRowAction(user.username, 'Edit');
    await adminUserFormPage.expectValues({ ...user, ...edited });
  });

  test('saves a permission for the user', async ({ adminApi, adminUsersPage, permissionsPage }) => {
    const { id } = await theUser(adminApi);
    const viewRoles = Object.values(await getPermissions(adminApi))
      .flat()
      .find((permission) => permission.permission === 'View Roles')!.id;
    await adminUsersPage.open();
    await adminUsersPage.search(user.username);
    await permissionsPage.openedBy(() => adminUsersPage.table.clickRowAction(user.username, 'Manage Role Permissions'));
    await permissionsPage.expectDisplayed('user');
    await permissionsPage.expectTicked(await getUserPermissionIds(adminApi, id));

    await permissionsPage.setTicked(viewRoles, true);
    const saved = await permissionsPage.submit();

    expect(saved, `server answered: ${saved.message}`).toMatchObject({ success: true });
    await permissionsPage.messageDialog.expectShown('Success', 'Permissions Assigned Successfully');
    await permissionsPage.messageDialog.close();
    expect(await getUserPermissionIds(adminApi, id)).toContain(viewRoles);
    await adminUsersPage.open();
    await adminUsersPage.search(user.username);
    await permissionsPage.openedBy(() => adminUsersPage.table.clickRowAction(user.username, 'Manage Role Permissions'));
    await permissionsPage.expectTicked(await getUserPermissionIds(adminApi, id));
  });

  test('saves a notification feature for the user, then clears it', async ({ adminApi, adminUsersPage, featureConfigurationPage }) => {
    const { id } = await theUser(adminApi);
    const [feature] = Object.values(await getFeatures(adminApi)).flat();

    for (const on of [true, false]) {
      await adminUsersPage.open();
      await adminUsersPage.search(user.username);
      await featureConfigurationPage.openedBy(() => adminUsersPage.table.clickRowAction(user.username, 'Feature Configurations'));
      // The line is labelled Username but shows the full name.
      await featureConfigurationPage.expectDisplayed(`Username : ${edited.fullName}`);
      await featureConfigurationPage.expectTicked(feature.name, !on);
      await featureConfigurationPage.setTicked(feature.name, on);

      const saved = await featureConfigurationPage.submit();

      expect(saved, `server answered: ${saved.message}`).toMatchObject({ success: true });
      await featureConfigurationPage.messageDialog.expectShown('Success', 'Features Assigned Successfully');
      await featureConfigurationPage.messageDialog.close();
      expect((await getUserFeatureValues(adminApi, id))[feature.id]).toBe(on ? 1 : 0);
    }
  });
});
