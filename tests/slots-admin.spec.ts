import { test, expect, type Page } from '@playwright/test';
import { mockDelivery, pickSeats } from './helpers';
import { clashes, slots, fitsBeforeClose, MOVIE_MINUTES } from '../src/data/booking';

/* Tanishk, 18 Nov 2026: Movie Space is a 3-hour slot, already-booked times are
   greyed out on the site, and the team runs bookings from /admin/. */

test.describe('Movie Space is three hours', () => {
  test('the rule, on its own', () => {
    expect(MOVIE_MINUTES).toBe(180);
    expect(fitsBeforeClose('s6', 'movie'), '8:45 PM ends 11:45 PM').toBe(true);
    expect(fitsBeforeClose('s7', 'movie'), '10:30 PM would end 1:30 AM').toBe(false);
    expect(fitsBeforeClose('s7', 'date')).toBe(true);
    // a movie at noon holds the room until 3:15 PM, so 1:45 PM is gone and 3:30 PM is not
    const noonMovie: [number, number][] = [[720, 720 + 180 + 15]];
    expect(clashes(noonMovie, 's2', 'date')).toBe(true);
    expect(clashes(noonMovie, 's3', 'date')).toBe(false);
    // a movie cannot start at 12 PM when 1:45 PM is already taken
    expect(clashes([[825, 930]], 's1', 'movie')).toBe(true);
    expect(clashes([[825, 930]], 's1', 'date')).toBe(false);
    expect(slots).toHaveLength(7);
  });
});

async function flow(page: Page, busy: [number, number][]) {
  await mockDelivery(page);
  await page.route('**/api/slots**', (r) => r.fulfill({ json: { success: true, store: true, busy } }));
  await page.goto('/book/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('[data-exp-pick="watch"]').click();
  await pickSeats(page, 2);
  await page.locator('[data-date-pick]').nth(2).click();
  await page.locator('[data-bk-next]').click();
}

test.describe('the booking flow', () => {
  test('a booked time is greyed out and says so', async ({ page }) => {
    await flow(page, [[720, 825]]);
    await expect(page.locator('[data-slot-pick="s1"]')).toBeDisabled();
    await expect(page.locator('[data-slot-pick="s1"]')).toContainText('Booked');
    await expect(page.locator('[data-slot-pick="s2"]')).toBeEnabled();
  });

  test('Movie Space shows as 3 hours, and cannot start at 10:30 PM', async ({ page }) => {
    await flow(page, []);
    await page.locator('[data-slot-pick="s7"]').click();
    const movie = page.locator('[data-setup-pick="movie"]');
    await expect(movie).toContainText('3 hours');
    await expect(movie).toHaveClass(/is-blocked/);
    await expect(movie).toContainText('we close at midnight');
  });

  test('Movie Space is refused when the slot after is taken, and runs 3 hours when free', async ({ page }) => {
    await flow(page, [[825, 930]]);                 // 1:45 PM is booked
    await page.locator('[data-slot-pick="s1"]').click();
    await expect(page.locator('[data-setup-pick="movie"]')).toContainText('already booked');
    await page.locator('[data-bk-back]').click();
    await page.locator('[data-slot-pick="s5"]').click();   // 7:00 PM, nothing after it
    await page.locator('[data-setup-pick="movie"]').click();
    await expect(page.locator('#bkTotal, .bk-body').first()).toBeVisible();
    await expect(page.locator('.bk-body')).toContainText('7:00 PM – 10:00 PM');
  });

  test('with no bookings database the flow works exactly as before', async ({ page }) => {
    await mockDelivery(page);
    await page.route('**/api/slots**', (r) => r.fulfill({ status: 404, body: 'not here' }));
    await page.goto('/book/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('[data-exp-pick="date"]').click();
    await pickSeats(page, 2);
    await page.locator('[data-date-pick]').nth(2).click();
    await page.locator('[data-bk-next]').click();
    for (const s of slots) await expect(page.locator(`[data-slot-pick="${s.id}"]`)).toBeEnabled();
  });

  test('the booking carries its data for the dashboard', async ({ page }) => {
    const sent = await mockDelivery(page);
    await page.route('**/api/slots**', (r) => r.fulfill({ json: { success: true, store: true, busy: [] } }));
    await page.goto('/book/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('[data-exp-pick="watch"]').click();
    await pickSeats(page, 2);
    await page.locator('[data-date-pick]').nth(2).click();
    await page.locator('[data-bk-next]').click();
    await page.locator('[data-slot-pick="s3"]').click();
    await page.locator('[data-setup-pick="movie"]').click();
    await page.fill('#bName', 'Akash Rai');
    await page.fill('#bPhone', '9876543210');
    await page.fill('#bEmail', 'a@example.com');
    await page.locator('input[name=bkPay][value=later]').check();
    for (const box of await page.locator('[data-rule]').all()) await box.check();
    await page.locator('[data-bk-next]').click();
    await expect.poll(() => sent.length).toBe(1);
    const rec = JSON.parse((sent[0] as Record<string, string>)._booking);
    expect(rec).toMatchObject({ slot: 's3', setup: 'movie', guests: 2, name: 'Akash Rai', phone: '9876543210' });
    expect((sent[0] as Record<string, string>)['Date & time']).toContain('3:30 PM – 6:30 PM');
  });
});

test.describe('the dashboard API', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'no browser involved');

  const O = 'https://www.yourspacejbp.com';
  let send: typeof import('../api/send.js');
  let slotsApi: typeof import('../api/slots.js');
  let admin: typeof import('../api/admin.js');
  let store: typeof import('../api/_store.js');
  let cookie = '';

  const post = (mod: { POST: (r: Request) => Promise<Response> }, body: unknown, headers: Record<string, string> = {}) =>
    mod.POST(new Request(`${O}/api/x`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: O, 'x-forwarded-for': crypto.randomUUID(), ...headers },
      body: JSON.stringify(body),
    }));
  const busy = async (date: string) =>
    (await (await slotsApi.GET(new Request(`${O}/api/slots?date=${date}`))).json()).busy;

  const rec = {
    ref: 'YS-ABCDE2', date: '2030-01-10', slot: 's1', setup: 'movie', guests: 3,
    name: 'Riya', phone: '9876543210', email: 'r@example.com', total: '₹1,500', pay: 'later',
  };

  test.beforeAll(async () => {
    process.env.YS_STORE = 'memory';
    process.env.ADMIN_PASSWORD = 'test-password';
    send = await import('../api/send.js');
    slotsApi = await import('../api/slots.js');
    admin = await import('../api/admin.js');
    store = await import('../api/_store.js');
    store._resetMemory();
  });
  test.afterAll(() => {
    delete process.env.YS_STORE;
    delete process.env.ADMIN_PASSWORD;
  });

  test('a website booking is saved, even before email, and blocks its time', async () => {
    await post(send, { Name: 'Riya', Phone: '9876543210', _booking: JSON.stringify(rec) });
    expect(await busy('2030-01-10')).toEqual([[720, 915]]);
    // sending again does not make a second copy
    await post(send, { Name: 'Riya', Phone: '9876543210', _booking: JSON.stringify(rec) });
    expect((await store.listBookings()).length).toBe(1);
  });

  test('the slots answer says only when, never who', async () => {
    const body = JSON.stringify(await (await slotsApi.GET(new Request(`${O}/api/slots?date=2030-01-10`))).json());
    expect(body).not.toContain('Riya');
    expect(body).not.toContain('9876543210');
  });

  test('the dashboard needs the password', async () => {
    expect((await admin.GET(new Request(`${O}/api/admin`))).status).toBe(401);
    expect((await post(admin, { action: 'login', password: 'wrong' })).status).toBe(401);
    expect((await post(admin, { action: 'login', password: 'test-password' }, { origin: 'https://evil.example' })).status).toBe(403);
    const ok = await post(admin, { action: 'login', password: 'test-password' });
    expect(ok.status).toBe(200);
    const set = ok.headers.get('set-cookie') ?? '';
    expect(set).toMatch(/HttpOnly/);
    expect(set).toMatch(/SameSite=Strict/);
    cookie = set.split(';')[0];
    expect(cookie.split('=')[1].length).toBeGreaterThan(20);
    // a forged cookie is not a login
    const forged = `ys_admin=${Math.floor(Date.now() / 1000) + 999}.AAAA`;
    expect((await admin.GET(new Request(`${O}/api/admin`, { headers: { cookie: forged } }))).status).toBe(401);
    const list = await (await admin.GET(new Request(`${O}/api/admin`, { headers: { cookie } }))).json();
    expect(list.bookings).toHaveLength(1);
  });

  test('a phone booking cannot land on a taken time unless forced', async () => {
    const clash = await post(admin, { action: 'create', booking: { name: 'Aman', phone: '9123456789', date: '2030-01-10', slot: 's2', setup: 'date' } }, { cookie });
    expect(clash.status).toBe(409);
    const ok = await post(admin, { action: 'create', booking: { name: 'Aman', phone: '9123456789', date: '2030-01-10', slot: 's3', setup: 'date' } }, { cookie });
    expect(ok.status).toBe(200);
    expect((await ok.json()).booking.status).toBe('confirmed');
  });

  test('cancelling frees the time on the website', async () => {
    const r = await post(admin, { action: 'update', ref: rec.ref, patch: { status: 'cancelled' } }, { cookie });
    expect(r.status).toBe(200);
    expect(await busy('2030-01-10')).toEqual([[930, 1035]]);
  });

  test('a booking can be moved, and the move is checked', async () => {
    await post(admin, { action: 'update', ref: rec.ref, patch: { status: 'new' } }, { cookie });
    const bad = await post(admin, { action: 'update', ref: rec.ref, patch: { slot: 's2' } }, { cookie });
    expect(bad.status, 'a movie at 1:45 PM runs into 3:30 PM').toBe(409);
    const late = await post(admin, { action: 'update', ref: rec.ref, patch: { slot: 's7' } }, { cookie });
    expect(late.status, 'a movie at 10:30 PM runs past midnight').toBe(409);
    const ok = await post(admin, { action: 'update', ref: rec.ref, patch: { date: '2030-01-11', slot: 's6' } }, { cookie });
    expect(ok.status).toBe(200);
    expect(await busy('2030-01-11')).toEqual([[1245, 1440]]);
  });
});
