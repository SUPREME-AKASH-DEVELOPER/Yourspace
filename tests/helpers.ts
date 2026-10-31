import type { Page } from '@playwright/test';

/** Forms post to a real service; tests must never actually email anyone. */
export const ENDPOINT = /formsubmit\.co|api\.web3forms\.com/;


/** The site posts JSON to FormSubmit and multipart to Web3Forms; read either. */
export function readBody(raw: string | null): Record<string, string> {
  if (!raw) return {};
  const text = raw.trim();
  if (text.startsWith('{')) {
    try { return JSON.parse(text); } catch { return {}; }
  }
  // multipart/form-data: pull each name="..." part and the value after it
  const out: Record<string, string> = {};
  for (const m of text.matchAll(/name="([^"]+)"\r?\n\r?\n([\s\S]*?)\r?\n--/g)) {
    out[m[1]] = m[2];
  }
  return out;
}

/** Accept every submission, and hand back what was posted. */
export async function mockDelivery(page: Page) {
  const sent: Record<string, string>[] = [];
  await page.route(ENDPOINT, async (route) => {
    sent.push(readBody(route.request().postData()));
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
