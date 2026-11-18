import { expect, test } from '../../../fixtures/admin-fixtures';
import {
  getAdminUserProfile,
  getFeatures,
  getPermissions,
  getRoleOptions,
  getUserFeatureValues,
  getUserPermissionIds,
} from '../../../utils/admin-api';
import { parseIsoDate } from '../../../utils/date-time';
import { blockWrites } from '../../../utils/write-guard';

// Read-only: every test aborts the requests that would change data, so a click on Save, Update or
// Submit shows what the page would send without anything reaching the server. Admin changes reach
// every account on staging; the specs that write live in specs/admin/write/.

type AdminUserRow = {
  id: number;
  username: string;
  full_name: string;
  country: string;
  role: string;
  status: string;
  expired_on: string;
};

test.describe('Admin Users list', () => {
  test('opens from the Admin group with the columns, rows and total the API sent', async ({ adminUsersPage }) => {
    const list = await adminUsersPage.open<AdminUserRow>();

    await adminUsersPage.table.expectColumnsOf(list);
    await adminUsersPage.table.expectRowsOf(list);
    await adminUsersPage.table.expectTotal(list.data.meta.totalItems);
    await adminUsersPage.table.expectCurrentPage(1);
    await adminUsersPage.table.expectActions(0, ['Edit', 'Manage Role Permissions', 'Feature Configurations']);
  });

  test('pages through the list with the pager', async ({ adminUsersPage }) => {
    const { meta } = (await adminUsersPage.open()).data;
    test.skip(meta.totalPages < 2, 'The list fits on one page.');

    const next = await adminUsersPage.table.goToPage('next');
    expect(next.query.get('page')).toBe('2');
    await adminUsersPage.table.expectRowsOf(next);
    await adminUsersPage.table.expectCurrentPage(2);

    const last = await adminUsersPage.table.goToPage('last');
    expect(last.query.get('page')).toBe(String(meta.totalPages));
    await adminUsersPage.table.expectRowsOf(last);

    const first = await adminUsersPage.table.goToPage('first');
    expect(first.query.get('page')).toBe('1');
    await adminUsersPage.table.expectCurrentPage(1);
  });

  test('sorts by ID ascending, then descending', async ({ adminUsersPage }) => {
    await adminUsersPage.open();

    const ascending = await adminUsersPage.table.sortBy<AdminUserRow>('ID', 'asc');
    const ascendingIds = ascending.data.items.map((user) => user.id);
    expect(ascendingIds).toEqual([...ascendingIds].sort((a, b) => a - b));
    await adminUsersPage.table.expectSorted('ID', 'asc');
    await adminUsersPage.table.expectRowsOf(ascending);

    const descending = await adminUsersPage.table.sortBy<AdminUserRow>('ID', 'desc');
    const descendingIds = descending.data.items.map((user) => user.id);
    expect(descendingIds).toEqual([...descendingIds].sort((a, b) => b - a));
    await adminUsersPage.table.expectSorted('ID', 'desc');
    await adminUsersPage.table.expectRowsOf(descending);
  });

  test('searches by username', async ({ adminUsersPage }) => {
    const [user] = (await adminUsersPage.open<AdminUserRow>()).data.items;

    const results = await adminUsersPage.search<AdminUserRow>(user.username);

    expect(results.data.items.map((found) => found.id)).toContain(user.id);
    await adminUsersPage.table.expectRowsOf(results);
  });

  test('searches by country', async ({ adminUsersPage }) => {
    const country = (await adminUsersPage.open<AdminUserRow>()).data.items.find((user) => user.country)?.country;
    test.skip(!country, 'No admin user on the first page has a country.');

    const results = await adminUsersPage.search<AdminUserRow>(country!);

    expect(results.data.items.length).toBeGreaterThan(0);
    for (const found of results.data.items) {
      expect(`${found.username} ${found.country}`.toLowerCase()).toContain(country!.toLowerCase());
    }
    await adminUsersPage.table.expectRowsOf(results);
  });

  test('shows no rows for an unknown term, and the whole list again when cleared', async ({ adminUsersPage }) => {
    const all = await adminUsersPage.open();

    await adminUsersPage.search('zz_no_such_admin_qa');
    await adminUsersPage.table.expectEmpty();
    await adminUsersPage.table.expectTotal(0);

    const cleared = await adminUsersPage.search('');
    expect(cleared.data.meta.totalItems).toBe(all.data.meta.totalItems);
    await adminUsersPage.table.expectRowsOf(cleared);
  });
});

test.describe('Admin Users filters', () => {
  test('offers Role, Status and Expired At', async ({ adminUsersPage }) => {
    await adminUsersPage.open();

    await adminUsersPage.filters.expectFilters(['Role', 'Status', 'Expired At']);
  });

  test('Role lists every role an admin user can hold', async ({ adminApi, adminUsersPage }) => {
    await adminUsersPage.open();

    const options = await adminUsersPage.filters.options('Role');

    expect(options).toEqual((await getRoleOptions(adminApi)).map((role) => role.label));
  });

  test('Role search narrows the options to the matching roles', async ({ adminApi, adminUsersPage }) => {
    await adminUsersPage.open();
    const term = (await getRoleOptions(adminApi))[0].label.slice(0, 4);

    const shown = await adminUsersPage.filters.searchOptions('Role', term);

    expect(shown.length).toBeGreaterThan(0);
    for (const option of shown) {
      expect(option.toLowerCase()).toContain(term.toLowerCase());
    }
  });

  test('Role narrows the list to the users holding it', async ({ adminApi, adminUsersPage }) => {
    const [user] = (await adminUsersPage.open<AdminUserRow>()).data.items;
    const role = (await getRoleOptions(adminApi)).find((option) => option.label === user.role);
    expect(role, `the Role filter should offer ${user.role}`).toBeTruthy();

    const filtered = await adminUsersPage.filters.apply<AdminUserRow>('Role', [role!.label]);

    expect(filtered.query.get('role')).toBe(String(role!.key));
    expect(filtered.data.items.map((found) => found.role)).toEqual(filtered.data.items.map(() => role!.label));
    await adminUsersPage.table.expectRowsOf(filtered);
  });

  for (const status of ['Active', 'InActive']) {
    test(`Status ${status} narrows the list to ${status.toLowerCase()} users`, async ({ adminUsersPage }) => {
      await adminUsersPage.open();
      expect(await adminUsersPage.filters.options('Status')).toEqual(['Active', 'InActive']);

      const filtered = await adminUsersPage.filters.apply<AdminUserRow>('Status', [status]);

      expect(filtered.query.get('status')).toBe(status === 'Active' ? '1' : '0');
      for (const found of filtered.data.items) {
        expect(found.status.toLowerCase()).toBe(status.toLowerCase());
      }
      await adminUsersPage.table.expectRowsOf(filtered);
    });
  }

  test('Expired At narrows the list to a date', async ({ adminUsersPage }) => {
    const users = (await adminUsersPage.open<AdminUserRow>()).data.items;
    const expiry = users.find((user) => /^\d{4}-\d{2}-\d{2}/.test(user.expired_on))?.expired_on.slice(0, 10);
    test.skip(!expiry, 'No admin user on the first page has an expiry date.');

    const filtered = await adminUsersPage.filters.applyExpiry<AdminUserRow>(parseIsoDate(expiry!));

    expect(filtered.query.get('expired_on')).toBe(expiry);
    expect(filtered.data.items.length).toBeGreaterThan(0);
    await adminUsersPage.table.expectRowsOf(filtered);
  });

  test('More Filter lists the three filters, each shown and locked on', async ({ adminUsersPage }) => {
    await adminUsersPage.open();

    expect(await adminUsersPage.filters.moreFilterOptions()).toEqual(
      ['Role', 'Status', 'Expired At'].map((filter) => ({ filter, shown: true, locked: true })),
    );
  });

  test('Close shuts a filter without loading the list again', async ({ page, adminUsersPage }) => {
    await adminUsersPage.open();
    await adminUsersPage.filters.options('Status');
    let reloads = 0;
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.endsWith('/api/v1/auth/users')) reloads += 1;
    });

    await adminUsersPage.filters.close('Status');

    expect(reloads).toBe(0);
  });
});

test.describe('Create Admin User, not saved', () => {
  test('opens with Status Active, today as Expires On and +91 as the mobile code', async ({ adminUsersPage, adminUserFormPage }) => {
    await adminUsersPage.open();
    await adminUsersPage.openCreate();

    await adminUserFormPage.expectCreateForm();
    await adminUserFormPage.form.expectChosen('Status', 'Active');
    await adminUserFormPage.form.expectDate(new Date());
    await adminUserFormPage.form.expectMobile('+91', '');
    await adminUserFormPage.form.expectEditable('email', false);
  });

  test('offers every role in Role and India in Countries', async ({ adminApi, adminUsersPage, adminUserFormPage }) => {
    await adminUsersPage.open();
    await adminUsersPage.openCreate();

    expect(await adminUserFormPage.form.options('Role')).toEqual((await getRoleOptions(adminApi)).map((role) => role.label));
    expect(await adminUserFormPage.form.options('Countries')).toContain('India');
  });

  // Email is read-only on create (the schema marks it so) and stays blank while User Name is typed.
  test('sends User Name as the Email on Save', async ({ page, adminUsersPage, adminUserFormPage }) => {
    const blocked = await blockWrites(page);
    await adminUsersPage.open();
    await adminUsersPage.openCreate();
    await adminUserFormPage.enter({ fullName: 'QA Automation', username: 'qa_auto_copy@example.com' });

    await adminUserFormPage.clickSave();

    await expect.poll(() => blocked.length).toBe(1);
    expect(blocked[0]).toMatchObject({
      method: 'POST',
      body: { username: 'qa_auto_copy@example.com', email: 'qa_auto_copy@example.com' },
    });
  });

  test('Cancel returns to the list without saving', async ({ page, adminUsersPage, adminUserFormPage }) => {
    const blocked = await blockWrites(page);
    await adminUsersPage.open();
    await adminUsersPage.openCreate();
    await adminUserFormPage.enter({ fullName: 'QA Automation', username: 'qa_auto_cancel@example.com' });

    await adminUserFormPage.cancel();

    await adminUsersPage.expectDisplayed();
    expect(blocked).toEqual([]);
  });

  // Known defect: Save posts an empty form to POST auth/register with no required-field check and
  // nothing shown on the page. This passes while the defect exists and fails once it's fixed: then
  // remove test.fail. The form is opened before test.fail, so a broken step fails for real.
  test.describe(() => {
    test.beforeEach(async ({ adminUsersPage, adminUserFormPage }) => {
      await adminUsersPage.open();
      await adminUsersPage.openCreate();
      await adminUserFormPage.expectCreateForm();
    });

    test('checks the required fields before posting an empty form', async ({ page, adminUserFormPage }) => {
      test.fail(true, 'Staging posts an empty Create Admin User form without checking required fields.');
      const blocked = await blockWrites(page);

      await adminUserFormPage.clickSave();
      await page.waitForTimeout(1000);

      expect(blocked).toEqual([]);
      await adminUserFormPage.expectCreateForm();
    });
  });
});

test.describe('An existing admin user, read only', () => {
  test('Edit shows the saved details, with Username and Email read-only', async ({ adminApi, adminUsersPage, adminUserFormPage }) => {
    const [user] = (await adminUsersPage.open<AdminUserRow>()).data.items;
    const profile = await getAdminUserProfile(adminApi, user.id);
    const role = (await getRoleOptions(adminApi)).find((option) => option.key === profile.user_type);

    await adminUsersPage.table.clickActionAt(0, 'Edit');

    await adminUserFormPage.expectEditForm(user.id);
    await adminUserFormPage.expectValues({
      fullName: profile.full_name,
      username: profile.username,
      mobile: profile.mobile,
      countries: profile.countries ?? [],
      state: profile.state ?? '',
      city: profile.city ?? '',
      zipcode: profile.zipcode ?? '',
      address: profile.address ?? '',
      role: role?.label ?? '',
      expiresOn: parseIsoDate(profile.expired_on),
      status: profile.status === 1 ? 'Active' : 'Inactive',
    });
    await adminUserFormPage.form.expectEditable('username', false);
    await adminUserFormPage.form.expectEditable('email', false);
  });

  test('Cancel on Edit returns to the list without saving', async ({ page, adminUsersPage, adminUserFormPage }) => {
    const blocked = await blockWrites(page);
    const [user] = (await adminUsersPage.open<AdminUserRow>()).data.items;
    await adminUsersPage.table.clickActionAt(0, 'Edit');
    await adminUserFormPage.expectEditForm(user.id);

    await adminUserFormPage.cancel();

    await adminUsersPage.expectDisplayed();
    expect(blocked).toEqual([]);
  });

  test('Manage Role Permissions shows every permission, ticked as the user holds them', async ({
    page,
    adminApi,
    adminUsersPage,
    permissionsPage,
  }) => {
    const blocked = await blockWrites(page);
    const [user] = (await adminUsersPage.open<AdminUserRow>()).data.items;
    const permissions = await getPermissions(adminApi);
    const held = await getUserPermissionIds(adminApi, user.id);

    await adminUsersPage.table.clickActionAt(0, 'Manage Role Permissions');

    await permissionsPage.expectDisplayed('user');
    await permissionsPage.expectGroups(Object.keys(permissions));
    await permissionsPage.expectPermissionIds(Object.values(permissions).flat().map((permission) => permission.id));
    await permissionsPage.expectTicked(held);

    await permissionsPage.cancel();
    await adminUsersPage.expectDisplayed();
    expect(blocked).toEqual([]);
  });

  test('Feature Configurations shows every notification feature, ticked as the user has them', async ({
    page,
    adminApi,
    adminUsersPage,
    featureConfigurationPage,
  }) => {
    const blocked = await blockWrites(page);
    const [user] = (await adminUsersPage.open<AdminUserRow>()).data.items;
    const features = Object.values(await getFeatures(adminApi)).flat();
    const own = await getUserFeatureValues(adminApi, user.id);

    await adminUsersPage.table.clickActionAt(0, 'Feature Configurations');

    // The line is labelled Username but shows the full name.
    await featureConfigurationPage.expectDisplayed(`Username : ${user.full_name}`);
    await featureConfigurationPage.expectFeatures(features.map((feature) => feature.name));
    for (const feature of features) {
      await featureConfigurationPage.expectTicked(feature.name, own[feature.id] === 1);
    }

    await featureConfigurationPage.cancel();
    await adminUsersPage.expectDisplayed();
    expect(blocked).toEqual([]);
  });
});
