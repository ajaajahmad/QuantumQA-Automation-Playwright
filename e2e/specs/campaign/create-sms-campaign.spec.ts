import { test } from '../../fixtures/test-fixtures';
import { appConfig } from '../../utils/config';
import { appendLocalTimestamp } from '../../utils/date-time';

test.describe('SMS campaign creation', () => {
  // Each run sends a real campaign, so a retry would send a duplicate.
  test.describe.configure({ retries: 0 });

  test('creates an SMS campaign with persisted auth state', async ({
    page,
    sideNav,
    campaignListPage,
    createSmsCampaignPage,
  }) => {
    await page.goto(appConfig.appUrl, { waitUntil: 'domcontentloaded' });

    await sideNav.openSmsCampaigns();
    await campaignListPage.acknowledgeDltPopupWindow();
    await campaignListPage.clickOnCreateCampaignButton();

    await createSmsCampaignPage.createAndSend({
      name: appendLocalTimestamp('Test_Camp'),
      category: 'automation',
      listName: appConfig.smsListName,
      templateName: appConfig.smsTemplateName,
    });
  });
});
