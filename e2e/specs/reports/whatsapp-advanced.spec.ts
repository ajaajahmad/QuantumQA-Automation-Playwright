import { expect, test } from '../../fixtures/test-fixtures';
import { daysAgo, isoDate } from '../../utils/date-time';

// Read-only. Nothing loads until Search is clicked, so each test pins down what the form posts
// and that the results are built from the response. The filters offer whatever the account has
// in the period, so tests pick values from those lists instead of naming campaigns.

// [view, group_by]. The first is the view a search opens on. Monthly and Yearly are summary-only.
const panelViews = [
  ['Campaign', 'campaign'],
  ['Date & Campaign', 'campaign_name'],
  ['Date', 'date'],
  ['Country', 'country'],
  ['WABA Number', 'waba_number'],
  ['Template Name', 'template_name'],
  ['List Name', 'list_id'],
  ['Responses', 'link_click'],
  ['Campaign Category', 'category'],
  ['Campaign Type', 'is_direct_send'],
] as const;

const apiViews = [
  ['Date', 'date'],
  ['Country', 'country'],
  ['WABA Number', 'waba_number'],
  ['Template Name', 'template_name'],
  ['Campaign Type', 'is_direct_send'],
  ['Responses', 'link_click'],
] as const;

const panelOptions = {
  tabs: ['Date & Campaign', 'Date', 'Campaign'],
  more: panelViews.slice(3).map(([view]) => view),
};

const apiOptions = {
  tabs: ['Date'],
  more: apiViews.slice(1).map(([view]) => view),
};

const panelFields = [
  'Start Date',
  'End Date',
  'WABA Number',
  'Mobile Number',
  'Campaign Name',
  'Campaign Category',
  'List Name',
  'Template',
  'Status',
  'Country',
  'Content Type',
  'Template Category',
  'Executed By',
  'View Counts By',
];

const apiFields = [
  'Start Date',
  'End Date',
  'WABA Number',
  'Mobile Number',
  'Tags',
  'GUID',
  'Status',
  'Country',
  'Template Category',
  'View Counts By',
];

const defaultSearch = {
  from_date: isoDate(daysAgo(1)),
  to_date: isoDate(daysAgo(0)),
  view_counts_by: 'submission',
  limit: 10,
  page: 1,
};

test.describe('WhatsApp Advanced Search via panel', () => {
  test('opens on yesterday to today with nothing searched yet', async ({ whatsAppAdvancedPage }) => {
    await whatsAppAdvancedPage.open();

    await whatsAppAdvancedPage.form.expectDates(daysAgo(1), daysAgo(0));
    await whatsAppAdvancedPage.form.expectFields(panelFields);
    await whatsAppAdvancedPage.form.expectCountedBy('Submission');
    await whatsAppAdvancedPage.expectNoResults();
  });

  test('searches campaign submissions for the dates and collapses the form', async ({ whatsAppAdvancedPage }) => {
    await whatsAppAdvancedPage.open();

    const report = await whatsAppAdvancedPage.form.search();

    expect(report.body).toEqual({ ...defaultSearch, group_by: 'campaign' });
    await whatsAppAdvancedPage.table.expectActiveView('Campaign');
    await whatsAppAdvancedPage.table.expectColumnsOf(report);
    await whatsAppAdvancedPage.table.expectRowsOf(report);
    await whatsAppAdvancedPage.table.expectTotalsOf(report);
    await whatsAppAdvancedPage.form.expectCollapsed();

    await whatsAppAdvancedPage.form.expand();
    await whatsAppAdvancedPage.form.expectDates(daysAgo(1), daysAgo(0));
  });

  // Also guards the view list below: a view the API adds or drops fails here first.
  test('offers the views the API configures', async ({ whatsAppAdvancedPage }) => {
    await whatsAppAdvancedPage.open();

    const report = await whatsAppAdvancedPage.form.search();

    expect(report.viewByOptions).toEqual(panelOptions);
    await whatsAppAdvancedPage.table.expectViewByOptions(panelOptions);
  });

  for (const [view, groupBy] of panelViews.slice(1)) {
    test(`shows the ${view} view with the columns the API returned`, async ({ whatsAppAdvancedPage }) => {
      // Staging defect: with traffic in the period this view answers 503 "Something went wrong".
      test.fail(view === 'Campaign Type', 'the Campaign Type view fails on staging once the period has traffic');
      await whatsAppAdvancedPage.open();
      await whatsAppAdvancedPage.form.search();

      const report = await whatsAppAdvancedPage.table.viewBy(view);

      expect(report.body.group_by).toBe(groupBy);
      await whatsAppAdvancedPage.table.expectActiveView(view);
      await whatsAppAdvancedPage.table.expectColumnsOf(report);
      await whatsAppAdvancedPage.table.expectRowsOf(report);
      await whatsAppAdvancedPage.table.expectTotalsOf(report);
    });
  }

  test('counts billable messages when Billable is chosen', async ({ whatsAppAdvancedPage }) => {
    await whatsAppAdvancedPage.open();
    await whatsAppAdvancedPage.form.countBy('Billable');

    const report = await whatsAppAdvancedPage.form.search();

    expect(report.body.view_counts_by).toBe('billable');
    await whatsAppAdvancedPage.form.expand();
    await whatsAppAdvancedPage.form.expectCountedBy('Billable');
  });

  test('searches a typed date range', async ({ whatsAppAdvancedPage }) => {
    await whatsAppAdvancedPage.open();
    await whatsAppAdvancedPage.form.setDates(daysAgo(10), daysAgo(3));

    const report = await whatsAppAdvancedPage.form.search();

    expect(report.dateRange).toEqual([{ from_date: isoDate(daysAgo(10)), to_date: isoDate(daysAgo(3)) }]);
    await whatsAppAdvancedPage.form.expectDates(daysAgo(10), daysAgo(3));
  });

  test('lists the campaigns the account ran in the period', async ({ whatsAppAdvancedPage }) => {
    await whatsAppAdvancedPage.open();

    const { params, offered, shown } = await whatsAppAdvancedPage.form.listOptions('Campaign Name');

    expect(params.get('field')).toBe('campaign_name');
    expect(params.get('from_date')).toBe(isoDate(daysAgo(1)));
    expect(params.get('to_date')).toBe(isoDate(daysAgo(0)));
    expect(shown).toEqual(['Select', ...offered]);
  });

  test('lists the delivery statuses with All first', async ({ whatsAppAdvancedPage }) => {
    await whatsAppAdvancedPage.open();

    const { params, offered, shown } = await whatsAppAdvancedPage.form.listOptions('Status');

    expect(params.get('field')).toBe('status');
    expect(offered[0]).toBe('All');
    expect(shown).toEqual(offered);
  });

  test('searches one campaign picked from the list', async ({ whatsAppAdvancedPage }) => {
    await whatsAppAdvancedPage.open();
    const [campaign] = (await whatsAppAdvancedPage.form.listOptions('Campaign Name')).offered;
    await whatsAppAdvancedPage.form.select('Campaign Name', campaign);

    const report = await whatsAppAdvancedPage.form.search();

    expect(report.body.campaign_name).toEqual({ key: 'select', value: campaign });
    expect(report.docs.length).toBeGreaterThan(0);
    expect(report.docs.map((doc) => doc.campaign_name)).toEqual(report.docs.map(() => campaign));
    await whatsAppAdvancedPage.table.expectRowsOf(report);
  });

  test('searches campaigns whose name contains text', async ({ whatsAppAdvancedPage }) => {
    await whatsAppAdvancedPage.open();
    const [campaign] = (await whatsAppAdvancedPage.form.listOptions('Campaign Name')).offered;
    const part = campaign.slice(0, 9);
    await whatsAppAdvancedPage.form.contains('Campaign Name', part);

    const report = await whatsAppAdvancedPage.form.search();

    expect(report.body.campaign_name).toEqual({ key: 'contains', value: part });
    expect(report.docs.length).toBeGreaterThan(0);
    expect(report.docs.every((doc) => String(doc.campaign_name).includes(part))).toBe(true);
    await whatsAppAdvancedPage.table.expectRowsOf(report);
  });

  test('leaves out campaigns whose name contains text', async ({ whatsAppAdvancedPage }) => {
    await whatsAppAdvancedPage.open();
    const [campaign] = (await whatsAppAdvancedPage.form.listOptions('Campaign Name')).offered;
    const part = campaign.slice(0, 9);
    await whatsAppAdvancedPage.form.doesNotContain('Campaign Name', part);

    const report = await whatsAppAdvancedPage.form.search();

    expect(report.body.campaign_name).toEqual({ key: 'not_contains', value: part });
    expect(report.docs.some((doc) => String(doc.campaign_name).includes(part))).toBe(false);
    await whatsAppAdvancedPage.table.expectRowsOf(report);
  });

  test('searches recipients whose number contains at least 7 digits', async ({ whatsAppAdvancedPage }) => {
    await whatsAppAdvancedPage.open();
    await whatsAppAdvancedPage.form.contains('Mobile Number', '9184480');

    const report = await whatsAppAdvancedPage.form.search();

    expect(report.body.recipient).toEqual({ key: 'contains', value: '9184480' });
    await whatsAppAdvancedPage.table.expectRowsOf(report);
  });

  test('refuses a mobile number shorter than 7 digits', async ({ whatsAppAdvancedPage }) => {
    await whatsAppAdvancedPage.open();
    await whatsAppAdvancedPage.form.contains('Mobile Number', '918448');

    await whatsAppAdvancedPage.form.expectSearchRefused('Please enter minimum 7 digits');
    await whatsAppAdvancedPage.expectNoResults();
  });

  test('searches one delivery status', async ({ whatsAppAdvancedPage }) => {
    await whatsAppAdvancedPage.open();
    await whatsAppAdvancedPage.form.select('Status', 'Delivered');

    const report = await whatsAppAdvancedPage.form.search();

    expect(report.body.status).toEqual({ key: 'select', value: 'Delivered' });
    await whatsAppAdvancedPage.table.expectRowsOf(report);
  });

  test('keeps the filters when the view changes', async ({ whatsAppAdvancedPage }) => {
    await whatsAppAdvancedPage.open();
    await whatsAppAdvancedPage.form.select('Status', 'Delivered');
    await whatsAppAdvancedPage.form.search();

    const report = await whatsAppAdvancedPage.table.viewBy('Date');

    expect(report.body.group_by).toBe('date');
    expect(report.body.status).toEqual({ key: 'select', value: 'Delivered' });
  });

  test('reloads from the first page when the page size changes', async ({ whatsAppAdvancedPage }) => {
    await whatsAppAdvancedPage.open();
    await whatsAppAdvancedPage.form.search();

    const report = await whatsAppAdvancedPage.table.setPageSize(25);

    // The page posts the chosen size as a string, unlike the number it posts on Search.
    expect(Number(report.body.limit)).toBe(25);
    expect(report.body.page).toBe(1);
  });
});

test.describe('WhatsApp Advanced Search via API', () => {
  test('opens on yesterday to today with the API fields', async ({ whatsAppAdvancedPage }) => {
    await whatsAppAdvancedPage.open();
    await whatsAppAdvancedPage.openViaApi();

    await whatsAppAdvancedPage.form.expectDates(daysAgo(1), daysAgo(0));
    await whatsAppAdvancedPage.form.expectFields(apiFields);
    await whatsAppAdvancedPage.form.expectCountedBy('Submission');
    await whatsAppAdvancedPage.expectNoResults();
  });

  test('searches API submissions by date', async ({ whatsAppAdvancedPage }) => {
    await whatsAppAdvancedPage.open();
    await whatsAppAdvancedPage.openViaApi();

    const report = await whatsAppAdvancedPage.form.search();

    expect(report.body).toEqual({ ...defaultSearch, group_by: 'date' });
    await whatsAppAdvancedPage.table.expectActiveView('Date');
    await whatsAppAdvancedPage.table.expectColumnsOf(report);
    await whatsAppAdvancedPage.table.expectRowsOf(report);
    await whatsAppAdvancedPage.table.expectTotalsOf(report);
    await whatsAppAdvancedPage.form.expectCollapsed();
  });

  test('offers the views the API configures', async ({ whatsAppAdvancedPage }) => {
    await whatsAppAdvancedPage.open();
    await whatsAppAdvancedPage.openViaApi();

    const report = await whatsAppAdvancedPage.form.search();

    expect(report.viewByOptions).toEqual(apiOptions);
    await whatsAppAdvancedPage.table.expectViewByOptions(apiOptions);
  });

  for (const [view, groupBy] of apiViews.slice(1)) {
    test(`shows the ${view} view with the columns the API returned`, async ({ whatsAppAdvancedPage }) => {
      await whatsAppAdvancedPage.open();
      await whatsAppAdvancedPage.openViaApi();
      await whatsAppAdvancedPage.form.search();

      const report = await whatsAppAdvancedPage.table.viewBy(view);

      expect(report.body.group_by).toBe(groupBy);
      await whatsAppAdvancedPage.table.expectActiveView(view);
      await whatsAppAdvancedPage.table.expectColumnsOf(report);
      await whatsAppAdvancedPage.table.expectRowsOf(report);
      await whatsAppAdvancedPage.table.expectTotalsOf(report);
    });
  }

  test('lists the WABA numbers that sent API messages in the period', async ({ whatsAppAdvancedPage }) => {
    await whatsAppAdvancedPage.open();
    await whatsAppAdvancedPage.openViaApi();

    const { params, offered, shown } = await whatsAppAdvancedPage.form.listOptions('WABA Number');

    expect(params.get('field')).toBe('waba_number');
    expect(params.get('from_date')).toBe(isoDate(daysAgo(1)));
    expect(params.get('to_date')).toBe(isoDate(daysAgo(0)));
    expect(shown).toEqual(['Select', ...offered]);
  });

  test('searches by tag and GUID', async ({ whatsAppAdvancedPage }) => {
    await whatsAppAdvancedPage.open();
    await whatsAppAdvancedPage.openViaApi();
    await whatsAppAdvancedPage.form.fill('Tags', 'automation');
    await whatsAppAdvancedPage.form.fill('GUID', 'no-such-guid');

    const report = await whatsAppAdvancedPage.form.search();

    expect(report.body.tag).toEqual({ key: 'equal', value: 'automation' });
    expect(report.body.guid).toEqual({ key: 'equal', value: 'no-such-guid' });
    await whatsAppAdvancedPage.table.expectRowsOf(report);
    await whatsAppAdvancedPage.table.expectTotalsOf(report);
  });
});
