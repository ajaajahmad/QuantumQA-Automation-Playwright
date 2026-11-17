import { test } from '../../../fixtures/admin-fixtures';
import { userOnboardingLists } from '../../../pages/admin/onboarding/admin-list.page';

// Read-only: each test opens a page from the side nav and reads its list. Nothing is created,
// edited or approved, because admin changes reach every account on staging.

test.describe('User Onboarding', () => {
  test.beforeEach(async ({ organizationsPage }) => {
    await organizationsPage.open();
  });

  for (const list of userOnboardingLists) {
    test(`${list.entry} opens from the side nav with the rows the API returned`, async ({ adminListPage }) => {
      const response = await adminListPage.openFromSideNav(list);

      await adminListPage.expectColumns(list);
      await adminListPage.expectRowsOf(response);
    });
  }
});
