/**
 * Decoration: when it can be booked, and when it can only be asked for.
 *
 * There is one decorator. He works a set stretch of the day, and he needs
 * three hours' warning to buy the flowers, get to the room and build the set.
 * Those two facts decide every slot, and they are checked in three places , 
 * the label on the slot, the step that would sell it, and the server that
 * takes the money, because the first two run on the customer's machine.
 *
 * Nothing here touches the room itself: an undecorated Date Night, Movie
 * Space, Karaoke and Watch Party are unaffected at every hour.
 */
import { test, expect, type Page } from '@playwright/test';
import { priceBooking, decorStatus as serverStatus } from '../api/_prices.js';
import {
  slots, decorStatus, DECOR_NOTICE_MINUTES, HOUSE_RULES, requiredRules, rulesAccepted,
} from '../src/data/booking';

const DAY = '2026-11-20';
const at = (clock: string, iso = DAY) => {
  const [hm, ap] = clock.split(' ');
  const [h, m] = hm.split(':').map(Number);
  return { iso, minutes: ((h % 12) + (ap === 'PM' ? 12 : 0)) * 60 + m };
};
const byStart = (start: string) => slots.find((s) => s.start === start)!.id;

/** The whole day's answer, keyed by start time, as a customer standing at `clock` sees it. */
const table = (clock: string, date = DAY) =>
  Object.fromEntries(slots.map((s) => [s.start, decorStatus(s.id, date, at(clock))]));

test.describe('when decoration can be booked', () => {
  test('the decorator works a set stretch of the day, whatever the notice', () => {
    // a week ahead, so notice is never the reason for the answer
    const early = { iso: '2026-11-13', minutes: 9 * 60 };
    expect(decorStatus(byStart('12:00 PM'), DAY, early), 'before he starts').toBe('closed');
    expect(decorStatus(byStart('1:45 PM'), DAY, early), 'before he starts').toBe('closed');
    expect(decorStatus(byStart('3:30 PM'), DAY, early)).toBe('online');
    expect(decorStatus(byStart('5:15 PM'), DAY, early)).toBe('online');
    expect(decorStatus(byStart('7:00 PM'), DAY, early)).toBe('online');
    expect(decorStatus(byStart('8:45 PM'), DAY, early), 'starts before the cut-off').toBe('online');
    expect(decorStatus(byStart('10:30 PM'), DAY, early), 'after he has gone home').toBe('closed');
  });

  test('three hours of notice, counted from the real time of day', () => {
    expect(DECOR_NOTICE_MINUTES).toBe(180);

    expect(table('2:00 PM')).toEqual({
      '12:00 PM': 'closed', '1:45 PM': 'closed',
      '3:30 PM': 'call',                        // 1h30 away, too soon to sell
      '5:15 PM': 'online', '7:00 PM': 'online', '8:45 PM': 'online',
      '10:30 PM': 'closed',
    });

    expect(table('5:00 PM')).toEqual({
      '12:00 PM': 'closed', '1:45 PM': 'closed',
      '3:30 PM': 'call', '5:15 PM': 'call', '7:00 PM': 'call',
      '8:45 PM': 'online',                      // 3h45 away, just enough
      '10:30 PM': 'closed',
    });

    // 6 PM + 3h = 9 PM. Only 10:30 PM is far enough away, and it is shut.
    expect(table('6:00 PM')['8:45 PM'], 'two and three quarter hours away').toBe('call');
    expect(table('6:00 PM')['10:30 PM'], 'far enough away, but shut').toBe('closed');
    expect(table('8:00 PM')['10:30 PM']).toBe('closed');
  });

  test('exactly three hours is enough; a minute under is not', () => {
    const slot = byStart('7:00 PM');
    expect(decorStatus(slot, DAY, at('4:00 PM')), 'three hours on the dot').toBe('online');
    expect(decorStatus(slot, DAY, at('4:01 PM'))).toBe('call');
  });

  test('a booking for another day counts the days, and survives midnight', () => {
    // 11 PM tonight, booking tomorrow afternoon: hours away, not minutes
    expect(decorStatus(byStart('3:30 PM'), '2026-11-21', at('11:00 PM', '2026-11-20'))).toBe('online');
    // half past midnight, booking later the same day
    expect(decorStatus(byStart('3:30 PM'), '2026-11-21', at('12:30 AM', '2026-11-21'))).toBe('online');
    // a date gone by is behind us, never "far enough away"
    expect(decorStatus(byStart('3:30 PM'), '2026-11-19', at('12:00 PM', '2026-11-20'))).toBe('call');
  });

  test('10:30 PM is never decorated, at any hour of any day', () => {
    const last = byStart('10:30 PM');
    for (let h = 0; h < 24; h++) {
      for (const iso of ['2026-11-20', '2026-11-21', '2026-12-25']) {
        expect(decorStatus(last, iso, { iso: '2026-11-20', minutes: h * 60 }), `${h}:00 for ${iso}`)
          .toBe('closed');
      }
    }
  });

  test('the server works it out the same way, hour by hour', () => {
    for (let h = 0; h < 24; h++) {
      for (const m of [0, 29, 44, 59]) {
        const now = { iso: DAY, minutes: h * 60 + m };
        for (const date of ['2026-11-20', '2026-11-21']) {
          for (const s of slots) {
            expect(serverStatus(s.id, date, now), `${s.start} on ${date} at ${h}:${m}`)
              .toBe(decorStatus(s.id, date, now));
          }
        }
      }
    }
  });
});

test.describe('the server refuses what the page will not sell', () => {
  const agreed = requiredRules();
  const booking = (over: Record<string, unknown> = {}) => priceBooking({
    setup: 'date', guests: 2, slot: byStart('7:00 PM'), decor: 'aesthetic',
    addons: [], date: DAY, agreed, now: at('10:00 AM'), ...over,
  });

  test('a decoration with enough notice is priced', () => {
    expect(booking()).toEqual({ amount: 1500 + 1000 });
  });

  test('a decoration at short notice is refused, with the phone as the way out', () => {
    const r = booking({ now: at('6:00 PM') });
    expect(r.amount).toBeNull();
    expect(r.reason).toMatch(/too soon|call/i);
  });

  test('a decoration outside the decorator\'s hours is refused', () => {
    for (const start of ['12:00 PM', '1:45 PM', '10:30 PM']) {
      const r = booking({ slot: byStart(start) });
      expect(r.amount, start).toBeNull();
      expect(r.reason, start).toMatch(/not available/i);
    }
  });

  test('inside the decorator\'s hours a Date Night still has to choose one', () => {
    const r = booking({ decor: '', now: at('10:00 AM') });
    expect(r.amount).toBeNull();
    expect(r.reason).toMatch(/pick a decoration/i);
  });

  test('the room alone is still bookable at every hour, decorated or not', () => {
    for (const s of slots) {
      expect(booking({ slot: s.id, decor: '', now: at('11:00 PM') }).amount, `date night at ${s.start}`)
        .toBe(1500);
      expect(booking({ setup: 'movie', slot: s.id, decor: '', now: at('11:00 PM') }).amount, `movie at ${s.start}`)
        .toBe(1500);
      expect(booking({ setup: 'karaoke', guests: 3, slot: s.id, decor: '', now: at('11:00 PM') }).amount,
        `karaoke at ${s.start}`).toBe(450);
    }
  });

  test('nothing is paid for until the house rules are agreed to', () => {
    expect(booking({ agreed: [] }).amount, 'none ticked').toBeNull();
    expect(booking({ agreed: agreed.slice(0, -1) }).amount, 'one left').toBeNull();
    expect(booking({ agreed: undefined }).amount, 'not sent at all').toBeNull();
    expect(booking({ agreed: 'all of them' }).amount, 'not even a list').toBeNull();
    expect(booking({ agreed }).amount, 'all ticked').toBe(2500);
  });

  test('the two lists of rules match', () => {
    expect(rulesAccepted(requiredRules())).toBe(true);
    expect(rulesAccepted(requiredRules().slice(1))).toBe(false);
    // the server keeps its own copy; it must name the same rules
    expect(booking({ agreed: HOUSE_RULES.map((r) => r.id) }).amount).toBe(2500);
  });
});

/* ---------- the same rules, seen through the booking flow ---------- */

async function flowAt(page: Page, iso: string, clock: string) {
  await page.clock.setFixedTime(new Date(`${iso}T${clock}+05:30`));
  await page.goto('/book/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('[data-exp-pick="date"]').click();
  await page.locator('[data-date-pick]').first().click();   // today
  await page.locator('[data-bk-next]').click();
}

/** The booking as it is actually saved in the browser. */
const saved = async (page: Page): Promise<Record<string, any>> =>
  JSON.parse(await page.evaluate(() => localStorage.getItem('ys-booking-v3') ?? '{}'));

const slotCard = (page: Page, start: string) =>
  page.locator(`[data-slot-pick="${byStart(start)}"]`);

test.describe('what the flow shows', () => {
  test('each time says what decoration it can really have, at 2 PM', async ({ page }) => {
    await flowAt(page, '2026-11-20', '14:00:00');
    await expect(slotCard(page, '3:30 PM')).toContainText('Decoration by phone');
    await expect(slotCard(page, '3:30 PM')).not.toContainText('Decoration available');
    for (const start of ['5:15 PM', '7:00 PM', '8:45 PM']) {
      await expect(slotCard(page, start), start).toContainText('Decoration available');
    }
    await expect(slotCard(page, '10:30 PM'), 'never decorated').not.toContainText('Decoration');
  });

  test('10:30 PM never says decoration available, whatever the hour', async ({ page }) => {
    for (const clock of ['12:05:00', '14:00:00', '17:00:00', '18:00:00', '20:00:00']) {
      await flowAt(page, '2026-11-20', clock);
      await expect(slotCard(page, '10:30 PM'), clock).not.toContainText('Decoration');
    }
  });

  test('at 5 PM only the 8:45 session can still be decorated online', async ({ page }) => {
    await flowAt(page, '2026-11-20', '17:00:00');
    await expect(slotCard(page, '7:00 PM')).toContainText('Decoration by phone');
    await expect(slotCard(page, '8:45 PM')).toContainText('Decoration available');
    await expect(slotCard(page, '10:30 PM')).not.toContainText('Decoration');
  });

  test('a short-notice session offers the phone, not a decoration to buy', async ({ page }) => {
    await flowAt(page, '2026-11-20', '14:00:00');
    await slotCard(page, '3:30 PM').click();

    await expect(page.locator('.bk-note'), 'says why, and offers the phone')
      .toContainText('only arranged by phone');
    const ring = page.locator('.bk-note a[href^="tel:"]');
    await expect(ring, 'a number to ring').toBeVisible();
    expect(await ring.getAttribute('href')).toMatch(/^tel:\+91\d{10}$/);
    await expect(page.locator('[data-decor-pick]'), 'nothing to buy').toHaveCount(0);

    // the room itself is still bookable at that time
    await page.locator('[data-setup-pick="date"]').click();
    await expect(page.locator('#bkTitle'), 'through to the add-ons, undecorated')
      .toContainText('Make it yours');
  });

  test('a decoration chosen earlier comes off when the time no longer allows it', async ({ page }) => {
    await flowAt(page, '2026-11-20', '14:00:00');
    await slotCard(page, '7:00 PM').click();
    await page.locator('[data-setup-pick="date"]').click();
    await page.locator('[data-decor-pick="aesthetic"]').click();
    await expect(page.locator('.bk-sum')).toContainText('Aesthetic');

    // back to the times, and down to one the decorator cannot reach
    await page.locator('[data-bk-back]').click();
    await page.locator('[data-bk-back]').click();
    await slotCard(page, '3:30 PM').click();
    await expect(page.locator('.bk-note'))
      .toContainText(/less notice than the decorator needs|under 3 hours/);
    // the decoration is gone from the booking itself, not just off the screen
    await expect.poll(async () => (await saved(page)).decor).toBe('');
    await expect(page.locator('[data-decor-pick].is-sel')).toHaveCount(0);
  });

  test('a decoration cannot be smuggled back in through saved progress', async ({ page }) => {
    await flowAt(page, '2026-11-20', '14:00:00');
    await slotCard(page, '3:30 PM').click();
    await page.locator('[data-setup-pick="date"]').click();

    // hand-edit the saved booking to carry a decoration it is not entitled to
    await page.evaluate((slot) => {
      const raw = JSON.parse(localStorage.getItem('ys-booking-v3') ?? '{}');
      localStorage.setItem('ys-booking-v3', JSON.stringify({ ...raw, slot, decor: 'royal', step: 3 }));
    }, byStart('3:30 PM'));
    await page.reload();

    await page.locator('[data-bk-next]').click();
    await expect(page.locator('.bk-flash')).toContainText(/less than 3 hours|cannot be booked here/i);
    await expect.poll(async () => (await saved(page)).decor, 'refused and cleared').toBe('');
    await expect(page.locator('#bkTitle'), 'held on the setup step').toContainText('setup');
  });
});

test.describe('the house rules', () => {
  async function toPay(page: Page) {
    await flowAt(page, '2026-11-20', '14:00:00');
    await slotCard(page, '7:00 PM').click();
    await page.locator('[data-setup-pick="movie"]').click();
    await page.fill('#bName', 'Akash Rai');
    await page.fill('#bPhone', '9876543210');
    await page.fill('#bEmail', 'a@example.com');
    // pay after the call, so no checkout window opens during the test
    await page.locator('input[name=bkPay][value=later]').check();
  }

  test('every rule starts unticked, and the button waits', async ({ page }) => {
    await toPay(page);
    const boxes = page.locator('[data-rule]');
    await expect(boxes).toHaveCount(HOUSE_RULES.length);
    for (let i = 0; i < HOUSE_RULES.length; i++) await expect(boxes.nth(i)).not.toBeChecked();
    await expect(page.locator('[data-bk-next]')).toHaveClass(/is-waiting/);
    await expect(page.locator('.rules-left')).toContainText(`${HOUSE_RULES.length} still to tick`);
  });

  test('a booking cannot go through with one left unticked', async ({ page }) => {
    await toPay(page);
    const boxes = page.locator('[data-rule]');
    for (let i = 0; i < HOUSE_RULES.length - 1; i++) await boxes.nth(i).check();
    await page.locator('[data-bk-next]').click();
    await expect(page.locator('.bk-flash')).toContainText('house rules');
    await expect(page.locator('#bkTitle'), 'still on the same step').toContainText('Your details');
  });

  test('ticking them all opens the way through, and the booking records it', async ({ page }) => {
    const sent: Record<string, string>[] = [];
    await page.route(/api\/send|resend|formsubmit|web3forms/, async (route) => {
      sent.push(JSON.parse(route.request().postData() ?? '{}'));
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await toPay(page);
    for (const box of await page.locator('[data-rule]').all()) await box.check();
    await expect(page.locator('[data-bk-next]')).not.toHaveClass(/is-waiting/);
    await expect(page.locator('.rules-left')).toContainText('all agreed');

    await page.locator('[data-bk-next]').click();
    await expect(page.locator('#bkTitle')).toContainText(/list|step/i);
    await expect.poll(() => sent.length, { timeout: 10_000 }).toBeGreaterThan(0);
    expect(JSON.stringify(sent[0]), 'what was agreed is kept with the booking')
      .toContain('Agreed to all');
  });

  test('a tampered agreement is thrown away, not obeyed and not fatal', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await toPay(page);

    for (const bad of [{ smoking: true } as unknown, 'all of them', 42, [1, 2, 3], ['made-up-rule']]) {
      await page.evaluate((agreed) => {
        const raw = JSON.parse(localStorage.getItem('ys-booking-v3') ?? '{}');
        localStorage.setItem('ys-booking-v3', JSON.stringify({ ...raw, agreed }));
      }, bad);
      await page.reload();
      // the flow still draws, and nothing counts as ticked
      await expect(page.locator('#bkTitle'), JSON.stringify(bad)).toContainText('Your details');
      for (const box of await page.locator('[data-rule]').all()) await expect(box).not.toBeChecked();
      await expect(page.locator('[data-bk-next]')).toHaveClass(/is-waiting/);
    }
    expect(errors, 'nothing threw').toEqual([]);
  });

  test('the ticks survive a reload, so nobody has to do it twice', async ({ page }) => {
    await toPay(page);
    await page.locator('[data-rule]').first().check();
    await page.reload();
    await expect(page.locator('[data-rule]').first()).toBeChecked();
    await expect(page.locator('[data-rule]').nth(1)).not.toBeChecked();
  });
});
