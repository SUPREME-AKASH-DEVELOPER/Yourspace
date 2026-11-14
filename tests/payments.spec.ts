import { test, expect } from '@playwright/test';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { POST } from '../api/pay.js';
import { priceBooking, DECOR_PRICES, ADDON_PRICES, DECOR_SLOTS } from '../api/_prices.js';
import { quote, setups, slots, addonGroups, decorAvailable, MAX_GUESTS, requiredRules } from '../src/data/booking';

/**
 * Every case below is about price, not about when the decorator works. So they
 * all book a day well ahead, with the house rules ticked: the notice rule and
 * the rules checklist have their own tests in decoration.spec.ts.
 */
const SOON = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
const AHEAD = {
  // worked out from today, not written down: the server checks the notice
  // against its own clock, so a fixed date would quietly expire
  date: SOON,
  now: { iso: new Date().toISOString().slice(0, 10), minutes: 10 * 60 },
  agreed: requiredRules(),
};

/* These call the server code directly. Razorpay and Resend are stubbed: nobody is charged or emailed. */

test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'no browser involved');

/** decorations.ts imports photographs, so its prices are read from the source. */
const SITE_DECOR = Object.fromEntries(
  [...readFileSync(new URL('../src/data/decorations.ts', import.meta.url), 'utf8')
    .matchAll(/id: '([\w-]+)',\s*\n\s*name: '([^']+)',\s*\n\s*price: (\d+|null)/g)]
    .map(([, id, name, price]) => [id, { name, price: price === 'null' ? null : Number(price) }]),
);

test.describe('what the server charges', () => {
  test('every decoration and add-on is priced the same on the server as on the site', () => {
    expect(Object.keys(SITE_DECOR).sort()).toEqual(Object.keys(DECOR_PRICES).sort());
    for (const [id, d] of Object.entries(SITE_DECOR)) expect(DECOR_PRICES[id], id).toBe(d.price);
    const siteAddons = Object.fromEntries(addonGroups.flatMap((g) => g.options.map((o) => [o.id, o.price])));
    expect(ADDON_PRICES).toEqual(siteAddons);
  });

  test('decoration is offered only from 2:30 PM to before 9:30 PM, the same on both sides', () => {
    expect(slots.filter((x) => decorAvailable(x.id)).map((x) => x.id)).toEqual(DECOR_SLOTS);
    for (const x of slots) {
      const [h, m, ap] = x.start.split(/[: ]/);
      const mins = (Number(h) % 12 + (ap === 'PM' ? 12 : 0)) * 60 + Number(m);
      expect(decorAvailable(x.id), x.start).toBe(mins >= 14 * 60 + 30 && mins < 21 * 60 + 30);
    }
    expect(decorAvailable('s1'), 'not the first slot').toBe(false);
    expect(decorAvailable('s2'), 'not the second slot').toBe(false);
  });

  test('every booking the site can take online costs the same on the server', () => {
    const decorIds = Object.keys(SITE_DECOR);
    const addonSets: string[][] = [[], ...addonGroups.flatMap((g) => g.options.map((o) => [o.id])),
      ['bouquet-s', 'cake-chocolate'], ['bouquet-l', 'photo-15']];
    let checked = 0;
    for (const s of setups) {
      for (let guests = 1; guests <= MAX_GUESTS; guests++) {
        for (const slot of slots.map((x) => x.id)) {
          // the page sends a decoration only for a time that can have one
          const decorChoices = s.hasDecor && decorAvailable(slot) ? decorIds : [''];
          for (const decor of decorChoices) {
            for (const addons of s.hasAddons ? addonSets : [[]]) {
              const d = decor ? SITE_DECOR[decor] : null;
              const q = quote({ setup: s.id, guests, decor: d, addons });
              const payableOnSite = !q.blocked && q.unpriced.length === 0 && q.total > 0;
              const server = priceBooking({ setup: s.id, guests, slot, decor, addons, ...AHEAD, ...AHEAD });
              const label = `${s.id} × ${guests} ${slot} ${decor} ${addons.join(',')}`;
              if (payableOnSite) expect(server.amount, label).toBe(q.total);
              else expect(server.amount, label).toBeNull();
              checked++;
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  test('cannot be talked into a lower price', () => {
    expect(priceBooking({ setup: 'date', guests: 2, slot: 's4', decor: 'royal', addons: [], ...AHEAD }).amount).toBe(6500);
    expect(priceBooking({ setup: 'date', guests: 2, slot: 's4', decor: '', addons: [], ...AHEAD }).amount, 'decorated time needs one').toBeNull();
    expect(priceBooking({ setup: 'date', guests: 2, slot: 's1', decor: 'royal', addons: [], ...AHEAD }).amount, 'no decorator at noon').toBeNull();
    expect(priceBooking({ setup: 'date', guests: 2, slot: 's7', decor: '', addons: [], ...AHEAD }).amount).toBe(1500);
    expect(priceBooking({ setup: 'date', guests: 2, slot: 's4', decor: 'nothing', addons: [], ...AHEAD }).amount).toBeNull();
    expect(priceBooking({ setup: 'date', guests: 2, slot: 's4', decor: 'royal', addons: ['bouquet-s', 'bouquet-l'], ...AHEAD }).amount).toBeNull();
    expect(priceBooking({ setup: 'watch', guests: 2, ...AHEAD }).amount).toBeNull();
    expect(priceBooking({ setup: 'movie', guests: 0, ...AHEAD }).amount).toBeNull();
    expect(priceBooking({ setup: 'movie', guests: 2.5, ...AHEAD }).amount).toBeNull();
    expect(priceBooking({ setup: '__proto__', guests: 2, ...AHEAD }).amount).toBeNull();
    expect(priceBooking({ setup: 'date', guests: 2, slot: 's4', decor: 'toString', ...AHEAD }).amount).toBeNull();
  });
});

test.describe('the payment function', () => {
  test.describe.configure({ mode: 'serial' });

  const SECRET = 'test_secret_abc';
  const realFetch = globalThis.fetch;
  let razorpay: { url: string; body: any }[] = [];
  let emails: any[] = [];
  let paymentStatus = 'captured';

  test.beforeEach(() => {
    razorpay = []; emails = []; paymentStatus = 'captured';
    process.env.RAZORPAY_KEY_ID = 'rzp_live_TESTKEY';
    process.env.RAZORPAY_KEY_SECRET = SECRET;
    process.env.RESEND_API_KEY = 'test-key';
    globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
      const u = String(url);
      const body = init.body ? JSON.parse(String(init.body)) : null;
      if (u.startsWith('https://api.resend.com')) { emails.push(body); return Response.json({ id: 'e' }); }
      razorpay.push({ url: u, body });
      if (u.endsWith('/orders') && init.method === 'POST') return Response.json({ id: 'order_ABC', ...body });
      if (u.includes('/orders/order_ABC')) {
        return Response.json({ id: 'order_ABC', amount: 650000, receipt: 'YS-ABC234',
          notes: { booking_ref: 'YS-ABC234', name: 'Riya Sharma', phone: '9876543210', email: 'riya@example.com' } });
      }
      if (u.includes('/payments/pay_XYZ')) return Response.json({ id: 'pay_XYZ', order_id: 'order_ABC', amount: 650000, status: paymentStatus, method: 'upi' });
      return new Response('{}', { status: 404 });
    }) as typeof fetch;
  });
  test.afterEach(() => {
    globalThis.fetch = realFetch;
    delete process.env.RAZORPAY_KEY_ID; delete process.env.RAZORPAY_KEY_SECRET; delete process.env.RESEND_API_KEY;
  });

  const call = (body: unknown, origin = 'https://www.yourspacejbp.com') => POST(new Request('https://www.yourspacejbp.com/api/pay', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin, 'x-forwarded-for': crypto.randomUUID() },
    body: JSON.stringify(body),
  }));
  const sign = (o: string, p: string) => createHmac('sha256', SECRET).update(`${o}|${p}`).digest('hex');
  const order = { step: 'order', ref: 'YS-ABC234', name: 'Riya Sharma', phone: '9876543210', email: 'riya@example.com',
    setup: 'date', guests: 2, slot: 's4', decor: 'royal', addons: [], expected: 1,
    date: AHEAD.date, agreed: AHEAD.agreed };

  test('opens an order for the server price, whatever the page says', async () => {
    const res = await call(order);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, key: 'rzp_live_TESTKEY', order_id: 'order_ABC', amount: 6500 });
    expect(razorpay[0].body).toMatchObject({ amount: 650000, currency: 'INR', receipt: 'YS-ABC234' });
    expect(razorpay[0].body.notes).toMatchObject({ booking_ref: 'YS-ABC234', phone: '9876543210' });
  });

  test('refuses a booking that cannot be paid online, and other sites', async () => {
    expect((await call({ ...order, setup: 'watch' })).status).toBe(400);
    expect((await call({ ...order, ref: 'nope' })).status).toBe(400);
    expect((await call(order, 'https://evil.example')).status).toBe(403);
    expect(razorpay).toHaveLength(0);
  });

  test('without keys it says so, and charges nothing', async () => {
    delete process.env.RAZORPAY_KEY_SECRET;
    expect((await call(order)).status).toBe(503);
    expect(razorpay).toHaveLength(0);
  });

  test('a forged signature is refused, and nobody is told it was paid', async () => {
    const res = await call({ step: 'verify', order_id: 'order_ABC', payment_id: 'pay_XYZ', signature: 'f'.repeat(64) });
    expect(res.status).toBe(400);
    expect(emails).toHaveLength(0);
  });

  test('a real payment is checked with Razorpay, then the team and customer hear', async () => {
    const res = await call({ step: 'verify', order_id: 'order_ABC', payment_id: 'pay_XYZ', signature: sign('order_ABC', 'pay_XYZ') });
    expect(await res.json()).toEqual({ success: true, ref: 'YS-ABC234', amount: 6500, payment_id: 'pay_XYZ' });
    expect(emails).toHaveLength(2);
    expect(emails[0].subject).toBe('Payment received, YS-ABC234 · ₹6,500');
    expect(emails[0].html).toContain('verified with Razorpay');
    expect(emails[1].to).toEqual(['riya@example.com']);
    expect(emails[1].subject).toContain('Payment received');
    expect(emails[1].html).toContain('₹6,500');
  });

  test('a payment that failed at Razorpay is not called paid', async () => {
    paymentStatus = 'failed';
    const res = await call({ step: 'verify', order_id: 'order_ABC', payment_id: 'pay_XYZ', signature: sign('order_ABC', 'pay_XYZ') });
    expect(res.status).toBe(400);
    expect(emails).toHaveLength(0);
  });
});
