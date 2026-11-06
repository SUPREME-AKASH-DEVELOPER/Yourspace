/**
 * Every rule from the owner's call, checked one by one.
 *
 * The first block tests the pricing rules as plain functions, for every group
 * size, so a price can't drift without a test naming it. The rest drives the
 * real booking flow in a browser for the behaviour around those rules.
 */
import { test, expect, type Page } from '@playwright/test';
import { mockDelivery, ENDPOINT, readBody, pickSeats } from './helpers';
import { PAGES } from './pages';
import {
  setups, slots, addonGroups, priceList, setupPrice, quote, CALL_US, MAX_GUESTS, addMinutes,
} from '../src/data/booking';

/* ------------------------------------------------------------------ */
/*  The rules themselves                                               */
/* ------------------------------------------------------------------ */

test.describe('rules from the call', () => {
  test('four setups, and Watch Party is its own, not Movie Space', () => {
    expect(setups.map((s) => s.id)).toEqual(['date', 'movie', 'karaoke', 'watch']);
    expect(setups.find((s) => s.id === 'watch')!.closed).toBeTruthy();
  });

  test('eight 90-minute slots from noon, the last ending at midnight', () => {
    expect(slots).toHaveLength(8);
    expect(slots[0].start).toBe('12:00 PM');
    for (const s of slots) expect(addMinutes(s.start, 90), s.id).toBe(s.end);
    expect(slots[7]).toMatchObject({ start: '10:30 PM', end: '12:00 AM' });
  });

  test('durations: 90 minutes, karaoke 30', () => {
    const mins = Object.fromEntries(setups.map((s) => [s.id, s.minutes]));
    expect(mins).toMatchObject({ date: 90, movie: 90, karaoke: 30 });
  });

  test('nobody books more than seven online', () => {
    expect(MAX_GUESTS).toBe(7);
    for (const s of setups) expect(setupPrice(s.id, 8).blocked, s.id).toBeTruthy();
  });

  test('Movie Space: ₹1,500 for 1–5, ₹1,700 for 6–7', () => {
    for (let g = 1; g <= 5; g++) expect(setupPrice('movie', g).amount, `${g}`).toBe(1500);
    for (const g of [6, 7]) expect(setupPrice('movie', g).amount, `${g}`).toBe(1700);
  });

  test('Karaoke: fewer than three cannot book, with the owner\'s wording', () => {
    for (const g of [1, 2]) {
      expect(setupPrice('karaoke', g).amount).toBeNull();
      expect(setupPrice('karaoke', g).blocked).toBe(
        'This service is not available for online booking. Please contact us directly at the provided phone number.');
    }
    expect(CALL_US).toContain('not available for online booking');
  });

  test('Karaoke: ₹150 a head for 3–5, with the rate shown as supporting text', () => {
    expect([3, 4, 5].map((g) => setupPrice('karaoke', g).amount)).toEqual([450, 600, 750]);
    expect(setupPrice('karaoke', 4).note).toBe('₹150 per person');
  });

  test('Karaoke for 6–7 is not given a guessed price — neither ₹500 nor ₹900', () => {
    for (const g of [6, 7]) {
      const p = setupPrice('karaoke', g);
      expect(p.amount, `${g}`).toBeNull();
      expect(p.blocked, `${g} can still be requested`).toBeUndefined();
    }
  });

  test('Date Night: ₹1,500 plus the decoration chosen, plus add-ons', () => {
    const q = quote({ setup: 'date', guests: 2, decor: { name: 'Aesthetic', price: 1000 }, addons: ['bouquet-m'] });
    expect(q.total).toBe(2750);
    expect(q.unpriced).toEqual([]);
  });

  test('an unpriced choice is never counted as a guess', () => {
    const q = quote({ setup: 'date', guests: 2, decor: { name: 'Royal', price: null }, addons: ['photo-15'] });
    expect(q.total).toBe(1500);
    expect(q.unpriced).toEqual(['Royal decoration', 'Photoshoot: 15-minute photoshoot']);
  });

  test('Movie Space and Karaoke carry no decoration and no add-ons', () => {
    for (const id of ['movie', 'karaoke']) {
      const q = quote({ setup: id, guests: 4, decor: { name: 'Elite', price: 2000 }, addons: ['bouquet-l', 'cake-chocolate'] });
      expect(q.lines.map((l) => l.label), id).toHaveLength(1);
    }
    expect(setups.filter((s) => s.hasDecor || s.hasAddons).map((s) => s.id)).toEqual(['date']);
  });

  test('add-ons are bouquet, cake and photoshoot — and nothing the owner ruled out', () => {
    expect(addonGroups.map((g) => g.id)).toEqual(['bouquet', 'cake', 'photo']);
    expect(addonGroups[0].options.map((o) => o.price)).toEqual([200, 250, 300]);
    expect(addonGroups[2].options[0]).toMatchObject({ price: null, priceNote: '₹400–₹500' });
    expect(addonGroups[2].callFor).toMatch(/phone/);
    // what can be picked, by name — descriptions may mention candles on a cake
    const offered = addonGroups.flatMap((g) => [g.name, ...g.options.map((o) => `${o.id} ${o.name}`)]).join(' ').toLowerCase();
    for (const gone of ['bubble', 'snack', 'platter', 'led', 'petal', 'rose', 'fog', 'candle']) {
      expect(offered, gone).not.toContain(gone);
    }
    expect(priceList.map((p) => p.name.toLowerCase()).join(' ')).not.toMatch(/bubble|snack|led|petal|fog|candle/);
  });
});

/* ------------------------------------------------------------------ */
/*  The flow around them                                               */
/* ------------------------------------------------------------------ */

async function fresh(page: Page) {
  const sent = await mockDelivery(page);
  await page.goto('/book/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  return sent;
}

async function toSetup(page: Page, guests = 2) {
  await page.locator('[data-exp-pick="date"]').click();
  await pickSeats(page, guests);
  await page.locator('[data-date-pick]').nth(2).click();
  await page.locator('[data-bk-next]').click();
  await page.locator('[data-slot-pick="s6"]').click();
}

test.describe('the booking journey', () => {
  test('"today" is Jabalpur\'s, even on a computer set to New York', async ({ browser }) => {
    // 9:15 PM on 3 Nov in Jabalpur is still the morning of 3 Nov in New York
    const ctx = await browser.newContext({ timezoneId: 'America/New_York' });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date('2026-11-03T21:15:00+05:30'));
    await page.goto('/book/');
    await page.locator('[data-exp-pick="date"]').click();
    await expect(page.locator('[data-date-pick]').first()).toHaveAttribute('data-date-pick', '2026-11-03');
    await page.locator('[data-date-pick="2026-11-03"]').click();
    await page.locator('[data-bk-next]').click();
    // every slot up to 9:00 PM has started in Jabalpur; only 10:30 PM is left
    for (const s of ['s1', 's4', 's7']) await expect(page.locator(`[data-slot-pick="${s}"]`)).toBeDisabled();
    await expect(page.locator('[data-slot-pick="s8"]')).toBeEnabled();
    await ctx.close();
  });

  test('just after midnight in India, yesterday is not offered', async ({ browser }) => {
    // 00:30 on 4 Nov in Jabalpur is still 3 Nov in UTC
    const ctx = await browser.newContext({ timezoneId: 'UTC' });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date('2026-11-04T00:30:00+05:30'));
    await page.goto('/book/');
    await page.locator('[data-exp-pick="date"]').click();
    await expect(page.locator('[data-date-pick]').first()).toHaveAttribute('data-date-pick', '2026-11-04');
    await expect(page.locator('[data-date-pick="2026-11-03"]')).toHaveCount(0);
    // and the date box on the home page starts from the same day
    await page.goto('/');
    await expect(page.locator('#qDate')).toHaveAttribute('min', '2026-11-04');
    await ctx.close();
  });

  test('changing the date after choosing a time clears a time that has gone', async ({ browser }) => {
    const ctx = await browser.newContext({ timezoneId: 'Asia/Kolkata' });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date('2026-11-03T14:00:00+05:30'));
    await page.goto('/book/');
    await page.locator('[data-exp-pick="date"]').click();
    await page.locator('[data-date-pick="2026-11-05"]').click();
    await page.locator('[data-bk-next]').click();
    await page.locator('[data-slot-pick="s1"]').click();          // noon, on the 5th
    await page.locator('[data-bk-back]').click();
    await expect(page.locator('#bkTitle')).toContainText('Choose your time');
    await page.locator('[data-bk-back]').click();
    await expect(page.locator('#bkTitle')).toContainText("who's coming");
    await page.locator('[data-date-pick="2026-11-03"]').click();  // noon today has gone
    await page.locator('[data-bk-next]').click();
    await expect(page.locator('[data-slot-pick="s1"]')).toBeDisabled();
    await expect(page.locator('.slot.is-sel')).toHaveCount(0);
    await ctx.close();
  });

  test('every choice survives going back and forward again', async ({ page }) => {
    await fresh(page);
    await toSetup(page, 2);
    await page.locator('[data-setup-pick="date"]').click();
    await page.locator('[data-decor-pick="elite"]').click();
    await page.locator('[data-addon-pick="cake-chocolate"]').click();

    // add-ons → setup → time → date & guests, waiting for each step to land
    for (const title of ['Choose your setup', 'Choose your time', "who's coming"]) {
      await page.locator('[data-bk-back]').click();
      await expect(page.locator('#bkTitle')).toContainText(title);
    }
    await expect(page.locator('.seat.is-taken')).toHaveCount(2);
    await expect(page.locator('.daytile.is-sel')).toHaveCount(1);
    await page.locator('[data-bk-next]').click();
    await expect(page.locator('[data-slot-pick="s6"]')).toHaveClass(/is-sel/);
    await page.locator('[data-bk-next]').click();
    await expect(page.locator('[data-setup-pick="date"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-decor-pick="elite"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-bk-next]').click();
    await expect(page.locator('[data-addon-pick="cake-chocolate"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('dropping below three guests after choosing karaoke stops the booking', async ({ page }) => {
    await fresh(page);
    await page.locator('[data-exp-pick="karaoke"]').click();
    await page.locator('[data-seat="4"]').click();
    await page.locator('[data-date-pick]').nth(2).click();
    await page.locator('[data-bk-next]').click();
    await page.locator('[data-slot-pick="s6"]').click();
    await page.locator('[data-setup-pick="karaoke"]').click();
    await expect(page.locator('#bkTitle')).toContainText('Your details');

    // back to the seats, down to two
    for (const title of ['Choose your setup', 'Choose your time', "who's coming"]) {
      await page.locator('[data-bk-back]').click();
      await expect(page.locator('#bkTitle')).toContainText(title);
    }
    await page.locator('[data-seat="2"]').click();
    await page.locator('[data-bk-next]').click();
    await page.locator('[data-slot-pick="s6"]').click();
    await expect(page.locator('[data-setup-pick="karaoke"]')).toContainText('not available for online booking');
    await page.locator('[data-bk-next]').click();
    await expect(page.locator('.bk-flash')).toContainText('not available for online booking');
    await expect(page.locator('#bkTitle')).toContainText('Choose your setup');
  });

  test('each decoration shows its photo, price, description and what is included', async ({ page }) => {
    await fresh(page);
    await toSetup(page);
    await page.locator('[data-setup-pick="date"]').click();
    for (const id of ['aesthetic', 'elite', 'royal']) {
      const card = page.locator(`[data-decor-pick="${id}"]`);
      await expect(card.locator('img')).toHaveCount(1);
      await expect(card.locator('.dc-price')).not.toBeEmpty();
      await expect(card.locator('.dc-blurb')).not.toBeEmpty();
      await expect(card.locator('.dc-list .is-incl')).toHaveText(['Fog entry', 'Candlelight setup']);
    }
  });

  test('Movie Space never shows decorations', async ({ page }) => {
    await fresh(page);
    await toSetup(page);
    await page.locator('[data-setup-pick="movie"]').click();
    await page.locator('[data-bk-back]').click();
    await expect(page.locator('#bkDecor')).toHaveCount(0);
  });

  test('asking for eight from the home page says what happened, not just changes it', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.selectOption('#qExperience', 'Stand-Up Night');
    await page.fill('#qGuests', '8');
    await page.locator('#quickStart button[type=submit]').click();
    await expect(page.locator('#bk .bk-note[role=status]')).toContainText('up to 7');
    await expect(page.locator('#bk .seat.is-taken')).toHaveCount(7);
  });

  test('tampered saved progress is ignored, not trusted', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/book/');
    await page.evaluate(() => localStorage.setItem('ys-booking-v3', JSON.stringify({
      step: 3, exp: 'date', guests: 99, date: '<img src=x onerror=window.__pwned=1>',
      slot: 's99', setup: '"><script>window.__pwned=1</script>', decor: 'gold',
      addons: ['bouquet-s', 'bubble-entry', 5], pay: 'free', ref: '"><b>', utr: 'abc123',
    })));
    await page.reload();
    expect(await page.evaluate(() => (window as any).__pwned)).toBeUndefined();
    const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('ys-booking-v3') ?? '{}'));
    expect(saved).toMatchObject({ date: '', slot: '', setup: '', decor: '', addons: ['bouquet-s'], pay: '', ref: '', guests: 7 });
    expect(errors).toEqual([]);
  });

  test('the confirmation reads back their notes and says plainly where payment stands', async ({ page }) => {
    await fresh(page);
    await toSetup(page);
    await page.locator('[data-setup-pick="movie"]').click();
    await page.fill('#bName', 'Akash Rai');
    await page.fill('#bPhone', '9876543210');
    await page.fill('#bEmail', 'a@example.com');
    await page.fill('#bNotes', 'Name on the screen: Riya');
    await page.locator('input[name=bkPay][value=upi]').check();
    await page.locator('[data-bk-next]').click();
    const sum = page.locator('.bk-done .bk-sum');
    await expect(sum).toContainText('Name on the screen: Riya');
    await expect(sum).toContainText('UPI — awaiting payment');
  });

  test('a send that fails can be retried, and goes once', async ({ page }) => {
    const sent: Record<string, string>[] = [];
    let failNext = true;
    await page.route(ENDPOINT, async (route) => {
      if (failNext) { failNext = false; return route.abort('failed'); }
      sent.push(readBody(route.request().postData()));
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
    });
    await page.goto('/book/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await toSetup(page);
    await page.locator('[data-setup-pick="movie"]').click();
    await page.fill('#bName', 'Akash Rai');
    await page.fill('#bPhone', '9876543210');
    await page.fill('#bEmail', 'a@example.com');
    await page.locator('input[name=bkPay][value=later]').check();
    await page.locator('[data-bk-next]').click();
    // the first attempt is retried once automatically on a dropped connection, so it lands
    await expect(page.locator('#bkSendState')).toContainText('reached us', { timeout: 15_000 });
    expect(sent).toHaveLength(1);
    await expect(page.locator('[data-bk-resend]')).toHaveCount(0);
  });

  test('nothing the owner ruled out appears anywhere on the site', async ({ page }) => {
    for (const path of PAGES) {
      await page.goto(path);
      const text = (await page.locator('body').innerText()).toLowerCase();
      for (const gone of ['bubble entry', 'snack platter', 'led balloon', 'balloon & led', 'rose petal']) {
        expect(text, `${path}: ${gone}`).not.toContain(gone);
      }
    }
  });
});

test.describe('the journey on a phone and a tablet', () => {
  for (const [label, width, height] of [['phone', 375, 740], ['tablet', 768, 1024]] as const) {
    test(`${label}: every step fits the screen`, async ({ browser }) => {
      // motion off: we are measuring where things settle, not a frame mid-animation
      const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      await mockDelivery(page);
      await page.goto('/book/');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      const fits = async (step: string) => {
        await expect.poll(
          () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
          { message: `${label} ${step}`, timeout: 10_000 },
        ).toBeLessThanOrEqual(0);
      };
      await fits('occasion');
      await toSetup(page);
      await fits('setup');
      await page.locator('[data-setup-pick="date"]').click();
      await fits('decoration');
      await page.locator('[data-decor-pick="aesthetic"]').click();
      await fits('add-ons');
      await page.locator('[data-bk-next]').click();
      await page.fill('#bName', 'Akash Rai');
      await page.fill('#bPhone', '9876543210');
      await page.fill('#bEmail', 'a@example.com');
      await page.locator('input[name=bkPay][value=upi]').check();
      await fits('details');
      await page.locator('[data-bk-next]').click();
      await expect(page.locator('.paybox')).toBeVisible();
      await fits('payment');
      await ctx.close();
    });
  }
});
