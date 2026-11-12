import { test, expect, type Page } from '@playwright/test';
import { mockDelivery, mockRazorpay, pickSeats } from './helpers';

/** Each test starts from an empty flow — the saved-progress behaviour is tested separately. */
async function freshFlow(page: Page) {
  const sent = await mockDelivery(page);          // the booking is emailed on confirm
  await page.goto('/book/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  return sent;
}

/** Occasion, guests, date and time — everything up to the setup step. */
async function toSetup(page: Page, guests: number, occasion = 'date') {
  await page.locator(`[data-exp-pick="${occasion}"]`).click();
  await pickSeats(page, guests);
  await page.locator('[data-date-pick]').nth(2).click();
  await page.locator('[data-bk-next]').click();
  await page.locator('[data-slot-pick="s6"]').click();
  await expect(page.locator('#bkTitle')).toContainText('Choose your setup');
}

async function details(page: Page, pay?: 'online' | 'later') {
  await page.fill('#bName', 'Akash Rai');
  await page.fill('#bPhone', '9876543210');
  await page.fill('#bEmail', 'a@example.com');
  if (pay) await page.locator(`input[name=bkPay][value=${pay}]`).check();
}

test.describe('booking flow', () => {
  test('offers seven 90-minute slots from noon to midnight, 15 minutes apart', async ({ page }) => {
    await freshFlow(page);
    await page.locator('[data-exp-pick="date"]').click();
    await page.locator('[data-date-pick]').nth(2).click();
    await page.locator('[data-bk-next]').click();
    await expect(page.locator('[data-slot-pick]')).toHaveCount(7);
    await expect(page.locator('[data-slot-pick="s1"]')).toContainText('12:00 PM');
    await expect(page.locator('[data-slot-pick="s2"]'), 'starts 15 min after the first ends')
      .toContainText('1:45 PM');
    await expect(page.locator('[data-slot-pick="s7"]')).toContainText('10:30 PM');
    await expect(page.locator('[data-slot-pick="s7"]')).toContainText('12:00 AM');
    await expect(page.locator('.bk-body')).toContainText('15 minutes between bookings');
  });

  test('no more than seven guests can be chosen', async ({ page }) => {
    await freshFlow(page);
    await page.locator('[data-exp-pick="date"]').click();
    await expect(page.locator('[data-seat]')).toHaveCount(7);
  });

  test('Date Night: session plus decoration plus add-ons', async ({ page }) => {
    await freshFlow(page);
    await toSetup(page, 2);

    await page.locator('[data-setup-pick="date"]').click();
    // the decoration appears under the setup, with what every package includes
    await expect(page.locator('.decor-incl')).toContainText('Fog entry');
    await expect(page.locator('.decor-incl')).toContainText('Candlelight setup');
    await expect(page.locator('[data-decor-pick]')).toHaveCount(3);
    for (const name of ['Aesthetic', 'Elite', 'Royal']) {
      await expect(page.locator('[data-decor-pick]', { hasText: name })).toBeVisible();
    }
    // every decoration shows a photograph, not a drawing
    await expect(page.locator('[data-decor-pick] img')).toHaveCount(3);

    // a decoration is required before moving on
    await page.locator('[data-bk-next]').click();
    await expect(page.locator('.bk-flash')).toContainText('decoration');

    await page.locator('[data-decor-pick="aesthetic"]').click();
    await expect(page.locator('#bkTitle')).toContainText('Make it yours');

    // removed on the owner's instruction
    for (const gone of ['Bubble', 'LED', 'Snack', 'Rose petal', 'Fog entry (2']) {
      await expect(page.locator('[data-addon-pick]', { hasText: gone })).toHaveCount(0);
    }

    await page.locator('[data-addon-pick="bouquet-m"]').click();
    // ₹1,500 session + ₹1,000 Aesthetic + ₹250 bouquet
    await expect(page.locator('#bkTotal strong')).toHaveText('₹2,750');

    // one bouquet at a time: another replaces it, the same one removes it
    await page.locator('[data-addon-pick="bouquet-l"]').click();
    await expect(page.locator('#bkTotal strong')).toHaveText('₹2,800');
    await page.locator('[data-addon-pick="bouquet-l"]').click();
    await expect(page.locator('#bkTotal strong')).toHaveText('₹2,500');

    // an add-on without a confirmed price is not added as a guess
    await page.locator('[data-addon-pick="photo-15"]').click();
    await expect(page.locator('#bkTotal strong')).toHaveText('₹2,500 + on call');
  });

  test('Movie Space: ₹1,500 up to five, ₹1,700 for six or seven, and no add-ons', async ({ page }) => {
    await freshFlow(page);
    await toSetup(page, 5, 'standup');
    await expect(page.locator('[data-setup-pick="movie"] .sc-price')).toHaveText('₹1,500');
    await page.locator('[data-bk-back]').click();
    await page.locator('[data-bk-back]').click();
    await pickSeats(page, 6);
    await page.locator('[data-bk-next]').click();
    await page.locator('[data-slot-pick="s6"]').click();
    await expect(page.locator('[data-setup-pick="movie"] .sc-price')).toHaveText('₹1,700');

    // straight past the add-ons step, which is Date Night only
    await page.locator('[data-setup-pick="movie"]').click();
    await expect(page.locator('#bkTitle')).toContainText('Your details');
    await expect(page.locator('#bkTotal strong')).toHaveText('₹1,700');
    await page.locator('[data-bk-back]').click();
    await expect(page.locator('#bkTitle')).toContainText('Choose your setup');
  });

  test('Karaoke: three or more online, priced per person, total first', async ({ page }) => {
    await freshFlow(page);
    await toSetup(page, 2, 'karaoke');

    const card = page.locator('[data-setup-pick="karaoke"]');
    await expect(card).toContainText(
      'This service is not available for online booking. Please contact us directly at the provided phone number.');
    await card.click();
    await expect(page.locator('.bk-flash')).toContainText('not available for online booking');
    await expect(page.locator('#bkTitle')).toContainText('Choose your setup');

    await page.locator('[data-bk-back]').click();
    await page.locator('[data-bk-back]').click();
    await pickSeats(page, 3);
    await page.locator('[data-bk-next]').click();
    await page.locator('[data-slot-pick="s6"]').click();
    await expect(card.locator('.sc-price')).toHaveText('₹450');
    await expect(card.locator('.sc-per')).toHaveText('₹150 per person');
    await expect(card).toContainText('30 min');

    await card.click();
    // a 30-minute session, from the start of the slot
    await expect(page.locator('.bk-sum')).toContainText('8:45 PM – 9:15 PM');
  });

  test('Karaoke for six or seven is not given a guessed price', async ({ page }) => {
    await freshFlow(page);
    await toSetup(page, 6, 'karaoke');
    const card = page.locator('[data-setup-pick="karaoke"]');
    await expect(card.locator('.sc-price')).toHaveText('Price on call');
    await expect(card).not.toContainText('₹500');
    await expect(card).not.toContainText('₹900');
  });

  test('Watch Party is listed but not bookable online yet', async ({ page }) => {
    await freshFlow(page);
    await toSetup(page, 4, 'watch');
    const card = page.locator('[data-setup-pick="watch"]');
    await expect(card).toContainText('Call to book');
    await card.click();
    await expect(page.locator('#bkTitle')).toContainText('Choose your setup');
  });

  test('will not accept a booking without a name and a valid number', async ({ page }) => {
    await freshFlow(page);
    await toSetup(page, 2);
    await page.locator('[data-setup-pick="movie"]').click();

    await page.locator('[data-bk-next]').click();
    await expect(page.locator('.bk-flash')).toContainText('name');

    await page.fill('#bName', 'Tanishk');
    await page.fill('#bPhone', '12345');
    await page.locator('[data-bk-next]').click();
    await expect(page.locator('.bk-flash')).toContainText('valid 10-digit');

    await page.fill('#bPhone', '9876543210');
    await page.fill('#bEmail', 'a@example.com');
    await page.locator('[data-bk-next]').click();
    await expect(page.locator('.bk-flash')).toContainText('how you would like to pay');

    await page.locator('input[name=bkPay][value=later]').check();
    await page.locator('[data-bk-next]').click();
    await expect(page.locator('#bkTitle')).toContainText("You're on the list");
  });

  test('pay later: clear that nothing has been charged', async ({ page }) => {
    await freshFlow(page);
    await toSetup(page, 2);
    await page.locator('[data-setup-pick="movie"]').click();
    await details(page, 'later');
    await page.locator('[data-bk-next]').click();

    await expect(page.locator('.bk-done')).toContainText('Nothing has been charged');
    await expect(page.locator('.paybox')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('ys-requests'))).toContain('booking-flow');
  });

  test('pay online: Razorpay opens for the right amount, and "paid" only once verified', async ({ page }) => {
    const sent = await freshFlow(page);
    const calls = await mockRazorpay(page, 'pay');
    await toSetup(page, 2);
    await page.locator('[data-setup-pick="movie"]').click();
    await details(page, 'online');
    await expect(page.locator('[data-bk-next]')).toContainText('₹1,500');
    await page.locator('[data-bk-next]').click();

    // the booking is emailed first, marked as not paid yet
    await expect(page.locator('#bkSendState')).toContainText('reached us');
    expect(sent).toHaveLength(1);
    expect(sent[0].Payment).toContain('Not paid yet');

    // then the checkout opens by itself, for this booking, and is verified
    await expect(page.locator('.paybox-done')).toContainText('pay_TEST12345678');
    await expect(page.locator('#bkTitle')).toContainText('paid and on the list');
    const ref = (await page.locator('.bk-ref b').innerText()).trim();
    expect(calls[0]).toMatchObject({ step: 'order', ref, setup: 'movie', guests: 2, expected: 1500 });
    expect(calls[1]).toMatchObject({ step: 'verify', order_id: 'order_TEST123', payment_id: 'pay_TEST12345678' });
    const opts = await page.evaluate(() => (window as any).__rzpOptions);
    expect(opts).toMatchObject({ order_id: 'order_TEST123', amount: 150000, currency: 'INR' });
    expect(opts.prefill).toMatchObject({ contact: '+919876543210', email: 'a@example.com' });
    await expect(page.locator('.bk-sum')).toContainText('Paid online');
  });

  test('decoration only at the decorator\'s hours: none at noon, none at 10:30 PM', async ({ page }) => {
    await freshFlow(page);
    await page.locator('[data-exp-pick="date"]').click();
    await pickSeats(page, 2);
    await page.locator('[data-date-pick]').nth(2).click();
    await page.locator('[data-bk-next]').click();
    // the decorated times are marked: 3:30, 5:15, 7:00 and 8:45 PM
    for (const s of ['s3', 's4', 's5', 's6']) await expect(page.locator(`[data-slot-pick="${s}"] .slot-decor`)).toHaveCount(1);
    for (const s of ['s1', 's2', 's7']) await expect(page.locator(`[data-slot-pick="${s}"] .slot-decor`)).toHaveCount(0);

    await page.locator('[data-slot-pick="s1"]').click();
    await expect(page.locator('#bkTitle')).toContainText('Choose your setup');
    await expect(page.locator('.bk-body')).toContainText('only set up for sessions starting between 2:30 PM and 9:30 PM');
    await expect(page.locator('[data-setup-pick="date"]')).toContainText('no decoration at this time');
    await page.locator('[data-setup-pick="date"]').click();
    // straight on to add-ons: no decoration to pick, and none charged
    await expect(page.locator('[data-decor-pick]')).toHaveCount(0);
    await expect(page.locator('#bkTitle')).toContainText('Make it yours');
    await expect(page.locator('.bk-sum')).not.toContainText('decoration');
    await expect(page.locator('.bk-sum .is-total')).toContainText('₹1,500');

    // back to a decorated time, and the decoration is offered again
    await page.locator('[data-bk-back]').click();
    await page.locator('[data-bk-retime]').click();
    await page.locator('[data-slot-pick="s4"]').click();
    await page.locator('[data-setup-pick="date"]').click();
    await expect(page.locator('[data-decor-pick]')).toHaveCount(3);
  });

  test('closing the checkout leaves the booking unpaid, with a way to pay', async ({ page }) => {
    await freshFlow(page);
    await mockRazorpay(page, 'dismiss');
    await toSetup(page, 2);
    await page.locator('[data-setup-pick="movie"]').click();
    await details(page, 'online');
    await page.locator('[data-bk-next]').click();
    await expect(page.locator('#bkPayState')).toContainText('Payment not made');
    await expect(page.locator('[data-bk-pay]')).toBeEnabled();
    await expect(page.locator('.bk-done')).not.toContainText(/payment received|paid and on the list/i);
    await expect(page.locator('.bk-sum')).toContainText('Online — awaiting payment');
  });

  test('a payment the server cannot verify is never called paid', async ({ page }) => {
    await freshFlow(page);
    await mockRazorpay(page, 'unverified');
    await toSetup(page, 2);
    await page.locator('[data-setup-pick="movie"]').click();
    await details(page, 'online');
    await page.locator('[data-bk-next]').click();
    await expect(page.locator('#bkPayState')).toContainText('Do not pay again');
    await expect(page.locator('.paybox-done')).toHaveCount(0);
  });

  test('without Razorpay keys, nothing is charged and they are told so', async ({ page }) => {
    await freshFlow(page);
    await mockRazorpay(page, 'unavailable');
    await toSetup(page, 2);
    await page.locator('[data-setup-pick="movie"]').click();
    await details(page, 'online');
    await page.locator('[data-bk-next]').click();
    await expect(page.locator('#bkPayState')).toContainText('not available right now');
  });

  test('a double tap sends one booking, and a reload does not send it again', async ({ page }) => {
    const sent = await freshFlow(page);
    await toSetup(page, 2);
    await page.locator('[data-setup-pick="movie"]').click();
    await mockRazorpay(page, 'dismiss');
    await details(page, 'online');
    await page.locator('[data-bk-next]').dblclick();
    await expect(page.locator('#bkSendState')).toContainText('reached us');
    const ref = await page.locator('.bk-ref b').innerText();

    await page.reload();
    await expect(page.locator('.paybox'), 'still waiting on payment after a reload').toBeVisible();
    await expect(page.locator('.bk-ref b')).toHaveText(ref);
    await page.waitForTimeout(500);
    expect(sent).toHaveLength(1);
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
    await expect(page.locator('#bkTotal')).toContainText('Karaoke');
    await expect(page.locator('#bkTotal')).toContainText('5 guests');
  });

  /* Tanishk wanted people to be able to carry a filled-in booking straight into
     his chat. It is an extra way through, so the email must still go, and the
     chat must never be made to look like a payment. */
  test('the confirmation hands the whole booking over to WhatsApp', async ({ page }) => {
    const sent = await freshFlow(page);
    await toSetup(page, 3);
    await page.locator('[data-setup-pick="movie"]').click();
    await details(page, 'later');
    await page.locator('[data-bk-next]').click();
    await expect(page.locator('#bkSendState')).toContainText('reached us', { timeout: 10_000 });

    const ref = (await page.locator('.bk-ref b').textContent())!.trim();
    const wa = page.locator('a[data-wa-booking]');
    await expect(wa).toContainText('Send my booking on WhatsApp');
    await expect(wa).toHaveAttribute('target', '_blank');
    await expect(wa).toHaveAttribute('rel', /noopener/);

    const href = new URL((await wa.getAttribute('href'))!);
    expect(href.origin + href.pathname, 'the business WhatsApp line')
      .toBe('https://wa.me/917999656039');
    const text = href.searchParams.get('text') ?? '';
    expect(text, 'the booking is written out for them').toContain(ref);
    expect(text).toContain('Akash Rai');
    expect(text).toContain('3 recliners');
    expect(text).toMatch(/Movie Space/);
    expect(text).not.toContain('UNVERIFIED');

    // the hand-off is as well as the email, not instead of it
    expect(sent, 'the booking still reached the inbox').toHaveLength(1);
    await expect(page.locator('.bk-done')).toContainText('already with us');
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
