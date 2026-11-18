import { expect, test } from '../../../fixtures/admin-fixtures';
import type { SalesUserDetails } from '../../../pages/admin/admin-group/sales-user-form.page';
import { getAdminList, type AdminListBody } from '../../../utils/admin-api';
import { appConfig } from '../../../utils/config';
import { monthsAhead } from '../../../utils/date-time';
import { randomDigits, uniqueSuffix } from '../../../utils/random';

// Writes, opt-in only (npm run test:admin-write). Each run creates one permanent sales user,
// qa_auto_<stamp>@<official_email_domain>, Inactive and expiring next month, then edits only that
// user. Sales users can't be deleted. The server takes only official-domain emails, so the domain
// comes from config/qa.properties (gitignored) and the specs skip without it. The form needs at
// least one of its three roles; the specs tick Technical Account Manager, the one the Create User
// specs never pick, and never tick Admin User.

test.describe.configure({ mode: 'serial' });

const stamp = uniqueSuffix().toLowerCase();

const user: SalesUserDetails = {
  fullName: 'QA Automation Sales',
  email: `qa_auto_${stamp}@${appConfig.officialEmailDomain}`,
  mobile: `9${randomDigits(9)}`,
  country: 'India',
  expiresOn: monthsAhead(1),
  team: 'QA Automation',
  salesHead: false,
  businessAccountManager: false,
  technicalAccountManager: true,
  status: 'Inactive',
  adminUser: false,
};

const edited = { fullName: 'QA Automation Sales Edited', team: 'QA Automation Edited' };

type SalesUserRow = {
  id: number;
  email: string;
  is_sales_head: string;
  is_business_account_manager: string;
  is_technical_account_manager: string;
};

async function findUser(api: Parameters<typeof getAdminList>[0]): Promise<AdminListBody<SalesUserRow>> {
  return getAdminList<SalesUserRow>(api, 'sales-users', { queryterm: user.email });
}

test.describe('Sales Users, writing', () => {
  test.skip(!appConfig.officialEmailDomain, 'Set official_email_domain in config/qa.properties; sales users need an official email.');

  test('creates an inactive sales user the list and edit page show', async ({ salesUsersPage, salesUserFormPage }) => {
    await salesUsersPage.open();
    await salesUsersPage.openCreate();
    await salesUserFormPage.enter(user);

    const created = await salesUserFormPage.save();

    expect(created, `server answered: ${created.message}`).toMatchObject({ success: true });
    console.log('DIALOG create:', await salesUserFormPage.messageDialog.closeIfShown());
    await salesUsersPage.open();
    const results = await salesUsersPage.search<SalesUserRow>(user.email);
    expect(results.data.items).toEqual([
      expect.objectContaining({
        email: user.email,
        is_sales_head: 'No',
        is_business_account_manager: 'No',
        is_technical_account_manager: 'Yes',
      }),
    ]);
    await salesUsersPage.table.expectRowsOf(results);

    await salesUsersPage.table.clickRowAction(user.email, 'Edit');
    await salesUserFormPage.expectEditForm(results.data.items[0].id);
    await salesUserFormPage.expectValues(user);
  });

  test('refuses the same email again', async ({ adminApi, salesUsersPage, salesUserFormPage }) => {
    await salesUsersPage.open();
    await salesUsersPage.openCreate();
    await salesUserFormPage.enter({ ...user, mobile: `9${randomDigits(9)}` });

    const duplicate = await salesUserFormPage.save();

    expect(duplicate.success, `server answered: ${duplicate.message}`).toBe(false);
    console.log('DIALOG duplicate:', await salesUserFormPage.messageDialog.closeIfShown(), '| server:', duplicate.message);
    expect((await findUser(adminApi)).data.items.filter((row) => row.email === user.email)).toHaveLength(1);
  });

  test('updates the sales user details', async ({ adminApi, salesUsersPage, salesUserFormPage }) => {
    const [{ id }] = (await findUser(adminApi)).data.items;
    await salesUsersPage.open();
    await salesUsersPage.search(user.email);
    await salesUsersPage.table.clickRowAction(user.email, 'Edit');
    await salesUserFormPage.expectEditForm(id);
    await salesUserFormPage.enter(edited);

    const updated = await salesUserFormPage.update();

    expect(updated, `server answered: ${updated.message}`).toMatchObject({ success: true });
    console.log('DIALOG update:', await salesUserFormPage.messageDialog.closeIfShown());
    await salesUsersPage.open();
    await salesUsersPage.search(user.email);
    await salesUsersPage.table.clickRowAction(user.email, 'Edit');
    await salesUserFormPage.expectValues({ ...user, ...edited });
  });
});
