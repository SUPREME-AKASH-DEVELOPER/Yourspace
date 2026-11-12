import type { Page } from '@playwright/test';

/**
 * Take exactly `n` seats in the picker, whatever is taken right now.
 * Each seat is its own toggle, so a head count is reached seat by seat —
 * recliners (1–5) first, then the bean bags (6–7), as the room fills.
 * Seats are added before any are given back, because the flow refuses to
 * leave nobody seated.
 */
export async function pickSeats(page: Page, n: number) {
  const want = new Set(Array.from({ length: n }, (_, i) => i + 1));
  const ids = [1, 2, 3, 4, 5, 6, 7];
  const taken = async (id: number) =>
    (await page.locator(`[data-seat="${id}"]`).getAttribute('aria-pressed')) === 'true';
  for (const id of ids) if (want.has(id) && !(await taken(id))) await page.locator(`[data-seat="${id}"]`).click();
  for (const id of ids) if (!want.has(id) && await taken(id)) await page.locator(`[data-seat="${id}"]`).click();
}

/** Forms post to a real service; tests must never actually email anyone. */
export const ENDPOINT = /\/api\/send|formsubmit\.co|api\.web3forms\.com/;


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
  // tests never load the real Razorpay checkout; mockRazorpay() stands in for it
  await page.route('https://checkout.razorpay.com/**', (route) => route.abort('blockedbyclient'));
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

export type RazorpayMode = 'pay' | 'dismiss' | 'unavailable' | 'unverified';

/**
 * Stand in for Razorpay: /api/pay answers as the server would, and a fake
 * checkout.js either "pays" straight away or is closed without paying.
 * Returns every body posted to /api/pay.
 */
export async function mockRazorpay(page: Page, mode: RazorpayMode = 'pay') {
  const calls: Record<string, any>[] = [];
  await page.route('**/api/pay', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}');
    calls.push(body);
    if (mode === 'unavailable') return route.fulfill({ status: 503, json: { success: false } });
    if (body.step === 'order') {
      return route.fulfill({ json: { success: true, key: 'rzp_test_key', order_id: 'order_TEST123', amount: body.expected } });
    }
    if (mode === 'unverified') return route.fulfill({ status: 400, json: { success: false } });
    return route.fulfill({ json: { success: true, ref: 'x', amount: 1500, payment_id: body.payment_id } });
  });
  const act = mode === 'dismiss'
    ? 'o.modal.ondismiss()'
    : 'o.handler({ razorpay_payment_id: "pay_TEST12345678", razorpay_order_id: o.order_id, razorpay_signature: "sig" })';
  await page.route('https://checkout.razorpay.com/**', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `window.Razorpay = function (o) { this.o = o; };
      window.Razorpay.prototype.on = function () {};
      window.Razorpay.prototype.open = function () { var o = this.o; window.__rzpOptions = o; setTimeout(function () { ${act}; }, 50); };`,
  }));
  return calls;
}
