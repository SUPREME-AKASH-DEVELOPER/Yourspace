import type { Page } from '@playwright/test';

/** Forms post to a real service; tests must never actually email anyone. */
export const ENDPOINT = /formsubmit\.co|api\.web3forms\.com/;

/** Accept every submission, and hand back what was posted. */
export async function mockDelivery(page: Page) {
  const sent: Record<string, string>[] = [];
  await page.route(ENDPOINT, async (route) => {
    sent.push(JSON.parse(route.request().postData() ?? '{}'));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: 'true', message: 'sent' }),
    });
  });
  return sent;
}

/** Make the post fail, to exercise the fallback. */
export async function failDelivery(page: Page) {
  await page.route(ENDPOINT, (route) => route.abort('failed'));
}
