import { test } from '../../fixtures/test-fixtures';

// Nothing here sends a campaign. Opening the create form does save a draft on staging, as it
// does in the campaign creation spec.

test.describe('SMS Campaigns list', () => {
  test('lists the campaigns the API returned', async ({ campaignListPage }) => {
    const campaigns = await campaignListPage.open();

    await campaignListPage.listing.expectColumns([
      'Name',
      'Category',
      'Creation Time',
      'Submission Time',
      'Created By',
      'Action',
    ]);
    await campaignListPage.listing.expectTotalRecords(campaigns.total);
    await campaignListPage.listing.expectRowCount(Math.min(campaigns.total, 10));
  });

  test('finds a campaign by name', async ({ campaignListPage }) => {
    const [campaign] = (await campaignListPage.open()).docs;
    test.skip(!campaign, 'The account has no campaigns.');

    await campaignListPage.listing.search(campaign.name);

    await campaignListPage.listing.expectEveryRowToContain(campaign.name);
  });

  test('shows no records for an unknown name', async ({ campaignListPage }) => {
    await campaignListPage.open();

    await campaignListPage.listing.search('zz_no_such_campaign_qa');

    await campaignListPage.listing.expectNoRecords();
  });

  test('reloads the list when the page size changes', async ({ campaignListPage }) => {
    const campaigns = await campaignListPage.open();

    await campaignListPage.listing.setPageSize(25);

    await campaignListPage.listing.expectRowCount(Math.min(campaigns.total, 25));
  });
});

test.describe('Create SMS Campaign form', () => {
  test.beforeEach(async ({ campaignListPage, createSmsCampaignPage }) => {
    await campaignListPage.open();
    await campaignListPage.clickOnCreateCampaignButton();
    await createSmsCampaignPage.expectDisplayed();
  });

  test('suggests a dated campaign name', async ({ createSmsCampaignPage }) => {
    await createSmsCampaignPage.campaignDetails.expectSuggestedCampaignName('SMS');
  });

  test('enables Import Contacts only after a campaign type is chosen', async ({ createSmsCampaignPage }) => {
    await createSmsCampaignPage.expectImportContactsEnabled(false);

    await createSmsCampaignPage.selectCommonType();

    await createSmsCampaignPage.expectImportContactsEnabled(true);
  });

  test('refuses to send an incomplete campaign', async ({ createSmsCampaignPage }) => {
    await createSmsCampaignPage.clickSendExpectingValidation();

    await createSmsCampaignPage.expectRequiredFieldErrors();
    await createSmsCampaignPage.expectDisplayed();
  });
});
