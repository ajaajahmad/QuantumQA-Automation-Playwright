import type { Page, Request } from '@playwright/test';

// The summary reports build their view-by options and table columns from the response, so
// tests compare the screen with the response instead of hard-coding this account's columns.

export type ViewByOption = { label: string; value: string };

export type ReportDateRange = { from_date: string; to_date: string };

// A cell shows one value, or the domestic and international counts stacked in a nationality column.
export type ReportCell = string | [string, string];

export type ReportResponse = {
  // The query string of a GET report, or the JSON body of a POST one (advanced search).
  params: URLSearchParams;
  body: Record<string, unknown>;
  dateRange: ReportDateRange[];
  viewByOptions: { tabs: string[]; more: string[] };
  columns: string[];
  // One entry per data row on this page, keyed by column.
  docs: Record<string, unknown>[];
  total: number;
  // What each data row and the two totals rows should show, column by column. A cell is
  // undefined when the response carries no value for it, e.g. the Type column's static labels.
  rows: (ReportCell | undefined)[][];
  totals: { page: (ReportCell | undefined)[]; grand: (ReportCell | undefined)[] };
};

type ColumnConfig = { label: string; order?: number; nationality?: boolean };

type ReportBody = {
  success: boolean;
  status_code: number;
  message: string;
  view_by_config: { list_items: ViewByOption[]; more_items?: ViewByOption[] };
  columns_config: Record<string, ColumnConfig>;
  data: {
    total: number;
    docs: Record<string, unknown>[];
    labels: Record<string, string>;
    page_total?: Record<string, unknown>;
    grand_total?: Record<string, unknown>;
  };
};

// The table orders columns_config by its order field, except the failure and rejected reasons
// views, whose columns are the reasons themselves and come from data.labels.
function columnEntries(groupBy: string | null, body: ReportBody): [string, ColumnConfig][] {
  if (groupBy === 'failure_reason' || groupBy === 'rejected_reason') {
    return Object.entries(body.data.labels).map(([key, label]) => [key, { label }]);
  }

  return Object.entries(body.columns_config).sort(([, a], [, b]) => (a.order ?? 0) - (b.order ?? 0));
}

// A nationality column stacks the domestic and international variants of its key:
// count_x -> count_n_x / count_i_x, currency_used -> n_currency_used / i_currency_used.
function nationalityKeys(key: string): [string, string] {
  if (key.startsWith('count_')) {
    return [key.replace('count_', 'count_n_'), key.replace('count_', 'count_i_')];
  }

  return [`n_${key}`, `i_${key}`];
}

// The table shows whole numbers as they are and fractions to 4 decimals (1.4 as 1.4000), which
// also hides the floating-point noise in the API's totals (1.8491999999999997 as 1.8492).
function cellText(value: unknown): string {
  if (typeof value === 'number' && !Number.isInteger(value)) {
    return value.toFixed(4);
  }

  return String(value);
}

function cellOf(record: Record<string, unknown>, key: string, column: ColumnConfig): ReportCell | undefined {
  if (column.nationality) {
    const [domestic, international] = nationalityKeys(key);

    if (!(domestic in record) || !(international in record)) {
      return undefined;
    }

    return [cellText(record[domestic]), cellText(record[international])];
  }

  if (!(key in record) || record[key] === null) {
    return undefined;
  }

  return cellText(record[key]);
}

function rowOf(record: Record<string, unknown> | undefined, columns: [string, ColumnConfig][]): (ReportCell | undefined)[] {
  return columns.map(([key, column]) => (record ? cellOf(record, key, column) : undefined));
}

// The totals rows carry their own label ("Grand Total") in the first column, not a value.
function totalsRowOf(record: Record<string, unknown> | undefined, columns: [string, ColumnConfig][]): (ReportCell | undefined)[] {
  return rowOf(record, columns).map((cell, index) => (index === 0 ? undefined : cell));
}

function dateRangeOf(params: URLSearchParams, body: Record<string, unknown>): ReportDateRange[] {
  const dateRange = params.get('date_range');

  if (dateRange) {
    return JSON.parse(dateRange) as ReportDateRange[];
  }

  const fromDate = params.get('from_date') ?? body.from_date;
  const toDate = params.get('to_date') ?? body.to_date;

  if (typeof fromDate === 'string' && typeof toDate === 'string') {
    return [{ from_date: fromDate, to_date: toDate }];
  }

  return [];
}

async function readReport(request: Request): Promise<ReportResponse> {
  const response = await request.response();

  if (!response?.ok()) {
    throw new Error(`${request.url()} failed with ${response?.status()}`);
  }

  const report = (await response.json()) as ReportBody;

  // The API reports its own failures inside a 200, e.g. status_code 503 "Something went wrong".
  if (!report.success) {
    throw new Error(`${request.url()} answered ${report.status_code}: ${report.message}`);
  }

  const params = new URL(request.url()).searchParams;
  const body = (request.method() === 'POST' ? request.postDataJSON() : {}) as Record<string, unknown>;
  const groupBy = params.get('group_by') ?? (typeof body.group_by === 'string' ? body.group_by : null);
  const columns = columnEntries(groupBy, report);

  return {
    params,
    body,
    dateRange: dateRangeOf(params, body),
    viewByOptions: {
      tabs: report.view_by_config.list_items.map((item) => item.label),
      more: (report.view_by_config.more_items ?? []).map((item) => item.label),
    },
    columns: columns.map(([, column]) => column.label),
    docs: report.data.docs,
    total: report.data.total,
    rows: report.data.docs.map((doc) => rowOf(doc, columns)),
    totals: {
      page: totalsRowOf(report.data.page_total, columns),
      grand: totalsRowOf(report.data.grand_total, columns),
    },
  };
}

// Runs the action and returns the first report it requests. The page loads each report twice
// on open, so waiting for a request issued after the action skips any still-pending load.
export async function waitForReport(
  page: Page,
  paths: string[],
  action: () => Promise<unknown>,
): Promise<ReportResponse> {
  const request = page.waitForRequest(
    (candidate) =>
      ['GET', 'POST'].includes(candidate.method()) && paths.includes(new URL(candidate.url()).pathname),
  );
  await action();
  return readReport(await request);
}
