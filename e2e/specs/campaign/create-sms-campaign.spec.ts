import { test } from '../../fixtures/test-fixtures';
import { appConfig } from '../../utils/config';
import { appendLocalTimestamp } from '../../utils/date-time';

test.describe('SMS campaign creation', () => {
  test('creates an SMS campaign with persisted auth state', async ({ page, smsCampaignPage }) => {
    const campaignName = appendLocalTimestamp('Test_Camp');

    await page.goto(appConfig.appUrl, { waitUntil: 'domcontentloaded' });

    await smsCampaignPage.clickOnSmsMenu();
    await smsCampaignPage.clickOnCampaignsSubMenu();
    await smsCampaignPage.acknowledgeDltPopupWindow();
    await smsCampaignPage.clickOnCreateCampaignButton();
    await smsCampaignPage.enterCampaignName(campaignName);
    await smsCampaignPage.selectCampaignCategory('automation');
    await smsCampaignPage.selectCampaignType();
    await smsCampaignPage.clickOnImportContacts();
    await smsCampaignPage.clickOnListTab();
    await smsCampaignPage.searchContactList(appConfig.smsListName);
    await smsCampaignPage.clickOnGoButton();
    await smsCampaignPage.selectContactList(appConfig.smsListName);
    await smsCampaignPage.clickOnImportButton();
    await smsCampaignPage.clickOnChooseTemplate();
    await smsCampaignPage.searchTemplate(appConfig.smsTemplateName);
    await smsCampaignPage.selectTemplate(appConfig.smsTemplateName);
    await smsCampaignPage.clickOnSaveButton();
    await smsCampaignPage.clickOnSendButton();
    await smsCampaignPage.clickOnSendNowButton();
  });
});
