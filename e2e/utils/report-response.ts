import type { Page, Request } from '@playwright/test';

// The summary reports build their view-by options and table columns from the response, so
// tests compare the screen with the response instead of hard-coding this account's columns.

export type ViewByOption = { label: string; value: string };

export type ReportDateRange = { from_date: string; to_date: string };

export type ReportResponse = {
  params: URLSearchParams;
  dateRange: ReportDateRange[];
  viewByOptions: { tabs: string[]; more: string[] };
  columns: string[];
  // One entry per data row on this page, keyed by column.
  docs: Record<string, unknown>[];
  total: number;
};

type ReportBody = {
  view_by_config: { list_items: ViewByOption[]; more_items?: ViewByOption[] };
  columns_config: Record<string, { label: string; order?: number }>;
  data: { total: number; docs: Record<string, unknown>[]; labels: Record<string, string> };
};

// The table orders columns_config by its order field, except the failure and rejected reasons
// views, whose columns are the reasons themselves and come from data.labels.
function columnLabels(groupBy: string | null, body: ReportBody): string[] {
  if (groupBy === 'failure_reason' || groupBy === 'rejected_reason') {
    return Object.values(body.data.labels);
  }

  return Object.values(body.columns_config)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((column) => column.label);
}

async function readReport(request: Request): Promise<ReportResponse> {
  const response = await request.response();

  if (!response?.ok()) {
    throw new Error(`${request.url()} failed with ${response?.status()}`);
  }

  const body = (await response.json()) as ReportBody;
  const params = new URL(request.url()).searchParams;

  return {
    params,
    dateRange: JSON.parse(params.get('date_range') ?? '[]') as ReportDateRange[],
    viewByOptions: {
      tabs: body.view_by_config.list_items.map((item) => item.label),
      more: (body.view_by_config.more_items ?? []).map((item) => item.label),
    },
    columns: columnLabels(params.get('group_by'), body),
    docs: body.data.docs,
    total: body.data.total,
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
    (candidate) => candidate.method() === 'GET' && paths.includes(new URL(candidate.url()).pathname),
  );
  await action();
  return readReport(await request);
}
