import { expect, test } from '../../../fixtures/admin-fixtures';

// Read-only: these tests open, read and search. They never click Create Organization or Edit,
// because admin changes reach every account on staging.

test.describe('Organizations', () => {
  test('opens as the admin home page', async ({ adminLoginPage, organizationsPage }) => {
    // With a live session the login route sends the admin straight to Organizations.
    await adminLoginPage.open();

    await organizationsPage.expectDisplayed();
  });

  test('lists the organizations the API returned, with the total', async ({ organizationsPage }) => {
    const list = await organizationsPage.open();

    await organizationsPage.expectListShown(list);
  });

  test('searches by company name on Enter', async ({ organizationsPage }) => {
    const list = await organizationsPage.open();
    const term = list.items.find((organization) => organization.company_name?.trim())?.company_name;
    expect(term, 'the first page should have an organization with a company name').toBeTruthy();

    const results = await organizationsPage.search(term!);

    await organizationsPage.expectListShown(results);
    await organizationsPage.expectEveryRowContains(term!);
  });
});
