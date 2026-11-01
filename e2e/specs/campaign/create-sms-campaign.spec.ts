import { test } from '../../fixtures/test-fixtures';
import { appConfig, saveConfigValue } from '../../utils/config';
import { appendLocalTimestamp } from '../../utils/date-time';

test.describe('SMS campaign creation', () => {
  // Each run creates a campaign on staging (SMS delivery is faked there), so a retry would create a duplicate.
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

    const categoryCreated = await createSmsCampaignPage.fillCampaignDetails({
      name: appendLocalTimestamp('Test_Camp'),
      category: appConfig.campaignCategory,
      senderId: appConfig.smsSenderId || undefined,
    });

    if (categoryCreated) {
      test.info().annotations.push({ type: 'campaign category', description: `Created ${appConfig.campaignCategory}` });
    }

    // Saved before the remaining steps, so a later failure can't lose a category that now exists.
    saveConfigValue('campaign_category', appConfig.campaignCategory);

    await createSmsCampaignPage.addContactsAndSend({
      listName: appConfig.smsListName,
      templateName: appConfig.smsTemplateName,
    });
  });
});
