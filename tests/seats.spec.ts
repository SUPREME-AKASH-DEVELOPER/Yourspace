/**
 * The seats, as Tanishk set them out: five recliners in the back row and two
 * bean bags in front. Seven in all, never seven recliners.
 *
 * The bug these tests pin down: the picker used to fill every seat up to the
 * one you tapped, so tapping a bean bag took all five recliners with it. Each
 * seat is now its own toggle, and what someone picks is what we are told.
 */
import { test, expect, type Page } from '@playwright/test';
import { mockDelivery, pickSeats } from './helpers';
import { SEATING, MAX_GUESTS } from '../src/data/booking';

const seat = (page: Page, n: number) => page.locator(`[data-seat="${n}"]`);
const taken = (page: Page) => page.locator('.bk .seat.is-taken');

async function freshFlow(page: Page) {
  const sent = await mockDelivery(page);
  await page.goto('/book/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('[data-exp-pick="date"]').click();
  return sent;
}

test.describe('the seat picker', () => {
  test('the room has five recliners and two bean bags, told apart by shape', async ({ page }) => {
    await freshFlow(page);
    await expect(page.locator('.bk [data-kind="recliner"]')).toHaveCount(SEATING.recliners);
    await expect(page.locator('.bk [data-kind="beanbag"]')).toHaveCount(SEATING.beanBags);
    await expect(page.locator('.bk [data-seat]')).toHaveCount(MAX_GUESTS);

    // the recliners are behind the bean bags, as they are in the room
    await expect(page.locator('.bk .seat-row-back [data-kind="recliner"]')).toHaveCount(SEATING.recliners);
    await expect(page.locator('.bk .seat-row-front [data-kind="beanbag"]')).toHaveCount(SEATING.beanBags);

    // round bean bags, square-ish recliners — a real difference, not just a label
    const radius = (sel: string) => page.locator(sel).first().evaluate(
      (el) => getComputedStyle(el).borderTopLeftRadius);
    expect(await radius('.bk [data-kind="beanbag"]')).toMatch(/50%|2[0-9]px/);
    expect(await radius('.bk [data-kind="recliner"]')).toBe('6px');

    await expect(page.locator('.bk .seat-kinds')).toContainText(`${SEATING.recliners} Recliners`);
    await expect(page.locator('.bk .seat-kinds')).toContainText(`${SEATING.beanBags} Bean Bags`);
    await expect(page.locator('.bk .seat-kinds')).toContainText(`Total Capacity: ${MAX_GUESTS} People`);
  });

  test('one tap takes one seat — tapping a bean bag does not take the recliners', async ({ page }) => {
    await freshFlow(page);
    await expect(taken(page), 'two seats to start with').toHaveCount(2);

    await seat(page, 6).click();                       // the first bean bag
    await expect(taken(page), 'one more seat, not five').toHaveCount(3);
    await expect(seat(page, 6)).toHaveAttribute('aria-pressed', 'true');
    await expect(seat(page, 7), 'the other bean bag is untouched').toHaveAttribute('aria-pressed', 'false');
    for (const n of [3, 4, 5]) {
      await expect(seat(page, n), `recliner ${n} was not taken too`).toHaveAttribute('aria-pressed', 'false');
    }
    await expect(page.locator('.bk .seat-tally')).toContainText('3 guests');
  });

  test('tapping a taken seat gives back that seat and no other', async ({ page }) => {
    await freshFlow(page);
    await pickSeats(page, 5);
    await expect(taken(page)).toHaveCount(5);
    await seat(page, 3).click();
    await expect(taken(page)).toHaveCount(4);
    await expect(seat(page, 3)).toHaveAttribute('aria-pressed', 'false');
    await expect(seat(page, 4), 'the seats after it stay taken').toHaveAttribute('aria-pressed', 'true');
    await expect(seat(page, 5)).toHaveAttribute('aria-pressed', 'true');
  });

  test('two people can take the bean bags and nothing else', async ({ page }) => {
    await freshFlow(page);
    await seat(page, 6).click();
    await seat(page, 7).click();
    await seat(page, 1).click();
    await seat(page, 2).click();
    await expect(taken(page)).toHaveCount(2);
    await expect(page.locator('.bk .seat-tally')).toContainText('2 guests');
    await expect(page.locator('.bk .seat-tally')).toContainText(`0 of ${SEATING.recliners} recliners`);
    await expect(page.locator('.bk .seat-tally')).toContainText(`2 of ${SEATING.beanBags} bean bags`);
  });

  test('the last seat cannot be given back — someone has to sit somewhere', async ({ page }) => {
    await freshFlow(page);
    await pickSeats(page, 1);
    await expect(taken(page)).toHaveCount(1);
    await seat(page, 1).click();
    await expect(taken(page), 'still one seat').toHaveCount(1);
    await expect(page.locator('.bk-flash')).toContainText('has to sit somewhere');
  });

  test('every seat can be taken, and there is no eighth', async ({ page }) => {
    await freshFlow(page);
    await pickSeats(page, MAX_GUESTS);
    await expect(taken(page)).toHaveCount(MAX_GUESTS);
    await expect(page.locator('.bk .seat-tally')).toContainText(`${MAX_GUESTS} guests`);
    await expect(page.locator('[data-seat="8"]')).toHaveCount(0);
  });

  test('the seats chosen are what the summary and the email say', async ({ page }) => {
    const sent = await freshFlow(page);
    // one recliner and both bean bags: a mix the old picker could never produce
    await seat(page, 2).click();                       // down to recliner 1
    await seat(page, 6).click();
    await seat(page, 7).click();
    await expect(taken(page)).toHaveCount(3);

    await page.locator('[data-date-pick]').nth(2).click();
    await page.locator('[data-bk-next]').click();
    await page.locator('[data-slot-pick="s6"]').click();
    await page.locator('[data-setup-pick="date"]').click();
    await page.locator('[data-decor-pick]').first().click();
    await page.locator('[data-bk-next]').click();      // past the add-ons

    await expect(page.locator('.bk-sum')).toContainText('1 recliner + 2 bean bags');

    await page.fill('#bName', 'Akash Rai');
    await page.fill('#bPhone', '9876543210');
    await page.fill('#bEmail', 'a@example.com');
    await page.locator('input[name=bkPay][value=later]').check();
    await page.locator('[data-bk-next]').click();

    await expect(page.locator('#bkSendState')).toContainText('reached us', { timeout: 10_000 });
    expect(sent).toHaveLength(1);
    expect(sent[0].Guests).toBe('3');
    expect(sent[0].Seating, 'the team is told which seats, not just how many')
      .toBe('1 recliner + 2 bean bags');
  });

  test('seats survive a reload, and a tampered seat list is cleaned up', async ({ page }) => {
    await freshFlow(page);
    await seat(page, 6).click();
    await page.reload();
    await expect(taken(page), 'the same three seats come back').toHaveCount(3);
    await expect(seat(page, 6)).toHaveAttribute('aria-pressed', 'true');

    // saved progress lives in the visitor's browser, so none of it is trusted
    await page.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('ys-booking-v3') ?? '{}');
      localStorage.setItem('ys-booking-v3', JSON.stringify({
        ...raw, seats: [1, 1, 99, -4, 0, 'x', null, 7, 2.5], guests: 99,
      }));
    });
    await page.reload();
    const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('ys-booking-v3') ?? '{}'));
    expect(saved.seats, 'real seats only, no duplicates, in room order').toEqual([1, 7]);
    expect(saved.guests, 'the head count follows the seats').toBe(2);
    await expect(taken(page)).toHaveCount(2);
  });
});
