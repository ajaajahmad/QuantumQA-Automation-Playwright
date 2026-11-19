import { expect, type Locator, type Page } from '@playwright/test';
import type { PushCampaign } from '../../utils/app-push';
import { appConfig } from '../../utils/config';
import { DeleteConfirmationDialog } from '../components/delete-confirmation.dialog';
import { PushCampaignSummaryDialog } from './push-campaign-summary.dialog';

export type PushCampaignList = { docs: PushCampaign[]; total: number };

// The row actions, by their titles. Which are enabled depends on the campaign's status.
export type PushAction = 'Stop' | 'Pause' | 'View' | 'Edit Schedule' | 'Delete';

// APP Push > Campaigns: sent and scheduled campaigns (drafts are not listed), filled by
// POST app-push-campaign/getCampaigns.
export class PushCampaignsPage {
  readonly summary: PushCampaignSummaryDialog;
  readonly deleteConfirmationDialog: DeleteConfirmationDialog;

  private readonly heading: Locator;
  private readonly createButton: Locator;
  private readonly filterBar: Locator;
  private readonly headers: Locator;
  private readonly rows: Locator;
  private readonly noRecords: Locator;
  private readonly totalRecords: Locator;

  constructor(private readonly page: Page) {
    this.summary = new PushCampaignSummaryDialog(page);
    this.deleteConfirmationDialog = new DeleteConfirmationDialog(page);
    this.heading = page.getByText('App Push Campaigns', { exact: true });
    this.createButton = page.getByRole('button', { name: 'Create Campaign' });
    this.filterBar = page.locator('app-table-more-filter');
    this.headers = page.locator('thead th');
    this.rows = page.locator('tbody tr');
    this.noRecords = page.getByText('No records found');
    this.totalRecords = page.getByText(/Total Records :-/);
  }

  // Returns the list the table was built from.
  async open(): Promise<PushCampaignList> {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (candidate) =>
          candidate.request().method() === 'POST' && new URL(candidate.url()).pathname.endsWith('/app-push-campaign/getCampaigns'),
      ),
      this.page.goto(new URL('/campaigns/app-push', appConfig.appUrl).toString(), { waitUntil: 'domcontentloaded' }),
    ]);
    await expect(this.heading).toBeVisible();
    return ((await response.json()) as { data: PushCampaignList }).data;
  }

  // Saves a draft and opens it on the create page; returns the draft's id.
  async createCampaign(): Promise<string> {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (candidate) =>
          candidate.request().method() === 'POST' && /\/api\/v1\/app-push-campaign$/.test(new URL(candidate.url()).pathname),
      ),
      this.createButton.click(),
    ]);
    const { data } = (await response.json()) as { data: { _id: string; status: string } };
    expect(data.status).toBe('draft');
    await expect(this.page).toHaveURL(new RegExp(`/campaigns/app-push/create/${data._id}$`));
    return data._id;
  }

  async expectColumns(columns: string[]): Promise<void> {
    await expect(this.headers).toHaveText(columns);
  }

  async expectFilters(filters: string[]): Promise<void> {
    await expect(this.filterBar.locator('button.filter-btn > span:first-child')).toHaveText(filters);
  }

  // One row per campaign, in the order the API returned them: name, creation and submission
  // times, and who created it.
  async expectRowsOf(list: PushCampaignList): Promise<void> {
    if (list.docs.length === 0) {
      await expect(this.noRecords).toBeVisible();
      await expect(this.totalRecords).toHaveText(/Total Records :-\s*0\b/);
      return;
    }

    await expect(this.rows).toHaveCount(list.docs.length);
    await expect(this.totalRecords).toHaveText(new RegExp(`Total Records :-\\s*${list.total}\\b`));

    for (const [index, campaign] of list.docs.entries()) {
      await expect(this.rows.nth(index).locator('td')).toHaveText([
        campaign.name,
        campaign.created_at,
        campaign.sent_at ?? '',
        campaign.created_by_user_name,
        '',
      ]);
    }
  }

  // The actions a row offers enabled; the rest show greyed out. The cell also holds icons of other
  // lists (Mark As Default), so only the campaign actions are read.
  async enabledActions(name: string): Promise<PushAction[]> {
    const icons = this.row(name).locator('.custom-action-icons > span.actions-icon, .custom-action-icons > span.icon-interface-3');
    await expect(icons.first()).toBeVisible();
    const actions = await icons.evaluateAll((elements) =>
      elements
        .filter((element) => !element.classList.contains('disabled'))
        .map((element) => element.getAttribute('title')),
    );
    return actions as PushAction[];
  }

  async openSummary(name: string): Promise<void> {
    await this.row(name).locator('span.icon-interface-3').click();
    await this.summary.expectOpen();
  }

  // A scheduled campaign can be deleted before it goes out, after the shared confirmation.
  // Returns what the server said.
  async deleteCampaign(name: string): Promise<{ success: boolean; message: string }> {
    await this.row(name).locator('span.icon-Delete').click();
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (candidate) => candidate.request().method() === 'DELETE' && candidate.url().includes('/app-push-campaign/'),
      ),
      this.deleteConfirmationDialog.confirm(),
    ]);
    const body = (await response.json()) as { success: boolean; message: string };
    return { success: body.success, message: body.message };
  }

  async expectNoRow(name: string): Promise<void> {
    await expect(this.row(name)).toHaveCount(0);
  }

  private row(name: string): Locator {
    return this.rows.filter({ has: this.page.getByText(name, { exact: true }) });
  }
}
