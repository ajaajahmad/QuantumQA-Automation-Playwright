import { expect, test } from '../../fixtures/test-fixtures';
import { bothDevices, pushApps, pushCampaigns, pushReport, writeRecipientsFile } from '../../utils/app-push';
import { appConfig } from '../../utils/config';
import { daysAgo } from '../../utils/date-time';

// Pushes for real, so it runs only with APP_PUSH_SEND=1 (npm run test:app-push-send). Each run
// test-sends to app_push_device_token once, sends one campaign to it as an Android and an iOS
// contact, and schedules one for tomorrow, which it deletes again. The token is a testing token
// (confirmed as one on 2026-11-19); staging charges the sends to the account's INR balance.
// Retries are off so a retry can't push twice, and the tests share the campaign, so they run in
// order.
test.describe.configure({ mode: 'serial', retries: 0 });
test.use({ serviceWorkers: 'block' });

const token = appConfig.appPushDeviceToken;
const recipients = bothDevices(token);
const stamp = Date.now();
const sent = { name: `qa_auto_push_${stamp}`, title: 'QA App Push send', body: 'Hello ' };
const scheduled = { name: `qa_auto_push_scheduled_${stamp}`, title: 'QA App Push scheduled' };
let app: string;

test.beforeAll(() => {
  test.skip(process.env.APP_PUSH_SEND !== '1', 'Pushes for real; run with APP_PUSH_SEND=1.');
  test.skip(!token, 'Set app_push_device_token in config/qa.properties.');
});

test.beforeEach(async ({ api }) => {
  const apps = await pushApps(api);
  test.skip(apps.length === 0, 'The account has no active App Push integration.');
  app = apps[0].app_name;
});

test.describe('App Push send', () => {
  test('test-sends, then sends a personalised campaign to an Android and an iOS device', async ({
    pushCampaignsPage,
    createPushCampaignPage,
  }) => {
    await pushCampaignsPage.open();
    await pushCampaignsPage.createCampaign();
    await createPushCampaignPage.enterName(sent.name);
    await createPushCampaignPage.chooseCategory(appConfig.campaignCategory);
    await createPushCampaignPage.chooseApp(app);
    expect(await createPushCampaignPage.importContacts(writeRecipientsFile(recipients))).toBe(2);
    await createPushCampaignPage.enterContent({ title: sent.title, body: sent.body });
    await createPushCampaignPage.personalise('Name');

    await test.step('Test Now pushes to the token as an Android device', async () => {
      await createPushCampaignPage.enterTestTokens([token]);
      const result = await createPushCampaignPage.testNow();

      expect(result.success, result.message).toBe(true);
      expect(result.message).toMatch(/^Test campaign submitted successfully for 1 numbers at \d{1,2}:\d{2} [AP]M\.$/);
    });

    await test.step('Send Now submits the campaign', async () => {
      const validation = await createPushCampaignPage.send();
      expect(validation).toMatchObject({ totalCount: 2, validCount: 2 });
      await createPushCampaignPage.summary.expectSummary({ 'Campaign Name': sent.name, 'Valid Contacts': '2' });

      const result = await createPushCampaignPage.summary.confirm('Send Now');

      expect(result).toEqual({ success: true, message: 'Campaign has been successfully submitted', status: 'in_progress' });
      await createPushCampaignPage.expectNotice('Campaign has been successfully submitted');
    });
  });

  test('lists the sent campaign with only View enabled', async ({ pushCampaignsPage }) => {
    const list = await pushCampaignsPage.open();
    const campaign = list.docs.find((doc) => doc.name === sent.name);
    expect(campaign, `${sent.name} in the list`).toBeDefined();
    expect(campaign!.sent_at).toBeTruthy();

    expect(await pushCampaignsPage.enabledActions(sent.name)).toEqual(['View']);
    await pushCampaignsPage.openSummary(sent.name);
    await pushCampaignsPage.summary.expectSummary({
      'Campaign Name': sent.name,
      'Campaign Category': appConfig.campaignCategory,
      'App Name': app,
      Title: sent.title,
      'Uploaded Contacts': '2',
      'Valid Contacts': '2',
    });
    // The body is shown personalised for the first contact.
    await pushCampaignsPage.summary.expectMessage(`${sent.body}${recipients[0].name}`);
  });

  // The report counts each message once the delivery side has processed it, which took about
  // two minutes on staging (2026-11-19). The test send is counted under the campaign too: two
  // Android messages (one test, one contact) and one iOS.
  test('reports the campaign by campaign and by device type', async ({ api, appPushSummaryPage }) => {
    test.setTimeout(12 * 60_000);

    await expect
      .poll(async () => (await pushReport(api, 'campaign', daysAgo(1), daysAgo(0), { campaign_name: sent.name })).length, {
        message: `${sent.name} in the App Push report`,
        timeout: 10 * 60_000,
        intervals: [15_000],
      })
      .toBe(1);

    const [row] = await pushReport(api, 'campaign', daysAgo(1), daysAgo(0), { campaign_name: sent.name });
    expect(row.count_total).toBe(3);
    expect(row.created_by).toBeTruthy();
    test.info().annotations.push({
      type: 'observed',
      description: `Sent ${row.count_sent}, delivered ${row.count_delivered}, failed ${row.count_failed}, awaiting ${row.count_awaiting}, rejected ${row.count_rejected}, currency ${row.currency_used}.`,
    });

    const byDevice = await pushReport(api, 'device_type', daysAgo(1), daysAgo(0), { campaign_name: sent.name });
    expect(Object.fromEntries(byDevice.map((doc) => [doc.device_type, doc.count_total]))).toEqual({ android: 2, ios: 1 });

    await appPushSummaryPage.open();
    const filtered = await appPushSummaryPage.filterBar.filterBy('Campaign Name', sent.name);

    expect(filtered.docs.map((doc) => doc.campaign_name)).toEqual([sent.name]);
    await appPushSummaryPage.table.expectRowsOf(filtered);
    await appPushSummaryPage.table.expectTotalsOf(filtered);
  });

  test('schedules a campaign for tomorrow, then deletes it before it goes out', async ({
    api,
    pushCampaignsPage,
    createPushCampaignPage,
  }) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await pushCampaignsPage.open();
    await pushCampaignsPage.createCampaign();
    await createPushCampaignPage.enterName(scheduled.name);
    await createPushCampaignPage.chooseCategory(appConfig.campaignCategory);
    await createPushCampaignPage.chooseApp(app);
    await createPushCampaignPage.importContacts(writeRecipientsFile(recipients));
    await createPushCampaignPage.enterContent({ title: scheduled.title });
    await createPushCampaignPage.switchSchedule();
    await createPushCampaignPage.scheduleOn(tomorrow);
    await createPushCampaignPage.send();

    const result = await createPushCampaignPage.summary.confirm('Schedule');

    expect(result.success, result.message).toBe(true);
    test.info().annotations.push({ type: 'observed', description: `Schedule: "${result.message}", status ${result.status}.` });

    const [campaign] = await pushCampaigns(api, scheduled.name);
    expect(campaign?.name).toBe(scheduled.name);
    await pushCampaignsPage.open();
    const actions = await pushCampaignsPage.enabledActions(scheduled.name);
    test.info().annotations.push({ type: 'observed', description: `Scheduled campaign actions: ${actions.join(', ')}.` });
    expect(actions).toContain('Delete');

    const deleted = await pushCampaignsPage.deleteCampaign(scheduled.name);

    expect(deleted).toEqual({ success: true, message: 'Campaign has been deleted!' });
    await pushCampaignsPage.open();
    await pushCampaignsPage.expectNoRow(scheduled.name);
  });
});
