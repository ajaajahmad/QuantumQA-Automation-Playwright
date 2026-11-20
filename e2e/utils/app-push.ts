import fs from 'node:fs';
import path from 'node:path';
import type { APIRequestContext } from '@playwright/test';
import { isoDate } from './date-time';

// One recipient row of an App Push contacts file. The import asks which column holds the device
// token and which the device identifier (ANDROID or IOS); the other columns can personalise the
// message.
export type PushRecipient = {
  deviceToken: string;
  device: 'ANDROID' | 'IOS';
  name: string;
  url: string;
};

export const recipientColumns = ['Device Token', 'Device Identifier', 'Name', 'URL'];

// The integrations the account can send through, as the create page's App Name list offers them.
export type PushApp = {
  id: number;
  app_name: string;
  service_provider: string;
  certificate_type: string;
  is_active: number;
};

// One campaign as the list endpoint returns it. Drafts are not listed.
export type PushCampaign = {
  _id: string;
  name: string;
  status: string;
  category_name: string;
  created_by_user_name: string;
  created_at: string;
  sent_at?: string;
  count?: number;
  is_delete: boolean;
  is_view: boolean;
};

// One row of the App Push summary report, keyed by column.
export type PushReportRow = Record<string, unknown> & {
  count_total: number;
  count_sent: number;
  count_delivered: number;
  count_failed: number;
  count_awaiting: number;
  count_rejected: number;
};

const recipientsDir = path.resolve(__dirname, '../../artifacts/app-push');

// Writes the rows to a CSV under artifacts/ (gitignored), so the token never lands in the repo,
// and returns its path. Values here never hold commas or quotes.
export function writeRecipientsFile(recipients: PushRecipient[], name = `recipients_${Date.now()}`): string {
  fs.mkdirSync(recipientsDir, { recursive: true });
  const filePath = path.join(recipientsDir, `${name}.csv`);
  const rows = recipients.map((recipient) =>
    [recipient.deviceToken, recipient.device, recipient.name, recipient.url].join(','),
  );
  fs.writeFileSync(filePath, `${[recipientColumns.join(','), ...rows].join('\n')}\n`, 'utf8');
  return filePath;
}

// One Android and one iOS recipient on the same token.
export function bothDevices(deviceToken: string): PushRecipient[] {
  return [
    { deviceToken, device: 'ANDROID', name: 'QA Android', url: 'https://example.com/android' },
    { deviceToken, device: 'IOS', name: 'QA iOS', url: 'https://example.com/ios' },
  ];
}

export async function pushApps(api: APIRequestContext): Promise<PushApp[]> {
  const response = await api.get('/api/v1/app-push-configurations/options');
  return ((await response.json()) as { data: PushApp[] }).data;
}

export async function pushCampaigns(api: APIRequestContext, name = ''): Promise<PushCampaign[]> {
  const response = await api.post('/api/v1/app-push-campaign/getCampaigns', {
    data: { name, page: 1, limit: 100, sort: '', order: '' },
  });
  return ((await response.json()) as { data: { docs: PushCampaign[] } }).data.docs;
}

// Deletes every campaign of that name the list still offers to delete (scheduled ones; sent ones
// can't be). The send spec's safety net, so a failed run leaves nothing to go out later.
export async function deleteScheduledPushCampaigns(api: APIRequestContext, name: string): Promise<string[]> {
  const deleted: string[] = [];

  for (const campaign of await pushCampaigns(api, name)) {
    if (campaign.name === name && campaign.is_delete) {
      const response = await api.delete(`/api/v1/app-push-campaign/${campaign._id}`);
      if (response.ok()) deleted.push(campaign._id);
    }
  }

  return deleted;
}

// The summary report for one view over the given days, optionally filtered, e.g.
// { campaign_name: 'x' }. The report counts each message, test sends included.
export async function pushReport(
  api: APIRequestContext,
  groupBy: string,
  from: Date,
  to: Date,
  filters: Record<string, string> = {},
): Promise<PushReportRow[]> {
  const response = await api.get('/api/v1/app-push-mis/viewby-campaign', {
    params: {
      page: 1,
      limit: 100,
      view_counts_by: 'msg_splits',
      group_by: groupBy,
      date_range: JSON.stringify([{ from_date: isoDate(from), to_date: isoDate(to) }]),
      filter_type: 'custom',
      ...filters,
    },
  });
  return ((await response.json()) as { data: { docs: PushReportRow[] } }).data.docs;
}
