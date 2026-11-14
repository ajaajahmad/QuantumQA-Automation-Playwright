import { expect, test } from '../../fixtures/test-fixtures';
import { daysAgo, isoDate } from '../../utils/date-time';
import { viewsOf } from '../../utils/report-response';

// Read-only. Nothing loads until Search is clicked, so each test pins down what the form posts
// and that the results are built from the response. The filters offer whatever the account has
// in the period, so tests pick values from those lists instead of naming campaigns.

// [view, group_by]. The first is the view a search opens on. Monthly and Yearly are summary-only.
// These are all the views known; an account is offered a subset.
const panelViews = [
  ['Campaign', 'campaign'],
  ['Date & Campaign', 'campaign_name'],
  ['Date', 'date'],
  ['Country', 'country'],
  ['List Name', 'list_id'],
  ['Agent Name', 'agent_name'],
  ['Responses', 'response'],
  ['Campaign Category', 'category'],
  ['Template Name', 'template_name'],
  ['Operator', 'operator'],
  ['Bot Type', 'agent_bot_type'],
] as const;

const apiViews = [
  ['Date', 'date'],
  ['Country', 'country'],
  ['Agent Name', 'agent_name'],
  ['Responses', 'response'],
  ['Template Name', 'template_name'],
  ['Operator', 'operator'],
  ['Bot Type', 'agent_bot_type'],
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
  'Agent',
  'Bot Type',
  'Mobile Number',
  'Campaign Name',
  'Campaign Category',
  'List Name',
  'Status',
  'Content Type',
  'Country',
  'Executed By',
  'View Counts By',
];

const apiFields = [
  'Start Date',
  'End Date',
  'Agent',
  'Bot Type',
  'Mobile Number',
  'Tags',
  'GUID',
  'Status',
  'Content Type',
  'Country',
  'View Counts By',
];

const defaultSearch = {
  from_date: isoDate(daysAgo(1)),
  to_date: isoDate(daysAgo(0)),
  view_counts_by: 'submission',
  limit: 10,
  page: 1,
};

test.describe('RCS Advanced Search via panel', () => {
  test('opens on yesterday to today with nothing searched yet', async ({ rcsAdvancedPage }) => {
    await rcsAdvancedPage.open();

    await rcsAdvancedPage.form.expectDates(daysAgo(1), daysAgo(0));
    await rcsAdvancedPage.form.expectFields(panelFields);
    await rcsAdvancedPage.form.expectCountedBy('Submission');
    await rcsAdvancedPage.expectNoResults();
  });

  test('searches campaign submissions for the dates and collapses the form', async ({ rcsAdvancedPage }) => {
    await rcsAdvancedPage.open();

    const report = await rcsAdvancedPage.form.search();

    expect(report.body).toEqual({ ...defaultSearch, group_by: 'campaign' });
    await rcsAdvancedPage.table.expectActiveView('Campaign');
    await rcsAdvancedPage.table.expectColumnsOf(report);
    await rcsAdvancedPage.table.expectRowsOf(report);
    await rcsAdvancedPage.table.expectTotalsOf(report);
    await rcsAdvancedPage.form.expectCollapsed();

    await rcsAdvancedPage.form.expand();
    await rcsAdvancedPage.form.expectDates(daysAgo(1), daysAgo(0));
  });

  // Also guards the view list above: a view the API adds that the list doesn't know fails here.
  test('offers the views the API configures', async ({ rcsAdvancedPage }) => {
    await rcsAdvancedPage.open();

    const report = await rcsAdvancedPage.form.search();

    expect(report.viewByOptions.tabs).toEqual(panelOptions.tabs);
    expect(panelOptions.more).toEqual(expect.arrayContaining(report.viewByOptions.more));
    await rcsAdvancedPage.table.expectViewByOptions(report.viewByOptions);
  });

  for (const [view, groupBy] of panelViews.slice(1)) {
    test(`shows the ${view} view with the columns the API returned`, async ({ rcsAdvancedPage }) => {
      await rcsAdvancedPage.open();
      const opened = await rcsAdvancedPage.form.search();
      test.skip(!viewsOf(opened).includes(view), 'This account is not offered this view.');

      const report = await rcsAdvancedPage.table.viewBy(view);

      expect(report.body.group_by).toBe(groupBy);
      await rcsAdvancedPage.table.expectActiveView(view);
      await rcsAdvancedPage.table.expectColumnsOf(report);
      await rcsAdvancedPage.table.expectRowsOf(report);
      await rcsAdvancedPage.table.expectTotalsOf(report);
    });
  }

  test('counts billable messages when Billable is chosen', async ({ rcsAdvancedPage }) => {
    await rcsAdvancedPage.open();
    await rcsAdvancedPage.form.countBy('Billable');

    const report = await rcsAdvancedPage.form.search();

    expect(report.body.view_counts_by).toBe('billable');
    await rcsAdvancedPage.form.expand();
    await rcsAdvancedPage.form.expectCountedBy('Billable');
  });

  test('searches a typed date range', async ({ rcsAdvancedPage }) => {
    await rcsAdvancedPage.open();
    await rcsAdvancedPage.form.setDates(daysAgo(10), daysAgo(3));

    const report = await rcsAdvancedPage.form.search();

    expect(report.dateRange).toEqual([{ from_date: isoDate(daysAgo(10)), to_date: isoDate(daysAgo(3)) }]);
    await rcsAdvancedPage.form.expectDates(daysAgo(10), daysAgo(3));
  });

  test('lists the campaigns the account ran in the period', async ({ rcsAdvancedPage }) => {
    await rcsAdvancedPage.open();

    const { params, offered, shown } = await rcsAdvancedPage.form.listOptions('Campaign Name');

    expect(params.get('field')).toBe('campaign_name');
    expect(params.get('from_date')).toBe(isoDate(daysAgo(1)));
    expect(params.get('to_date')).toBe(isoDate(daysAgo(0)));
    // An empty list says so under its Select entry.
    expect(shown).toEqual(['Select', ...(offered.length > 0 ? offered : ['No Records'])]);
  });

  test('lists the delivery statuses with All first', async ({ rcsAdvancedPage }) => {
    await rcsAdvancedPage.open();

    const { params, offered, shown } = await rcsAdvancedPage.form.listOptions('Status');

    expect(params.get('field')).toBe('status');
    expect(offered[0]).toBe('All');
    expect(shown).toEqual(offered);
  });

  test('searches one campaign picked from the list', async ({ rcsAdvancedPage }) => {
    await rcsAdvancedPage.open();
    const [campaign] = (await rcsAdvancedPage.form.listOptions('Campaign Name')).offered;
    test.skip(campaign === undefined, 'No RCS campaigns ran yesterday or today.');
    await rcsAdvancedPage.form.select('Campaign Name', campaign);

    const report = await rcsAdvancedPage.form.search();

    expect(report.body.campaign_name).toEqual({ key: 'select', value: campaign });
    expect(report.docs.length).toBeGreaterThan(0);
    expect(report.docs.map((doc) => doc.campaign_name)).toEqual(report.docs.map(() => campaign));
    await rcsAdvancedPage.table.expectRowsOf(report);
  });

  test('searches campaigns whose name contains text', async ({ rcsAdvancedPage }) => {
    await rcsAdvancedPage.open();
    const [campaign] = (await rcsAdvancedPage.form.listOptions('Campaign Name')).offered;
    test.skip(campaign === undefined, 'No RCS campaigns ran yesterday or today.');
    const part = campaign.slice(0, 9);
    await rcsAdvancedPage.form.contains('Campaign Name', part);

    const report = await rcsAdvancedPage.form.search();

    expect(report.body.campaign_name).toEqual({ key: 'contains', value: part });
    expect(report.docs.length).toBeGreaterThan(0);
    expect(report.docs.every((doc) => String(doc.campaign_name).includes(part))).toBe(true);
    await rcsAdvancedPage.table.expectRowsOf(report);
  });

  test('leaves out campaigns whose name contains text', async ({ rcsAdvancedPage }) => {
    await rcsAdvancedPage.open();
    const [campaign] = (await rcsAdvancedPage.form.listOptions('Campaign Name')).offered;
    test.skip(campaign === undefined, 'No RCS campaigns ran yesterday or today.');
    const part = campaign.slice(0, 9);
    await rcsAdvancedPage.form.doesNotContain('Campaign Name', part);

    const report = await rcsAdvancedPage.form.search();

    expect(report.body.campaign_name).toEqual({ key: 'not_contains', value: part });
    expect(report.docs.some((doc) => String(doc.campaign_name).includes(part))).toBe(false);
    await rcsAdvancedPage.table.expectRowsOf(report);
  });

  test('searches recipients whose number contains at least 7 digits', async ({ rcsAdvancedPage }) => {
    await rcsAdvancedPage.open();
    await rcsAdvancedPage.form.contains('Mobile Number', '9184480');

    const report = await rcsAdvancedPage.form.search();

    expect(report.body.recipient).toEqual({ key: 'contains', value: '9184480' });
    await rcsAdvancedPage.table.expectRowsOf(report);
  });

  test('refuses a mobile number shorter than 7 digits', async ({ rcsAdvancedPage }) => {
    await rcsAdvancedPage.open();
    await rcsAdvancedPage.form.contains('Mobile Number', '918448');

    await rcsAdvancedPage.form.expectSearchRefused('Please enter minimum 7 digits');
    await rcsAdvancedPage.expectNoResults();
  });

  test('searches one delivery status', async ({ rcsAdvancedPage }) => {
    await rcsAdvancedPage.open();
    await rcsAdvancedPage.form.select('Status', 'Delivered');

    const report = await rcsAdvancedPage.form.search();

    expect(report.body.status).toEqual({ key: 'select', value: 'Delivered' });
    await rcsAdvancedPage.table.expectRowsOf(report);
  });

  test('keeps the filters when the view changes', async ({ rcsAdvancedPage }) => {
    await rcsAdvancedPage.open();
    await rcsAdvancedPage.form.select('Status', 'Delivered');
    await rcsAdvancedPage.form.search();

    const report = await rcsAdvancedPage.table.viewBy('Date');

    expect(report.body.group_by).toBe('date');
    expect(report.body.status).toEqual({ key: 'select', value: 'Delivered' });
  });

  test('reloads from the first page when the page size changes', async ({ rcsAdvancedPage }) => {
    await rcsAdvancedPage.open();
    await rcsAdvancedPage.form.search();

    const report = await rcsAdvancedPage.table.setPageSize(25);

    // The page posts the chosen size as a string, unlike the number it posts on Search.
    expect(Number(report.body.limit)).toBe(25);
    expect(report.body.page).toBe(1);
  });
});

test.describe('RCS Advanced Search via API', () => {
  test('opens on yesterday to today with the API fields', async ({ rcsAdvancedPage }) => {
    await rcsAdvancedPage.open();
    await rcsAdvancedPage.openViaApi();

    await rcsAdvancedPage.form.expectDates(daysAgo(1), daysAgo(0));
    await rcsAdvancedPage.form.expectFields(apiFields);
    await rcsAdvancedPage.form.expectCountedBy('Submission');
    await rcsAdvancedPage.expectNoResults();
  });

  test('searches API submissions by date', async ({ rcsAdvancedPage }) => {
    await rcsAdvancedPage.open();
    await rcsAdvancedPage.openViaApi();

    const report = await rcsAdvancedPage.form.search();

    expect(report.body).toEqual({ ...defaultSearch, group_by: 'date' });
    await rcsAdvancedPage.table.expectActiveView('Date');
    await rcsAdvancedPage.table.expectColumnsOf(report);
    await rcsAdvancedPage.table.expectRowsOf(report);
    await rcsAdvancedPage.table.expectTotalsOf(report);
    await rcsAdvancedPage.form.expectCollapsed();
  });

  test('offers the views the API configures', async ({ rcsAdvancedPage }) => {
    await rcsAdvancedPage.open();
    await rcsAdvancedPage.openViaApi();

    const report = await rcsAdvancedPage.form.search();

    expect(report.viewByOptions.tabs).toEqual(apiOptions.tabs);
    expect(apiOptions.more).toEqual(expect.arrayContaining(report.viewByOptions.more));
    await rcsAdvancedPage.table.expectViewByOptions(report.viewByOptions);
  });

  for (const [view, groupBy] of apiViews.slice(1)) {
    test(`shows the ${view} view with the columns the API returned`, async ({ rcsAdvancedPage }) => {
      await rcsAdvancedPage.open();
      await rcsAdvancedPage.openViaApi();
      const opened = await rcsAdvancedPage.form.search();
      test.skip(!viewsOf(opened).includes(view), 'This account is not offered this view.');

      const report = await rcsAdvancedPage.table.viewBy(view);

      expect(report.body.group_by).toBe(groupBy);
      await rcsAdvancedPage.table.expectActiveView(view);
      await rcsAdvancedPage.table.expectColumnsOf(report);
      await rcsAdvancedPage.table.expectRowsOf(report);
      await rcsAdvancedPage.table.expectTotalsOf(report);
    });
  }

  test('lists the agents that sent API messages in the period', async ({ rcsAdvancedPage }) => {
    await rcsAdvancedPage.open();
    await rcsAdvancedPage.openViaApi();

    const { params, offered, shown } = await rcsAdvancedPage.form.listOptions('Agent');

    expect(params.get('field')).toBe('agent_name');
    expect(params.get('from_date')).toBe(isoDate(daysAgo(1)));
    expect(params.get('to_date')).toBe(isoDate(daysAgo(0)));
    // An empty list says so under its Select entry.
    expect(shown).toEqual(['Select', ...(offered.length > 0 ? offered : ['No Records'])]);
  });

  test('searches by tag and GUID', async ({ rcsAdvancedPage }) => {
    await rcsAdvancedPage.open();
    await rcsAdvancedPage.openViaApi();
    await rcsAdvancedPage.form.fill('Tags', 'automation');
    await rcsAdvancedPage.form.fill('GUID', 'no-such-guid');

    const report = await rcsAdvancedPage.form.search();

    expect(report.body.tag).toEqual({ key: 'equal', value: 'automation' });
    expect(report.body.guid).toEqual({ key: 'equal', value: 'no-such-guid' });
    await rcsAdvancedPage.table.expectRowsOf(report);
    await rcsAdvancedPage.table.expectTotalsOf(report);
  });
});
