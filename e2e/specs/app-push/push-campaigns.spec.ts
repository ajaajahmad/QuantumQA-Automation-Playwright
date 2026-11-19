import { expect, test } from '../../fixtures/test-fixtures';

// Read-only: the list of sent and scheduled App Push campaigns. The rows are whatever the account
// has sent, mostly the send spec's campaigns, so the table is compared with the response.

test.describe('App Push Campaigns', () => {
  test('opens from the side nav', async ({ page, sideNav }) => {
    await page.goto('/dashboard/home', { waitUntil: 'domcontentloaded' });

    await sideNav.open('APP Push', 'Campaigns');

    await expect(page).toHaveURL(/\/campaigns\/app-push$/);
  });

  test('lists the campaigns the API returned', async ({ pushCampaignsPage }) => {
    const list = await pushCampaignsPage.open();

    await pushCampaignsPage.expectColumns(['Name', 'Creation Time', 'Submission Time', 'Created By', 'Action']);
    await pushCampaignsPage.expectRowsOf(list);
  });

  test('offers the Creation Time and Created By filters', async ({ pushCampaignsPage }) => {
    await pushCampaignsPage.open();

    await pushCampaignsPage.expectFilters(['Creation Time', 'Created By']);
  });

  // A sent campaign can only be viewed; stop, pause, rescheduling and delete are for campaigns
  // that have not gone out.
  test('offers only View on a sent campaign', async ({ pushCampaignsPage }) => {
    const list = await pushCampaignsPage.open();
    const sent = list.docs.find((campaign) => campaign.sent_at && !campaign.is_delete);
    test.skip(!sent, 'No sent App Push campaign on the first page.');

    expect(await pushCampaignsPage.enabledActions(sent!.name)).toEqual(['View']);
  });

  test('shows a sent campaign in the summary dialog', async ({ pushCampaignsPage }) => {
    const list = await pushCampaignsPage.open();
    const sent = list.docs.find((campaign) => campaign.sent_at);
    test.skip(!sent, 'No sent App Push campaign on the first page.');

    await pushCampaignsPage.openSummary(sent!.name);

    await pushCampaignsPage.summary.expectSummary({
      'Campaign Name': sent!.name,
      'Campaign Category': sent!.category_name,
      'Uploaded Contacts': String(sent!.count),
    });
    await pushCampaignsPage.summary.close();
  });
});
