import { expect, test } from '../../../fixtures/admin-fixtures';
import {
  createAdminApi,
  createRole,
  deleteRole,
  findRoles,
  getFeatures,
  getPermissions,
  getRoleFeatureValues,
  getRolePermissionIds,
  type AdminRole,
} from '../../../utils/admin-api';

// Writes, opt-in only (npm run test:admin-write), to the specs' own roles only:
// - each run creates "QA Auto Role <stamp>", renames it and deletes it; afterAll deletes it through
//   the API if a step failed first;
// - the permission and feature tests reuse one permanent "QA Auto Permission Role", because once a
//   role holds a permission it can't be cleared back to none, and a role with permissions can't be
//   deleted. No admin user is given that role.
// Role names take letters, digits and spaces only, up to 30 characters, so the qa_auto_ prefix the
// other write specs use is written with spaces here and the stamp is the time in base 36.

test.describe.configure({ mode: 'serial' });

const stamp = Date.now().toString(36);
const name = `QA Auto Role ${stamp}`;
const renamed = `QA Auto Renamed ${stamp}`;
const permissionRole = 'QA Auto Permission Role';
const viewPermissions = ['View Roles', 'View Admin Users'];

type Api = Parameters<typeof findRoles>[0];

test.afterAll(async ({ playwright }) => {
  const api = await createAdminApi(playwright.request);

  for (const role of (await findRoles(api, stamp)).filter((found) => found.role.endsWith(stamp))) {
    await deleteRole(api, role.id);
  }

  await api.dispose();
});

async function roleNamed(api: Api, roleName: string): Promise<AdminRole | undefined> {
  return (await findRoles(api, roleName)).find((found) => found.role === roleName);
}

// The permanent role, created with no permissions the first time a run needs it.
async function thePermissionRole(api: Api): Promise<AdminRole> {
  if (!(await roleNamed(api, permissionRole))) {
    await createRole(api, permissionRole);
  }

  return (await roleNamed(api, permissionRole))!;
}

async function permissionIds(api: Api, labels: string[]): Promise<number[]> {
  const all = Object.values(await getPermissions(api)).flat();
  return labels.map((label) => all.find((permission) => permission.permission === label)!.id);
}

test.describe('A new role, created and deleted', () => {
  test('creates a role the list shows with no holders and Delete allowed', async ({ rolePermissionsPage, roleFormPage }) => {
    await rolePermissionsPage.open();
    await rolePermissionsPage.openCreate();
    await roleFormPage.enterName(name);

    const created = await roleFormPage.save();

    expect(created, `server answered: ${created.message}`).toMatchObject({ success: true });
    await roleFormPage.messageDialog.expectShown('Success', 'Roles added Successfully');
    await roleFormPage.messageDialog.close();
    await rolePermissionsPage.open();
    const results = await rolePermissionsPage.search<AdminRole>(name);
    expect(results.data.items).toEqual([expect.objectContaining({ role: name, count: 0 })]);
    await rolePermissionsPage.table.expectRowsOf(results);
    await rolePermissionsPage.table.expectRowAction(name, 'Delete', true);
  });

  test('refuses a second role with the same name', async ({ adminApi, rolePermissionsPage, roleFormPage }) => {
    await rolePermissionsPage.open();
    await rolePermissionsPage.openCreate();
    await roleFormPage.enterName(name);

    const duplicate = await roleFormPage.save();

    expect(duplicate).toMatchObject({ success: false, message: 'Role Already Exist' });
    await roleFormPage.messageDialog.expectShown('Error', 'Role Already Exist');
    await roleFormPage.messageDialog.close();
    expect((await findRoles(adminApi, name)).filter((role) => role.role === name)).toHaveLength(1);
  });

  test('refuses a name with characters other than letters, digits and spaces', async ({ rolePermissionsPage, roleFormPage }) => {
    await rolePermissionsPage.open();
    await rolePermissionsPage.openCreate();
    await roleFormPage.enterName(`qa_auto_${stamp}`);

    const refused = await roleFormPage.save();

    expect(refused.success).toBe(false);
    expect(refused.message).toContain('Alphabet,numeric and space allowed only');
    // The page shows nothing for this refusal; the reason is only in the response.
    await roleFormPage.messageDialog.closeIfShown();
  });

  test('renames the role', async ({ adminApi, rolePermissionsPage, roleFormPage }) => {
    const role = (await roleNamed(adminApi, name))!;
    await rolePermissionsPage.open();
    await rolePermissionsPage.search(name);
    await rolePermissionsPage.table.clickRowAction(name, 'Edit');
    await roleFormPage.expectEditForm(role.id, name);
    await roleFormPage.enterName(renamed);

    const updated = await roleFormPage.update();

    expect(updated, `server answered: ${updated.message}`).toMatchObject({ success: true });
    await roleFormPage.messageDialog.expectShown('Success', 'Roles has been successfully updated');
    await roleFormPage.messageDialog.close();
    expect((await roleNamed(adminApi, renamed))?.id).toBe(role.id);
  });

  test('refuses a name longer than 30 characters', async ({ adminApi, rolePermissionsPage, roleFormPage }) => {
    await rolePermissionsPage.open();
    await rolePermissionsPage.search(renamed);
    await rolePermissionsPage.table.clickRowAction(renamed, 'Edit');
    await roleFormPage.enterName(`${renamed} ${'x'.repeat(30)}`);

    const refused = await roleFormPage.update();

    expect(refused.success).toBe(false);
    expect(refused.message).toContain('Role must be shorter than or equal to 30 characters');
    // The page shows nothing for this refusal; the reason is only in the response.
    await roleFormPage.messageDialog.closeIfShown();
    expect(await roleNamed(adminApi, renamed)).toBeTruthy();
  });

  test('deletes the role after confirmation', async ({ adminApi, rolePermissionsPage }) => {
    await rolePermissionsPage.open();
    await rolePermissionsPage.search(renamed);

    const deleted = await rolePermissionsPage.deleteRow(renamed);

    expect(deleted, `server answered: ${deleted.message}`).toMatchObject({ success: true });
    // A delete shows no message; the confirmation closes and the row goes.
    expect(await roleNamed(adminApi, renamed)).toBeUndefined();
    await rolePermissionsPage.open();
    await rolePermissionsPage.search(renamed);
    await rolePermissionsPage.table.expectEmpty();
  });
});

test.describe('The permanent permission role', () => {
  test('saves a change to the role permissions', async ({ adminApi, rolePermissionsPage, permissionsPage }) => {
    const role = await thePermissionRole(adminApi);
    const [viewRoles, viewAdminUsers] = await permissionIds(adminApi, viewPermissions);
    const held = await getRolePermissionIds(adminApi, role.id);
    // Each run swaps one view permission for the other, so the save always changes something.
    const [add, remove] = held.includes(viewRoles) ? [viewAdminUsers, viewRoles] : [viewRoles, viewAdminUsers];
    await rolePermissionsPage.open();
    await rolePermissionsPage.search(permissionRole);
    await rolePermissionsPage.table.clickRowAction(permissionRole, 'Manage Role Permissions');
    await permissionsPage.expectDisplayed('role');
    await permissionsPage.expectTicked(held);

    await permissionsPage.setTicked(add, true);
    await permissionsPage.setTicked(remove, false);
    const saved = await permissionsPage.submit();

    expect(saved, `server answered: ${saved.message}`).toMatchObject({ success: true });
    await permissionsPage.messageDialog.expectShown('Success', 'Permissions Assigned Successfully');
    await permissionsPage.messageDialog.close();
    expect(await getRolePermissionIds(adminApi, role.id)).toEqual([add]);
    await rolePermissionsPage.open();
    await rolePermissionsPage.search(permissionRole);
    await rolePermissionsPage.table.clickRowAction(permissionRole, 'Manage Role Permissions');
    await permissionsPage.expectTicked([add]);
  });

  test('refuses to clear every permission', async ({ adminApi, rolePermissionsPage, permissionsPage }) => {
    const role = await thePermissionRole(adminApi);
    const held = await getRolePermissionIds(adminApi, role.id);
    await rolePermissionsPage.open();
    await rolePermissionsPage.search(permissionRole);
    await rolePermissionsPage.table.clickRowAction(permissionRole, 'Manage Role Permissions');
    await permissionsPage.expectTicked(held);

    for (const id of held) {
      await permissionsPage.setTicked(id, false);
    }
    const refused = await permissionsPage.submit();

    expect(refused).toMatchObject({ success: false, message: 'Please select permissions' });
    await permissionsPage.messageDialog.expectShown('Error', 'Please select permissions');
    await permissionsPage.messageDialog.close();
    expect(await getRolePermissionIds(adminApi, role.id)).toEqual(held);
  });

  test('saves a change to the role features', async ({ adminApi, rolePermissionsPage, featureConfigurationPage }) => {
    const role = await thePermissionRole(adminApi);
    const [feature] = Object.values(await getFeatures(adminApi)).flat();
    // Each run flips the first feature, so the save always changes something.
    const on = (await getRoleFeatureValues(adminApi, role.id))[feature.id] !== 1;
    await rolePermissionsPage.open();
    await rolePermissionsPage.search(permissionRole);
    await rolePermissionsPage.table.clickRowAction(permissionRole, 'Feature Configurations');
    await featureConfigurationPage.expectDisplayed(`Role : ${permissionRole}`);
    await featureConfigurationPage.setTicked(feature.name, on);

    const saved = await featureConfigurationPage.submit();

    expect(saved, `server answered: ${saved.message}`).toMatchObject({ success: true });
    await featureConfigurationPage.messageDialog.expectShown('Success', 'Features Assigned Successfully');
    await featureConfigurationPage.messageDialog.close();
    expect((await getRoleFeatureValues(adminApi, role.id))[feature.id]).toBe(on ? 1 : 0);
    await rolePermissionsPage.open();
    await rolePermissionsPage.search(permissionRole);
    await rolePermissionsPage.table.clickRowAction(permissionRole, 'Feature Configurations');
    await featureConfigurationPage.expectTicked(feature.name, on);
  });

  // Known defect: the list enables Delete for every role no admin user holds, but the server refuses
  // to delete a role that has permissions ("Role Cannot be deleted"), and permissions can't be
  // cleared, so the button can never work for such a role. This passes while the defect exists and
  // fails once it's fixed: then remove test.fail. The role is checked before test.fail.
  test.describe(() => {
    test.beforeEach(async ({ adminApi }) => {
      const role = await thePermissionRole(adminApi);
      test.skip(role.count > 0, 'An admin user holds the permission role, which disables Delete anyway.');
      expect((await getRolePermissionIds(adminApi, role.id)).length).toBeGreaterThan(0);
    });

    test('disables Delete for a role the server will not delete', async ({ rolePermissionsPage }) => {
      test.fail(true, 'Staging enables Delete for roles with permissions, which it refuses to delete.');
      await rolePermissionsPage.open();
      await rolePermissionsPage.search(permissionRole);

      await rolePermissionsPage.table.expectRowAction(permissionRole, 'Delete', false);
    });
  });
});
