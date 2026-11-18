import { expect, test } from '../../../fixtures/admin-fixtures';
import { getSalesUser } from '../../../utils/admin-api';
import { parseIsoDate } from '../../../utils/date-time';
import { blockWrites } from '../../../utils/write-guard';

// Read-only: every test aborts the requests that would change data, so a click on Save or Update
// shows what the page would send without anything reaching the server. The specs that write live
// in specs/admin/write/.

type SalesUserRow = { id: number; full_name: string; email: string };

test.describe('Sales Users list', () => {
  test('opens from the Admin group with the columns, rows and total the API sent', async ({ salesUsersPage }) => {
    const list = await salesUsersPage.open<SalesUserRow>();

    await salesUsersPage.table.expectColumnsOf(list);
    await salesUsersPage.table.expectRowsOf(list);
    await salesUsersPage.table.expectTotal(list.data.meta.totalItems);
    await salesUsersPage.table.expectActions(0, ['Edit']);
  });

  test('pages through the list with the pager', async ({ salesUsersPage }) => {
    const { meta } = (await salesUsersPage.open()).data;
    test.skip(meta.totalPages < 2, 'The list fits on one page.');

    const last = await salesUsersPage.table.goToPage('last');
    expect(last.query.get('page')).toBe(String(meta.totalPages));
    await salesUsersPage.table.expectRowsOf(last);
    await salesUsersPage.table.expectCurrentPage(meta.totalPages);

    const first = await salesUsersPage.table.goToPage('first');
    expect(first.query.get('page')).toBe('1');
    await salesUsersPage.table.expectRowsOf(first);
  });

  // Known defect: on Sales Users the ID sort only reorders the ten rows on screen and asks the
  // server for nothing, so ascending never shows the lowest IDs; Admin Users and Role Permissions
  // sort the whole list on the server. This passes while the defect exists and fails once it's
  // fixed: then remove test.fail. The list is opened before test.fail, so a broken step fails for real.
  test.describe(() => {
    test.beforeEach(async ({ salesUsersPage }) => {
      await salesUsersPage.open();
    });

    test('sorts the whole list by ID on the server, like the other Admin lists', async ({ salesUsersPage }) => {
      test.fail(true, 'Staging sorts Sales Users by ID on the current page only, in the browser.');

      const ascending = await salesUsersPage.table.sortBy<SalesUserRow>('ID', 'asc');
      const ascendingIds = ascending.data.items.map((user) => user.id);
      expect(ascendingIds).toEqual([...ascendingIds].sort((a, b) => a - b));
      await salesUsersPage.table.expectRowsOf(ascending);
    });
  });

  test('searches by email', async ({ salesUsersPage }) => {
    const [user] = (await salesUsersPage.open<SalesUserRow>()).data.items;

    const results = await salesUsersPage.search<SalesUserRow>(user.email);

    expect(results.data.items.map((found) => found.id)).toContain(user.id);
    await salesUsersPage.table.expectRowsOf(results);
  });

  test('shows no rows for an unknown email, and the whole list again when cleared', async ({ salesUsersPage }) => {
    const all = await salesUsersPage.open();

    await salesUsersPage.search('zz_no_such_sales_user_qa@example.com');
    await salesUsersPage.table.expectEmpty();
    await salesUsersPage.table.expectTotal(0);

    const cleared = await salesUsersPage.search('');
    expect(cleared.data.meta.totalItems).toBe(all.data.meta.totalItems);
  });
});

test.describe('Create Sales User, not saved', () => {
  test('opens with no role ticked, Status Active, today as Expires On and +91 as the mobile code', async ({
    salesUsersPage,
    salesUserFormPage,
  }) => {
    await salesUsersPage.open();
    await salesUsersPage.openCreate();

    await salesUserFormPage.expectCreateForm();
    for (const role of ['Sales Head', 'Business Account Manager', 'Technical Account Manager', 'Admin User']) {
      await salesUserFormPage.form.expectTicked(role, false);
    }
    await salesUserFormPage.form.expectChosen('Status', 'Active');
    await salesUserFormPage.form.expectDate(new Date());
    await salesUserFormPage.form.expectMobile('+91', '');
    expect(await salesUserFormPage.form.options('Country')).toContain('India');
  });

  test('Cancel returns to the list without saving', async ({ page, salesUsersPage, salesUserFormPage }) => {
    const blocked = await blockWrites(page);
    await salesUsersPage.open();
    await salesUsersPage.openCreate();
    await salesUserFormPage.enter({ fullName: 'QA Automation', email: 'qa_auto_cancel@example.com' });

    await salesUserFormPage.cancel();

    await salesUsersPage.expectDisplayed();
    expect(blocked).toEqual([]);
  });

  // Known defect: Save posts an empty form to POST sales-users with no required-field check and
  // nothing shown on the page. This passes while the defect exists and fails once it's fixed: then
  // remove test.fail. The form is opened before test.fail, so a broken step fails for real.
  test.describe(() => {
    test.beforeEach(async ({ salesUsersPage, salesUserFormPage }) => {
      await salesUsersPage.open();
      await salesUsersPage.openCreate();
      await salesUserFormPage.expectCreateForm();
    });

    test('checks the required fields before posting an empty form', async ({ page, salesUserFormPage }) => {
      test.fail(true, 'Staging posts an empty Create Sales User form without checking required fields.');
      const blocked = await blockWrites(page);

      await salesUserFormPage.clickSave();
      await page.waitForTimeout(1000);

      expect(blocked).toEqual([]);
      await salesUserFormPage.expectCreateForm();
    });
  });
});

test.describe('An existing sales user, read only', () => {
  test('Edit shows the saved details, with Email read-only', async ({ adminApi, salesUsersPage, salesUserFormPage }) => {
    const [user] = (await salesUsersPage.open<SalesUserRow>()).data.items;
    const saved = await getSalesUser(adminApi, user.id);

    await salesUsersPage.table.clickActionAt(0, 'Edit');

    await salesUserFormPage.expectEditForm(user.id);
    await salesUserFormPage.expectValues({
      fullName: saved.full_name,
      email: saved.email,
      mobile: saved.mobile,
      country: saved.country,
      expiresOn: parseIsoDate(saved.expired_on),
      team: saved.team ?? '',
      salesHead: saved.is_sales_head,
      businessAccountManager: saved.is_business_account_manager,
      technicalAccountManager: saved.is_technical_account_manager,
      status: saved.status === 1 ? 'Active' : 'Inactive',
      adminUser: saved.is_admin_user === 1,
    });
    await salesUserFormPage.form.expectEditable('email', false);
  });

  test('Cancel on Edit returns to the list without saving', async ({ page, salesUsersPage, salesUserFormPage }) => {
    const blocked = await blockWrites(page);
    const [user] = (await salesUsersPage.open<SalesUserRow>()).data.items;
    await salesUsersPage.table.clickActionAt(0, 'Edit');
    await salesUserFormPage.expectEditForm(user.id);

    await salesUserFormPage.cancel();

    await salesUsersPage.expectDisplayed();
    expect(blocked).toEqual([]);
  });
});
