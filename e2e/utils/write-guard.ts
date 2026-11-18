import type { Page } from '@playwright/test';

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
