import { test, expect, type Page } from '@playwright/test';

/** Each test starts from an empty flow — the saved-progress behaviour is tested separately. */
async function freshFlow(page: Page) {
  await page.goto('/book/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

test.describe('booking flow', () => {
  test('runs end to end and totals correctly', async ({ page }) => {
    await freshFlow(page);
    // six set occasions plus "Something else"
    await expect(page.locator('[data-exp-pick]'), 'occasions offered').toHaveCount(7);

    await page.locator('[data-exp-pick="proposal"]').click();

    // seats: the first four are included, the rest are chargeable
    await page.locator('[data-seat="6"]').click();
    await expect(page.locator('.seat.is-taken')).toHaveCount(4);
    await expect(page.locator('.seat.is-extra')).toHaveCount(2);

    // tapping the last seat again hands it back
    await page.locator('[data-seat="6"]').click();
    await expect(page.locator('.seat.is-taken, .seat.is-extra')).toHaveCount(5);
    await page.locator('[data-seat="6"]').click();

    await page.locator('[data-date-pick]').nth(2).click();
    await page.locator('[data-bk-next]').click();
    await page.locator('[data-slot-pick="s4"]').click();
    await page.locator('[data-pkg-pick="romantic"]').click();
    await page.locator('.xrow', { hasText: 'Cake' }).locator('[data-delta="1"]').click();

    // ₹3,500 package + 2 extra seats (₹600) + cake (₹600)
    await expect(page.locator('#bkTotal strong')).toHaveText('₹4,700');

    await page.locator('[data-bk-next]').click();
    await expect(page.locator('#bkTitle')).toContainText('Where do we reach you');
  });

  test('will not accept a booking without a name and a valid number', async ({ page }) => {
    await freshFlow(page);
    await page.locator('[data-exp-pick="date"]').click();
    await page.locator('[data-date-pick]').first().click();
    await page.locator('[data-bk-next]').click();
    await page.locator('[data-slot-pick="s1"]').click();
    await page.locator('[data-pkg-pick="room"]').click();
    await page.locator('[data-bk-next]').click();

    await page.locator('[data-bk-next]').click();
    await expect(page.locator('.bk-flash')).toContainText('name');

    await page.fill('#bName', 'Tanishk');
    await page.fill('#bPhone', '12345');
    await page.locator('[data-bk-next]').click();
    await expect(page.locator('.bk-flash')).toContainText('valid 10-digit');

    await page.fill('#bPhone', '9876543210');
    await page.locator('[data-bk-next]').click();
    await expect(page.locator('#bkTitle')).toContainText("You're on the list");
  });

  test('confirmation is clear that no money changed hands', async ({ page }) => {
    await freshFlow(page);
    await page.locator('[data-exp-pick="karaoke"]').click();
    await page.locator('[data-date-pick]').first().click();
    await page.locator('[data-bk-next]').click();
    await page.locator('[data-slot-pick="s2"]').click();
    await page.locator('[data-pkg-pick="room"]').click();
    await page.locator('[data-bk-next]').click();
    await page.fill('#bName', 'Akash');
    await page.fill('#bPhone', '9876543210');
    await page.locator('[data-bk-next]').click();

    await expect(page.locator('.bk-done')).toContainText('Nothing has been charged');
    await expect(page.locator('.bk-sum-row').last()).toContainText('₹0');

    // the request is kept locally, and the half-finished booking is cleared
    expect(await page.evaluate(() => localStorage.getItem('ys-requests'))).toContain('booking-flow');
    expect(await page.evaluate(() => localStorage.getItem('ys-booking-v2'))).toBeNull();
  });

  test('picks up an unfinished booking after a reload', async ({ page }) => {
    await freshFlow(page);
    await page.locator('[data-exp-pick="karaoke"]').click();
    await expect(page.locator('.seatmap')).toBeVisible();
    await page.reload();
    await expect(page.locator('.seatmap'), 'still on the seats step').toBeVisible();
  });

  test('opens as a dialog from elsewhere, carrying the occasion', async ({ page }) => {
    await page.goto('/programme/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('.prog-cta[data-exp="Karaoke"]').click();
    await expect(page.locator('#bk')).toBeVisible();
    await expect(page.locator('#bkTotal')).toContainText('Karaoke');
  });

  test('the hero ticket carries its choices into the flow', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.selectOption('#qExperience', 'Karaoke');
    await page.fill('#qGuests', '5');
    await page.locator('#quickStart button[type=submit]').click();
    // ₹1,499 base + one chargeable seat
    await expect(page.locator('#bkTotal')).toContainText('₹1,799');
    await expect(page.locator('#bkTotal')).toContainText('5 guests');
  });

  test('survives localStorage being unavailable', async ({ browser }) => {
    const ctx = await browser.newContext();
    await ctx.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() { throw new DOMException('blocked'); },
      });
    });
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/book/');
    await page.locator('[data-exp-pick="date"]').click();
    await expect(page.locator('.seatmap')).toBeVisible();
    expect(errors).toEqual([]);
    await ctx.close();
  });
});
