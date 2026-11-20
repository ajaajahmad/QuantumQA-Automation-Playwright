import { expect, test } from '../../fixtures/test-fixtures';
import type { CreatePushCampaignPage } from '../../pages/app-push/create-push-campaign.page';
import { deleteScheduledPushCampaigns, pushApps, pushCampaigns, pushReport } from '../../utils/app-push';
import { appConfig } from '../../utils/config';
import { daysAgo } from '../../utils/date-time';

// Pushes for real, so it runs only with APP_PUSH_SEND=1 (npm run test:app-push-send). Each run
// test-sends to app_push_device_token once, sends one campaign to the contacts of the file the user
// uploaded for it (app_push_recipients_file, picked from Existing File), and schedules one for
// tomorrow, which it deletes again. Its tokens are testing tokens (confirmed 2026-11-19); staging
// charges the sends to the account's INR balance. The expected counts come from the file's
// preview, so the file can change. Retries are off so a retry can't push twice, and the tests
// share the campaign, so they run in order.
test.describe.configure({ mode: 'serial', retries: 0 });
test.use({ serviceWorkers: 'block' });

const token = appConfig.appPushDeviceToken;
const stamp = Date.now();
const sent = { name: `qa_auto_push_${stamp}`, title: 'QA App Push send', body: 'Hello ' };
const scheduled = { name: `qa_auto_push_scheduled_${stamp}`, title: 'QA App Push scheduled' };
let app: string;
// The file's header row and contacts, from its preview.
let header: string[] = [];
let contacts: string[][] = [];

// Imports the user's contacts file from Existing File, mapping its token and device columns, and
// keeps its rows for the expectations.
async function importRecipients(form: CreatePushCampaignPage): Promise<void> {
  await form.openImport();
  const files = await form.importDialog.existingFiles();
  test.skip(
    !files.some((file) => file.startsWith(appConfig.appPushRecipientsFile)),
    `No uploaded file named ${appConfig.appPushRecipientsFile}...; upload it on the App Push import dialog.`,
  );

  const preview = await form.importDialog.chooseExisting(appConfig.appPushRecipientsFile);
  expect(preview.status, preview.name).toBe(200);
  [header, ...contacts] = preview.rows;
  await form.importDialog.chooseColumns('Device Token', 'Device Identifier');

  expect(await form.importDialog.import()).toBe(contacts.length);
}

// How many contacts the file has per device type, as the report keys them (android, ios).
function contactsByDevice(): Record<string, number> {
  const column = header.indexOf('Device Identifier');
  return contacts.reduce<Record<string, number>>((counts, row) => {
    const device = row[column].toLowerCase();
    counts[device] = (counts[device] ?? 0) + 1;
    return counts;
  }, {});
}

function firstName(): string {
  return contacts[0][header.indexOf('Name')];
}

test.beforeAll(() => {
  test.skip(process.env.APP_PUSH_SEND !== '1', 'Pushes for real; run with APP_PUSH_SEND=1.');
  test.skip(!token, 'Set app_push_device_token in config/qa.properties.');
});

test.beforeEach(async ({ api }) => {
  const apps = await pushApps(api);
  test.skip(apps.length === 0, 'The account has no active App Push integration.');
  app = apps[0].app_name;
});

// Whatever a test did, nothing scheduled is left to go out tomorrow; a no-op once the schedule test
// has deleted its campaign, and before it has made one.
test.afterEach(async ({ api }) => {
  const deleted = await deleteScheduledPushCampaigns(api, scheduled.name);

  if (deleted.length > 0) {
    test.info().annotations.push({ type: 'cleanup', description: `Deleted scheduled ${scheduled.name} through the API.` });
  }
});

test.describe('App Push send', () => {
  test('test-sends, then sends a personalised campaign to the contacts file', async ({
    pushCampaignsPage,
    createPushCampaignPage,
  }) => {
    await pushCampaignsPage.open();
    await pushCampaignsPage.createCampaign();
    await createPushCampaignPage.enterName(sent.name);
    await createPushCampaignPage.chooseCategory(appConfig.campaignCategory);
    await createPushCampaignPage.chooseApp(app);
    await importRecipients(createPushCampaignPage);
    await createPushCampaignPage.expectContacts(contacts.length);
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
      expect(validation).toMatchObject({ totalCount: contacts.length, validCount: contacts.length });
      await createPushCampaignPage.summary.expectSummary({
        'Campaign Name': sent.name,
        'Uploaded Contacts': String(contacts.length),
        'Valid Contacts': String(contacts.length),
      });

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
      'Uploaded Contacts': String(contacts.length),
      'Valid Contacts': String(contacts.length),
    });
    // The body is shown personalised for the first contact.
    await pushCampaignsPage.summary.expectMessage(`${sent.body}${firstName()}`);
  });

  // The report counts each message once the delivery side has processed it, which took about
  // two minutes on staging (2026-11-19). The test send (Android) is counted under the campaign too.
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
    expect(row.count_total).toBe(contacts.length + 1);
    expect(row.created_by).toBeTruthy();
    test.info().annotations.push({
      type: 'observed',
      description: `Sent ${row.count_sent}, delivered ${row.count_delivered}, failed ${row.count_failed}, awaiting ${row.count_awaiting}, rejected ${row.count_rejected}, currency ${row.currency_used}.`,
    });

    const byDevice = await pushReport(api, 'device_type', daysAgo(1), daysAgo(0), { campaign_name: sent.name });
    const expected = contactsByDevice();
    expected.android = (expected.android ?? 0) + 1;
    expect(Object.fromEntries(byDevice.map((doc) => [doc.device_type, doc.count_total]))).toEqual(expected);

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
    await importRecipients(createPushCampaignPage);
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
