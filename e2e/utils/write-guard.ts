import type { BrowserContext, Page } from '@playwright/test';

export type BlockedRequest = { method: string; path: string; body: unknown };

// For the read-only admin specs: aborts every API request that would change data, so a test can
// click Save, Update, Submit or a delete confirmation and see what the page would send, without
// anything reaching the server. Returns the blocked requests in order, with their JSON bodies.
export async function blockWrites(page: Page): Promise<BlockedRequest[]> {
  const blocked: BlockedRequest[] = [];

  await page.route('**/api/**', async (route) => {
    const request = route.request();

    if (request.method() === 'GET') {
      await route.continue();
      return;
    }

    let body: unknown = request.postData();

    try {
      body = request.postDataJSON();
    } catch {
      // Not JSON; keep the raw text.
    }

    blocked.push({ method: request.method(), path: new URL(request.url()).pathname, body });
    await route.abort();
  });

  return blocked;
}

// For the App Push form specs, which must save a draft, upload and import contacts to reach the
// content step, but must not push anything: aborts Test Now (POST test-campaigns) and the send or
// schedule (PUT app-push-campaign/<id>), and returns them in order. It routes on the context
// rather than the page, and the specs block service workers, because a page route once let the
// create request through on staging.
export async function blockPushSends(context: BrowserContext): Promise<BlockedRequest[]> {
  const blocked: BlockedRequest[] = [];

  await context.route(/\/api\/v1\/app-push-campaign\/(test-campaigns|[0-9a-f]{24})$/, async (route) => {
    const request = route.request();

    if (request.method() === 'GET') {
      await route.continue();
      return;
    }

    blocked.push({ method: request.method(), path: new URL(request.url()).pathname, body: request.postDataJSON() });
    await route.abort();
  });

  return blocked;
}
