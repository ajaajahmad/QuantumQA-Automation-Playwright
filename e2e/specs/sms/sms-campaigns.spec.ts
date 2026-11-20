import { test } from '../../fixtures/test-fixtures';

// Nothing here sends a campaign. Opening the create form does save a draft on staging, as it
// does in the campaign creation spec.

test.describe('SMS Campaigns list', () => {
  test('lists the campaigns the API returned', async ({ smsCampaignsPage }) => {
    const campaigns = await smsCampaignsPage.open();

    await smsCampaignsPage.listing.expectColumns([
      'Name',
      'Category',
      'Creation Time',
      'Submission Time',
      'Created By',
      'Action',
    ]);
    await smsCampaignsPage.listing.expectTotalRecords(campaigns.total);
    await smsCampaignsPage.listing.expectRowCount(Math.min(campaigns.total, 10));
  });

  test('finds a campaign by name', async ({ smsCampaignsPage }) => {
    const [campaign] = (await smsCampaignsPage.open()).docs;
    test.skip(!campaign, 'The account has no campaigns.');

    await smsCampaignsPage.listing.search(campaign.name);

    await smsCampaignsPage.listing.expectEveryRowToContain(campaign.name);
  });

  test('shows no records for an unknown name', async ({ smsCampaignsPage }) => {
    await smsCampaignsPage.open();

    await smsCampaignsPage.listing.search('zz_no_such_campaign_qa');

    await smsCampaignsPage.listing.expectNoRecords();
  });

  test('reloads the list when the page size changes', async ({ smsCampaignsPage }) => {
    const campaigns = await smsCampaignsPage.open();

    await smsCampaignsPage.listing.setPageSize(25);

    await smsCampaignsPage.listing.expectRowCount(Math.min(campaigns.total, 25));
  });
});

test.describe('Create SMS Campaign form', () => {
  test.beforeEach(async ({ smsCampaignsPage, createSmsCampaignPage }) => {
    await smsCampaignsPage.open();
    await smsCampaignsPage.clickOnCreateCampaignButton();
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
