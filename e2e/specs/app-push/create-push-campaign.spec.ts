import { expect, test } from '../../fixtures/test-fixtures';
import type { CreatePushCampaignPage } from '../../pages/app-push/create-push-campaign.page';
import type { PushCampaignsPage } from '../../pages/app-push/push-campaigns.page';
import { bothDevices, pushApps, pushCampaigns, recipientColumns, writeRecipientsFile } from '../../utils/app-push';
import { appConfig } from '../../utils/config';
import { blockPushSends, type BlockedRequest } from '../../utils/write-guard';

// The create form, short of pushing anything. Reaching the content step takes a saved draft and
// an imported contacts file, so the specs save one draft (drafts are not listed) and upload a
// small CSV per test; Test Now and the send or schedule are aborted by blockPushSends, and each
// test checks what was aborted. The send spec (APP_PUSH_SEND=1) is the one that pushes.

// Routes on the context can miss requests a service worker makes.
test.use({ serviceWorkers: 'block' });

const token = appConfig.appPushDeviceToken || 'qa-placeholder-device-token';
const recipients = bothDevices(token);
const content = { title: 'QA App Push title', body: 'QA App Push body', imageUrl: 'https://example.com/push.png' };

let draftId: string | undefined;
let blocked: BlockedRequest[];

test.beforeEach(async ({ context }) => {
  blocked = await blockPushSends(context);
});

// The first test saves the draft; the others reopen it, so a run adds one draft, not one a test.
async function openDraft(campaigns: PushCampaignsPage, form: CreatePushCampaignPage): Promise<void> {
  if (draftId) {
    await form.open(draftId);
    return;
  }

  await campaigns.open();
  draftId = await campaigns.createCampaign();
  await form.expectOpened();
}

// Fills every step a send needs: parameters, contacts, then content (unlocked by the first two).
async function fillCampaign(form: CreatePushCampaignPage, app: string): Promise<void> {
  await form.enterName(`qa_auto_push_form_${Date.now()}`);
  await form.chooseCategory(appConfig.campaignCategory);
  await form.chooseApp(app);
  expect(await form.importContacts(writeRecipientsFile(recipients))).toBe(2);
  await form.enterContent(content);
}

test.describe('Create App Push campaign', () => {
  let app: string;

  test.beforeEach(async ({ api }) => {
    const apps = await pushApps(api);
    test.skip(apps.length === 0, 'The account has no active App Push integration.');
    app = apps[0].app_name;
  });

  test('saves a hidden draft named after its creation time', async ({ api, pushCampaignsPage, createPushCampaignPage }) => {
    await openDraft(pushCampaignsPage, createPushCampaignPage);

    await createPushCampaignPage.expectDefaults();
    expect((await pushCampaigns(api)).map((campaign) => campaign._id)).not.toContain(draftId);
  });

  test("offers the account's categories and active apps", async ({ api, pushCampaignsPage, createPushCampaignPage }) => {
    const categories = (await (await api.get('/api/v1/categories?type=campaign')).json()) as { data: { name: string }[] };
    const apps = await pushApps(api);
    await openDraft(pushCampaignsPage, createPushCampaignPage);

    expect(await createPushCampaignPage.categoryOptions()).toEqual(['Select', ...categories.data.map((category) => category.name)]);
    expect(await createPushCampaignPage.appOptions()).toEqual(['Select', ...apps.map((option) => option.app_name)]);
  });

  test('refuses to send without category, app, title and contacts', async ({ pushCampaignsPage, createPushCampaignPage }) => {
    await openDraft(pushCampaignsPage, createPushCampaignPage);

    await createPushCampaignPage.clickSend();

    await createPushCampaignPage.expectRefused(
      'Please select category',
      'Please Select App Name',
      'Please enter your title.',
      'Please import contacts.',
    );
    expect(blocked).toEqual([]);
  });

  test('keeps the content locked until contacts are imported and an app is chosen', async ({
    pushCampaignsPage,
    createPushCampaignPage,
  }) => {
    await openDraft(pushCampaignsPage, createPushCampaignPage);
    await createPushCampaignPage.expectContentLocked(true);

    await createPushCampaignPage.importContacts(writeRecipientsFile(recipients));
    await createPushCampaignPage.chooseCategory(appConfig.campaignCategory);
    await createPushCampaignPage.expectContentLocked(true);
    await createPushCampaignPage.chooseApp(app);

    await createPushCampaignPage.expectContentLocked(false);
  });

  test('imports a contacts file after previewing it and mapping its columns', async ({
    pushCampaignsPage,
    createPushCampaignPage,
  }) => {
    const filePath = writeRecipientsFile(recipients);
    await openDraft(pushCampaignsPage, createPushCampaignPage);
    await createPushCampaignPage.openImport();
    const dialog = createPushCampaignPage.importDialog;

    const uploaded = await dialog.upload(filePath);

    expect(uploaded.headers).toEqual(recipientColumns);
    expect(uploaded.rows).toBe(2);
    expect(uploaded.name).toMatch(/^recipients_\d+-\d{2}-\d{2}-\d{4}-\d{2}:\d{2}\.csv$/);
    await dialog.expectColumnChoices(recipientColumns);

    await dialog.chooseTokenColumn('Device Token');
    await dialog.importRefused();

    await dialog.chooseColumns('Device Token', 'Device Identifier');
    await dialog.expectPreview([recipientColumns, ...recipients.map((row) => [row.deviceToken, row.device, row.name, row.url])]);
    await dialog.expectCount(2);
    expect(await dialog.import()).toBe(2);
    await createPushCampaignPage.expectContacts(2);
  });

  test('lists the files uploaded before, newest first', async ({ pushCampaignsPage, createPushCampaignPage }) => {
    const filePath = writeRecipientsFile(recipients);
    await openDraft(pushCampaignsPage, createPushCampaignPage);
    await createPushCampaignPage.openImport();
    const uploaded = await createPushCampaignPage.importDialog.upload(filePath);
    await createPushCampaignPage.open(draftId!);
    await createPushCampaignPage.openImport();

    const files = await createPushCampaignPage.importDialog.existingFiles();

    expect(files[0]).toBe(uploaded.name);
  });

  test('previews an xlsx uploaded before', async ({ pushCampaignsPage, createPushCampaignPage }) => {
    await openDraft(pushCampaignsPage, createPushCampaignPage);
    await createPushCampaignPage.openImport();
    const xlsx = (await createPushCampaignPage.importDialog.existingFiles()).find((name) => name.endsWith('.xlsx'));
    test.skip(!xlsx, 'No .xlsx among the uploaded files.');

    const preview = await createPushCampaignPage.importDialog.chooseExisting(xlsx!);

    expect(preview.status).toBe(200);
  });

  // Known defect: picking the Sheet list's Select placeholder still requests a preview (sheet=0),
  // which answers 500 and names the server's file path and the shell command that failed. This
  // passes while the defect exists and fails once it's fixed: then remove test.fail.
  test('picks no sheet when the Select placeholder is chosen', async ({ pushCampaignsPage, createPushCampaignPage }) => {
    await openDraft(pushCampaignsPage, createPushCampaignPage);
    await createPushCampaignPage.openImport();
    const xlsx = (await createPushCampaignPage.importDialog.existingFiles()).find((name) => name.endsWith('.xlsx'));
    test.skip(!xlsx, 'No .xlsx among the uploaded files.');
    test.fail(true, 'Staging answers 500 with its file path and shell command to the Select placeholder.');

    const preview = await createPushCampaignPage.importDialog.chooseExisting(xlsx!, 'Select');

    expect(preview.status).toBe(200);
    expect(preview.body).not.toContain('Command failed');
  });

  test('personalises the body with a column and previews it for the first contact', async ({
    pushCampaignsPage,
    createPushCampaignPage,
  }) => {
    await openDraft(pushCampaignsPage, createPushCampaignPage);
    await fillCampaign(createPushCampaignPage, app);

    expect(await createPushCampaignPage.personaliseColumns()).toEqual(recipientColumns);
    await createPushCampaignPage.personalise('Name');

    await createPushCampaignPage.expectBody(`${content.body}<<Name>>`);
    await createPushCampaignPage.expectCharCount(content.body.length + recipients[0].name.length);
    await createPushCampaignPage.expectPreview(content.title, `${content.body}${recipients[0].name}`);
  });

  test('shows the counts and cost in the summary before sending', async ({ pushCampaignsPage, createPushCampaignPage }) => {
    await openDraft(pushCampaignsPage, createPushCampaignPage);
    await fillCampaign(createPushCampaignPage, app);
    await createPushCampaignPage.expectPreview(content.title, content.body);

    const validation = await createPushCampaignPage.send();

    expect(validation).toMatchObject({ totalCount: 2, validCount: 2, duplicateCount: 0, excludedCount: 0 });
    await createPushCampaignPage.summary.expectSummary({
      'Campaign Category': appConfig.campaignCategory,
      'App Name': app,
      Title: content.title,
      'Uploaded Contacts': '2',
      'Valid Contacts': '2',
      'Excluded Contacts': 'Not Enabled',
      'Currency Deduction Estimation': `${validation.currencyUnit} ${validation.currencyCount}`,
    });
    await createPushCampaignPage.summary.expectMessage(content.body);
    await createPushCampaignPage.summary.expectConfirm('Send Now');
    expect(blocked).toEqual([]);
  });

  test('sends what the form holds on Send Now', async ({ pushCampaignsPage, createPushCampaignPage }) => {
    await openDraft(pushCampaignsPage, createPushCampaignPage);
    await fillCampaign(createPushCampaignPage, app);
    await createPushCampaignPage.send();

    await createPushCampaignPage.summary.clickConfirm('Send Now');

    await expect.poll(() => blocked.length).toBe(1);
    expect(blocked[0]).toMatchObject({
      method: 'PUT',
      path: `/api/v1/app-push-campaign/${draftId}`,
      body: {
        title: content.title,
        body: content.body,
        image: content.imageUrl,
        app_name: app,
        category_name: appConfig.campaignCategory,
        is_recurring: false,
        campaign_summary: { createCampaignForm: { switchedScheduler: false, timezone: 'Asia/Kolkata' } },
      },
    });
  });

  test('refuses Test Now without a token', async ({ pushCampaignsPage, createPushCampaignPage }) => {
    await openDraft(pushCampaignsPage, createPushCampaignPage);
    await fillCampaign(createPushCampaignPage, app);

    await createPushCampaignPage.clickTestNow();

    await createPushCampaignPage.expectRefused();
    expect(blocked).toEqual([]);
  });

  test('takes at most 10 test tokens', async ({ pushCampaignsPage, createPushCampaignPage }) => {
    await openDraft(pushCampaignsPage, createPushCampaignPage);
    await fillCampaign(createPushCampaignPage, app);
    await createPushCampaignPage.enterTestTokens(Array.from({ length: 11 }, (_, index) => `${token}${index}`));

    await createPushCampaignPage.clickTestNow();

    // The field takes device tokens, but the message speaks of mobile numbers.
    await createPushCampaignPage.expectTestTokensError('You can add up to 10 mobile numbers only.');
    expect(blocked).toEqual([]);
  });

  test('sends the test tokens and the chosen device type on Test Now', async ({
    pushCampaignsPage,
    createPushCampaignPage,
  }) => {
    await openDraft(pushCampaignsPage, createPushCampaignPage);
    await fillCampaign(createPushCampaignPage, app);
    await createPushCampaignPage.enterTestTokens([token]);
    await createPushCampaignPage.chooseTestDevice('IOS');

    await createPushCampaignPage.clickTestNow();

    await expect.poll(() => blocked.length).toBe(1);
    expect(blocked[0]).toMatchObject({
      method: 'POST',
      path: '/api/v1/app-push-campaign/test-campaigns',
      body: { campaign_id: draftId, contacts: [token], device_type: 'ios', title: content.title, app_name: app },
    });
  });

  test('offers schedule days from today and needs one picked', async ({ pushCampaignsPage, createPushCampaignPage }) => {
    await openDraft(pushCampaignsPage, createPushCampaignPage);
    await fillCampaign(createPushCampaignPage, app);

    await createPushCampaignPage.switchSchedule();

    await createPushCampaignPage.expectSendLabel('Schedule');
    expect((await createPushCampaignPage.schedulableDays())[0]).toBe(new Date().getDate());
    await createPushCampaignPage.clickSend();
    await createPushCampaignPage.expectRefused('Please choose date and time.');
    expect(blocked).toEqual([]);
  });

  test('sends the picked time on Schedule', async ({ pushCampaignsPage, createPushCampaignPage }) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await openDraft(pushCampaignsPage, createPushCampaignPage);
    await fillCampaign(createPushCampaignPage, app);
    await createPushCampaignPage.switchSchedule();
    const shown = await createPushCampaignPage.scheduleOn(tomorrow);
    await createPushCampaignPage.send();
    await createPushCampaignPage.summary.expectConfirm('Schedule');

    await createPushCampaignPage.summary.clickConfirm('Schedule');

    await expect.poll(() => blocked.length).toBe(1);
    const form = (blocked[0].body as { campaign_summary: { createCampaignForm: { dateTime: string; switchedScheduler: boolean } } })
      .campaign_summary.createCampaignForm;
    expect(form.switchedScheduler).toBe(true);
    // The field shows local time (2026-11-20 23:29); the request carries it in UTC.
    expect(new Date(form.dateTime).getTime()).toBe(new Date(shown.replace(' ', 'T')).getTime());
  });
});
