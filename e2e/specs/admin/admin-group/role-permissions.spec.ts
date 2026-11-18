import { expect, test } from '../../../fixtures/admin-fixtures';
import { getFeatures, getPermissions, getRole, getRoleFeatureValues, getRolePermissionIds } from '../../../utils/admin-api';
import { blockWrites } from '../../../utils/write-guard';

// Read-only: every test aborts the requests that would change data, so a click on Save, Update,
// Submit or a delete confirmation shows what the page would send without anything reaching the
// server. The specs that write live in specs/admin/write/.

type RoleRow = { id: number; role: string; count: number };

test.describe('Role Permissions list', () => {
  test('opens from the Admin group with the columns, rows and total the API sent', async ({ rolePermissionsPage }) => {
    const list = await rolePermissionsPage.open<RoleRow>();

    await rolePermissionsPage.table.expectColumnsOf(list);
    await rolePermissionsPage.table.expectRowsOf(list);
    await rolePermissionsPage.table.expectTotal(list.data.meta.totalItems);
    await rolePermissionsPage.table.expectActions(0, ['Edit', 'Manage Role Permissions', 'Delete', 'Feature Configurations']);
  });

  test('pages through the list with the pager', async ({ rolePermissionsPage }) => {
    const { meta } = (await rolePermissionsPage.open()).data;
    test.skip(meta.totalPages < 2, 'The list fits on one page.');

    const next = await rolePermissionsPage.table.goToPage('next');
    expect(next.query.get('page')).toBe('2');
    await rolePermissionsPage.table.expectRowsOf(next);
    await rolePermissionsPage.table.expectCurrentPage(2);

    const previous = await rolePermissionsPage.table.goToPage('previous');
    expect(previous.query.get('page')).toBe('1');
    await rolePermissionsPage.table.expectRowsOf(previous);

    const pageTwo = await rolePermissionsPage.table.goToPage(2);
    expect(pageTwo.query.get('page')).toBe('2');
    await rolePermissionsPage.table.expectCurrentPage(2);
  });

  test('sorts by ID ascending, then descending', async ({ rolePermissionsPage }) => {
    await rolePermissionsPage.open();

    const ascending = await rolePermissionsPage.table.sortBy<RoleRow>('ID', 'asc');
    const ascendingIds = ascending.data.items.map((role) => role.id);
    expect(ascendingIds).toEqual([...ascendingIds].sort((a, b) => a - b));
    await rolePermissionsPage.table.expectSorted('ID', 'asc');
    await rolePermissionsPage.table.expectRowsOf(ascending);

    const descending = await rolePermissionsPage.table.sortBy<RoleRow>('ID', 'desc');
    const descendingIds = descending.data.items.map((role) => role.id);
    expect(descendingIds).toEqual([...descendingIds].sort((a, b) => b - a));
    await rolePermissionsPage.table.expectSorted('ID', 'desc');
  });

  test('searches by role name', async ({ rolePermissionsPage }) => {
    const [role] = (await rolePermissionsPage.open<RoleRow>()).data.items;

    const results = await rolePermissionsPage.search<RoleRow>(role.role);

    expect(results.data.items.map((found) => found.id)).toContain(role.id);
    for (const found of results.data.items) {
      expect(found.role.toLowerCase()).toContain(role.role.toLowerCase());
    }
    await rolePermissionsPage.table.expectRowsOf(results);
  });

  test('shows no rows for an unknown name, and the whole list again when cleared', async ({ rolePermissionsPage }) => {
    const all = await rolePermissionsPage.open();

    await rolePermissionsPage.search('zz_no_such_role_qa');
    await rolePermissionsPage.table.expectEmpty();
    await rolePermissionsPage.table.expectTotal(0);

    const cleared = await rolePermissionsPage.search('');
    expect(cleared.data.meta.totalItems).toBe(all.data.meta.totalItems);
  });

  test('allows Delete only for roles no admin user holds', async ({ rolePermissionsPage }) => {
    const roles = (await rolePermissionsPage.open<RoleRow>()).data.items;

    for (const [index, role] of roles.entries()) {
      await rolePermissionsPage.table.expectActionAt(index, 'Delete', role.count === 0);
    }
  });

  test('Delete asks for confirmation, and Cancel keeps the role', async ({ page, rolePermissionsPage }) => {
    const blocked = await blockWrites(page);
    const roles = (await rolePermissionsPage.open<RoleRow>()).data.items;
    const index = roles.findIndex((role) => role.count === 0);
    test.skip(index < 0, 'Every role on the first page is held by an admin user.');

    await rolePermissionsPage.table.clickActionAt(index, 'Delete');
    await rolePermissionsPage.confirmDialog.expectShown();
    await rolePermissionsPage.confirmDialog.cancel();

    expect(blocked).toEqual([]);
    await rolePermissionsPage.table.expectRowsOf((await rolePermissionsPage.search<RoleRow>(roles[index].role)));
  });
});

test.describe('Create Role, not saved', () => {
  test('opens with an empty Role Name', async ({ rolePermissionsPage, roleFormPage }) => {
    await rolePermissionsPage.open();
    await rolePermissionsPage.openCreate();

    await roleFormPage.expectCreateForm();
  });

  test('Cancel returns to the list without saving', async ({ page, rolePermissionsPage, roleFormPage }) => {
    const blocked = await blockWrites(page);
    await rolePermissionsPage.open();
    await rolePermissionsPage.openCreate();
    await roleFormPage.enterName('qa_auto_cancelled_role');

    await roleFormPage.cancel();

    await rolePermissionsPage.expectDisplayed();
    expect(blocked).toEqual([]);
  });

  // Known defect: Save posts an empty Role Name to POST roles with no required-field check and
  // nothing shown on the page. This passes while the defect exists and fails once it's fixed: then
  // remove test.fail. The form is opened before test.fail, so a broken step fails for real.
  test.describe(() => {
    test.beforeEach(async ({ rolePermissionsPage, roleFormPage }) => {
      await rolePermissionsPage.open();
      await rolePermissionsPage.openCreate();
      await roleFormPage.expectCreateForm();
    });

    test('checks Role Name before posting an empty form', async ({ page, roleFormPage }) => {
      test.fail(true, 'Staging posts an empty Create Role form without checking Role Name.');
      const blocked = await blockWrites(page);

      await roleFormPage.clickSave();
      await page.waitForTimeout(1000);

      expect(blocked).toEqual([]);
      await roleFormPage.expectCreateForm();
    });
  });
});

test.describe('An existing role, read only', () => {
  test('Edit shows the role name, and Cancel returns without saving', async ({
    page,
    adminApi,
    rolePermissionsPage,
    roleFormPage,
  }) => {
    const blocked = await blockWrites(page);
    const [role] = (await rolePermissionsPage.open<RoleRow>()).data.items;
    const saved = await getRole(adminApi, role.id);

    await rolePermissionsPage.table.clickActionAt(0, 'Edit');
    await roleFormPage.expectEditForm(role.id, saved.role);

    await roleFormPage.cancel();
    await rolePermissionsPage.expectDisplayed();
    expect(blocked).toEqual([]);
  });

  test('Manage Role Permissions shows every permission, ticked as the role holds them', async ({
    page,
    adminApi,
    rolePermissionsPage,
    permissionsPage,
  }) => {
    const blocked = await blockWrites(page);
    const [role] = (await rolePermissionsPage.open<RoleRow>()).data.items;
    const permissions = await getPermissions(adminApi);
    const held = await getRolePermissionIds(adminApi, role.id);

    await rolePermissionsPage.table.clickActionAt(0, 'Manage Role Permissions');

    await permissionsPage.expectDisplayed('role');
    await permissionsPage.expectGroups(Object.keys(permissions));
    await permissionsPage.expectPermissionIds(Object.values(permissions).flat().map((permission) => permission.id));
    await permissionsPage.expectTicked(held);

    await permissionsPage.cancel();
    await rolePermissionsPage.expectDisplayed();
    expect(blocked).toEqual([]);
  });

  test('a group checkbox ticks its whole group, and the top one ticks everything, without saving', async ({
    page,
    adminApi,
    rolePermissionsPage,
    permissionsPage,
  }) => {
    const blocked = await blockWrites(page);
    const roles = (await rolePermissionsPage.open<RoleRow>()).data.items;
    const permissions = await getPermissions(adminApi);
    const all = Object.values(permissions).flat().map((permission) => permission.id);
    // The role on the first page holding the fewest permissions, so ticking shows a change.
    const held = await Promise.all(roles.map((role) => getRolePermissionIds(adminApi, role.id)));
    const index = held.reduce((best, ids, at) => (ids.length < held[best].length ? at : best), 0);
    test.skip(held[index].length === all.length, 'Every role on the first page holds every permission.');
    const [group, members] = Object.entries(permissions).find(([, list]) => list.some((permission) => !held[index].includes(permission.id)))!;
    const memberIds = members.map((permission) => permission.id);

    await rolePermissionsPage.table.clickActionAt(index, 'Manage Role Permissions');
    await permissionsPage.expectDisplayed('role');
    await permissionsPage.expectTicked(held[index]);

    await permissionsPage.setGroupTicked(group, true);
    await permissionsPage.expectTicked([...held[index], ...memberIds]);
    await permissionsPage.setGroupTicked(group, false);
    await permissionsPage.expectTicked(held[index].filter((id) => !memberIds.includes(id)));
    await permissionsPage.setAllTicked(true);
    await permissionsPage.expectTicked(all);

    await permissionsPage.cancel();
    await rolePermissionsPage.expectDisplayed();
    expect(blocked).toEqual([]);
  });

  test('Feature Configurations shows every notification feature, ticked as the role has them', async ({
    page,
    adminApi,
    rolePermissionsPage,
    featureConfigurationPage,
  }) => {
    const blocked = await blockWrites(page);
    const [role] = (await rolePermissionsPage.open<RoleRow>()).data.items;
    const features = Object.values(await getFeatures(adminApi)).flat();
    const own = await getRoleFeatureValues(adminApi, role.id);

    await rolePermissionsPage.table.clickActionAt(0, 'Feature Configurations');

    await featureConfigurationPage.expectDisplayed(`Role : ${role.role}`);
    await featureConfigurationPage.expectFeatures(features.map((feature) => feature.name));
    for (const feature of features) {
      await featureConfigurationPage.expectTicked(feature.name, own[feature.id] === 1);
    }

    await featureConfigurationPage.cancel();
    await rolePermissionsPage.expectDisplayed();
    expect(blocked).toEqual([]);
  });
});
