import { test } from '../../../fixtures/admin-fixtures';
import { userOnboardingLists } from '../../../pages/admin/onboarding/onboarding-list.page';

// Read-only: each test opens a page from the side nav and reads its list. Nothing is created,
// edited or approved, because admin changes reach every account on staging.

test.describe('User Onboarding', () => {
  test.beforeEach(async ({ organizationsPage }) => {
    await organizationsPage.open();
  });

  for (const list of userOnboardingLists) {
    test(`${list.entry} opens from the side nav with the rows the API returned`, async ({ onboardingListPage }) => {
      const response = await onboardingListPage.openFromSideNav(list);

      await onboardingListPage.expectColumns(list);
      await onboardingListPage.expectRowsOf(response);
    });
  }
});
