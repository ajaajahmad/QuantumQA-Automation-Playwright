import { expect, type Locator, type Page } from '@playwright/test';

// What the dialog shows, label by label, e.g. { 'Valid Contacts': '2' }.
export type PushSummary = Record<string, string>;

// What the server said to Send Now or Schedule.
export type PushSendResult = { success: boolean; message: string; status: string };

// The Campaign Summary dialog: Send opens it on the create page (after the server counts the
// valid contacts and the cost), and View opens it read-only from the campaign list.
export class PushCampaignSummaryDialog {
  private readonly dialog: Locator;
  private readonly items: Locator;
  private readonly closeButton: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.locator('.validate-modal');
    this.items = this.dialog.locator('.inside-modal-content .col-md-4');
    this.closeButton = this.dialog.locator('.header-modal .cursor-pointer');
  }

  async expectOpen(): Promise<void> {
    await expect(this.dialog.getByText('Campaign Summary', { exact: true })).toBeVisible();
  }

  async expectSummary(summary: PushSummary): Promise<void> {
    await this.expectOpen();

    for (const [label, value] of Object.entries(summary)) {
      // Labels can carry an info tooltip between them and the value, and values wrap ("INR 2").
      const shown = escapeRegExp(value).replace(/ /g, '\\s+');
      await expect(this.item(label)).toHaveText(new RegExp(`^\\s*${escapeRegExp(label)}[\\s\\S]*?\\s${shown}\\s*$`));
    }
  }

  async expectMessage(text: string): Promise<void> {
    await expect(this.dialog.getByText('Message Text - English')).toBeVisible();
    await expect(this.dialog.locator('textarea.validate-campaign-textarea')).toHaveValue(text);
  }

  // Send Now or Schedule, whichever the form asked for.
  async expectConfirm(button: 'Send Now' | 'Schedule'): Promise<void> {
    await expect(this.dialog.getByRole('button')).toHaveText([button]);
  }

  // The page leaves for the list as soon as the server answers, which can discard the reply
  // before it is read, so the reply is taken off the wire on its way to the page.
  async confirm(button: 'Send Now' | 'Schedule'): Promise<PushSendResult> {
    const sendRoute = /\/api\/v1\/app-push-campaign\/[0-9a-f]{24}$/;
    let reply: Promise<PushSendResult> | undefined;
    await this.page.route(sendRoute, async (route) => {
      if (route.request().method() !== 'PUT') {
        await route.fallback();
        return;
      }

      const response = await route.fetch();
      reply = response.json().then((body: { success: boolean; message: string; data?: { status?: string } }) => ({
        success: body.success,
        message: body.message,
        status: body.data?.status ?? '',
      }));
      await route.fulfill({ response });
    });

    await this.dialog.getByRole('button', { name: button, exact: true }).click();
    await expect.poll(() => reply !== undefined, { message: `the ${button} request` }).toBe(true);
    await this.page.unroute(sendRoute);
    return reply!;
  }

  // For the form specs, whose guard aborts the request: clicks without waiting for an answer.
  async clickConfirm(button: 'Send Now' | 'Schedule'): Promise<void> {
    await this.dialog.getByRole('button', { name: button, exact: true }).click();
  }

  async close(): Promise<void> {
    await this.closeButton.click();
    await expect(this.dialog).toBeHidden();
  }

  private item(label: string): Locator {
    return this.items.filter({ hasText: new RegExp(`^\\s*${escapeRegExp(label)}`) });
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
