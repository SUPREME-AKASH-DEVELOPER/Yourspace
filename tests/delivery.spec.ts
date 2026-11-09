import { test, expect, type Page } from '@playwright/test';
import { readBody, pickSeats } from './helpers';

const ENDPOINT = /\/api\/send|formsubmit\.co|api\.web3forms\.com/;

/** Pretend the service accepted it, and record what we sent. */
async function acceptAndCapture(page: Page, sink: Record<string, unknown>[]) {
  await page.route(ENDPOINT, async (route) => {
    sink.push(readBody(route.request().postData()));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: 'true', message: 'sent' }),
    });
  });
}

async function fail(page: Page) {
  await page.route(ENDPOINT, (route) => route.abort('failed'));
}

test.describe('submissions actually go somewhere', () => {
  test('a pre-booking is posted to the endpoint', async ({ page }) => {
    const sent: Record<string, unknown>[] = [];
    await acceptAndCapture(page, sent);
    await page.goto('/prebook/');

    await page.fill('#pName', 'Tanishk Sharma');
    await page.fill('#pPhone', '7999656039');
    await page.fill('#pEmail', 'tanishk@example.com');
    await page.selectOption('#pExperience', 'Karaoke');
    await page.fill('#pDate', '2026-12-01');
    await page.fill('#pNotes', 'Cake for 8');
    await page.locator('#prebookForm button[type=submit]').click();

    await expect(page.locator('#prebookForm .form-note')).toContainText('Thanks Tanishk');
    expect(sent, 'exactly one request').toHaveLength(1);

    const body = sent[0] as Record<string, string>;
    // the email reads as labels, not field names
    expect(body.Name).toBe('Tanishk Sharma');
    expect(body.Phone).toBe('7999656039');
    expect(body.Occasion).toBe('Karaoke');
    expect(body['Preferred date']).toBe('2026-12-01');
    expect(body.Notes).toBe('Cake for 8');
    expect(body.Received, 'when it arrived').toBeTruthy();
    expect(body['Came from']).toBe('/prebook/');
    // the subject says who it is from at a glance
    const subject = body._subject ?? body.subject;
    expect(subject).toContain('Pre-booking');
    expect(subject).toContain('Tanishk Sharma');
    expect(subject).toContain('7999656039');
    // no raw field names leak through
    expect(body.name).toBeUndefined();
  });

  test('the hero enquiry posts too', async ({ page }) => {
    const sent: Record<string, unknown>[] = [];
    await acceptAndCapture(page, sent);
    await page.goto('/tickets/');

    await page.locator('.hero-enquiry input[name=name]').fill('Akash');
    await page.locator('.hero-enquiry input[name=phone]').fill('9429690584');
    await page.locator('.hero-enquiry input[name=email]').fill('akash@example.com');
    await page.locator('.hero-enquiry button[type=submit]').click();

    await expect(page.locator('.hero-enquiry .form-note')).toContainText('Thanks Akash');
    expect(sent).toHaveLength(1);
    expect((sent[0] as Record<string, string>).Phone).toBe('9429690584');
  });

  test('the contact form posts the message', async ({ page }) => {
    const sent: Record<string, unknown>[] = [];
    await acceptAndCapture(page, sent);
    await page.goto('/contact/');

    await page.fill('#cName', 'Akash');
    await page.fill('#cPhone', '9429690584');
    await page.fill('#cEmail', 'akash@example.com');
    await page.selectOption('#cTopic', 'Booking a session');
    await page.fill('#cMessage', 'Is the 9th free?');
    await page.locator('#contactForm button[type=submit]').click();

    await expect(page.locator('#contactForm .form-note')).toContainText('with us');
    expect((sent[0] as Record<string, string>).Message).toBe('Is the 9th free?');
  });

  test('the button says what it is doing and comes back', async ({ page }) => {
    await page.route(ENDPOINT, async (route) => {
      await new Promise((r) => setTimeout(r, 700));
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":"true"}' });
    });
    await page.goto('/contact/');
    await page.fill('#kName', 'Akash');
    await page.fill('#kPhone', '9429690584');
    await page.fill('#kEmail', 'akash@example.com');

    const button = page.locator('#callbackForm button[type=submit]');
    await button.click();
    await expect(button).toBeDisabled();
    await expect(page.locator('#callbackForm .form-note')).toContainText('Sending');

    await expect(button).toBeEnabled({ timeout: 10_000 });
    await expect(button).toContainText('Request a call back');
  });

  test('nothing is lost when the network refuses', async ({ page }) => {
    await fail(page);
    await page.addInitScript(() => { (window as any).__opened = []; window.open = (u) => { (window as any).__opened.push(String(u)); return null; }; });
    await page.goto('/prebook/');

    await page.fill('#pName', 'Akash');
    await page.fill('#pPhone', '9429690584');
    await page.fill('#pEmail', 'akash@example.com');
    await page.selectOption('#pExperience', 'Karaoke');
    await page.fill('#pDate', '2026-12-01');
    await page.locator('#prebookForm button[type=submit]').click();

    await expect(page.locator('#prebookForm .form-note')).toContainText('connection dropped');
    // email is the only route now: nothing is opened elsewhere
    const opened = await page.evaluate(() => (window as any).__opened as string[]);
    expect(opened, 'no hand-off to another channel').toEqual([]);
    // what they typed is still on screen, so one more press is all it takes
    await expect(page.locator('#pName')).toHaveValue('Akash');
    await expect(page.locator('#pPhone')).toHaveValue('9429690584');
    // and a copy is kept locally
    const saved = await page.evaluate(() => localStorage.getItem('ys-requests'));
    expect(saved).toContain('9429690584');
  });

  test('a refusal from the service is treated as a failure, not a success', async ({ page }) => {
    await page.route(ENDPOINT, (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: 'false', message: 'not activated' }),
    }));
    await page.addInitScript(() => { window.open = () => null; });
    await page.goto('/contact/');
    await page.fill('#kName', 'Akash');
    await page.fill('#kPhone', '9429690584');
    await page.fill('#kEmail', 'akash@example.com');
    await page.locator('#callbackForm button[type=submit]').click();
    const note = page.locator('#callbackForm .form-note');
    await expect(note).toContainText("couldn't send");
    await expect(note).toContainText('Nothing you typed has been lost');
    await expect(note, 'a refusal is not a dropped line').not.toContainText('connection dropped');
  });

  test('someone who leaves an email gets a confirmation written back', async ({ page }) => {
    const sent: Record<string, unknown>[] = [];
    await acceptAndCapture(page, sent);
    await page.goto('/contact/');
    await page.fill('#cName', 'Akash');
    await page.fill('#cPhone', '9429690584');
    await page.fill('#cEmail', 'akash@example.com');
    await page.selectOption('#cTopic', 'Booking a session');
    await page.fill('#cMessage', 'Hello');
    await page.locator('#contactForm button[type=submit]').click();
    await expect(page.locator('#contactForm .form-note')).toContainText('with us');

    const reply = (sent[0] as Record<string, string>)._autoresponse;
    expect(reply, 'an auto-reply is included').toBeTruthy();
    expect(reply).toContain('Thanks Akash');
    expect(reply).toContain('Nothing has been charged');
    expect(reply).toContain('Jabalpur');
    // it reads their own answers back to them
    expect(reply).toContain('Phone: 9429690584');
    expect(reply).toContain('About: Booking a session');
    // but never quotes their address back at them
    expect(reply).not.toContain('Email: akash@example.com');
  });

  test('every form asks for an email, so everyone can be thanked', async ({ page }) => {
    for (const [path, ids] of [
      ['/prebook/', ['#pEmail']],
      ['/contact/', ['#cEmail', '#kEmail']],
      ['/tickets/', ['.hero-enquiry input[name=email]']],
    ] as const) {
      await page.goto(path);
      for (const id of ids) {
        await expect(page.locator(id), `${path} ${id}`).toBeVisible();
        await expect(page.locator(id)).toHaveAttribute('data-req', '');
      }
    }
  });

  test('a submission without an email is refused', async ({ page }) => {
    await page.goto('/contact/');
    await page.fill('#kName', 'Akash');
    await page.fill('#kPhone', '9429690584');
    await page.locator('#callbackForm button[type=submit]').click();
    await expect(page.locator('#callbackForm .form-note')).toContainText('your email');
  });

  test('only the two intended addresses are ever used', async ({ page }) => {
    // the endpoint is built from notifyPrimary, so check both in one place
    await page.goto('/');
    const bundle = await page.evaluate(async () => {
      const src = [...document.querySelectorAll('script[src]')]
        .map((s) => (s as HTMLScriptElement).src).find((u) => u.includes('_astro')) ?? '';
      return src ? (await fetch(src)).text() : '';
    });
    const addresses = [...new Set(bundle.match(/[\w.+-]+@[\w.-]+\.\w+/g) ?? [])]
      .filter((a) => !a.endsWith('example.com'));
    expect(addresses.sort()).toEqual(['badalakki11@gmail.com', 'tanishkofficial27@gmail.com']);
  });

  test('replies reach the visitor, and the browser names no one to copy', async ({ page }) => {
    const sent: Record<string, unknown>[] = [];
    await acceptAndCapture(page, sent);
    await page.goto('/contact/');
    await page.fill('#kName', 'Akash');
    await page.fill('#kPhone', '9429690584');
    await page.fill('#kEmail', 'akash@example.com');
    await page.locator('#callbackForm button[type=submit]').click();
    await expect(page.locator('#callbackForm .form-note')).toContainText('Thanks');

    const body = sent[0] as Record<string, string>;
    // who is copied is decided on the server (tests/email-api.spec.ts). The
    // browser must not send ccemail: Web3Forms' free plan refuses the lot if it does.
    expect(body.ccemail, 'never sent').toBeUndefined();
    expect(body._replyto ?? body.replyto, 'replying reaches the visitor').toBe('akash@example.com');
  });

  test('a bot that fills the hidden field is quietly dropped', async ({ page }) => {
    const sent: Record<string, unknown>[] = [];
    await acceptAndCapture(page, sent);
    await page.goto('/prebook/');

    await page.fill('#pName', 'Spam Bot');
    await page.fill('#pPhone', '9429690584');
    await page.fill('#pEmail', 'bot@example.com');
    await page.selectOption('#pExperience', 'Karaoke');
    await page.fill('#pDate', '2026-12-01');
    await page.evaluate(() => {
      document.querySelector<HTMLInputElement>('#prebookForm [name=_gotcha]')!.value = 'http://spam';
    });
    await page.locator('#prebookForm button[type=submit]').click();

    await page.waitForTimeout(600);
    expect(sent, 'nothing posted for a bot').toHaveLength(0);
  });

  test('the booking flow emails the whole booking', async ({ page }) => {
    const sent: Record<string, unknown>[] = [];
    await acceptAndCapture(page, sent);
    await page.goto('/book/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.locator('[data-exp-pick="karaoke"]').click();
    await pickSeats(page, 5);
    await page.locator('[data-date-pick]').nth(2).click();
    await page.locator('[data-bk-next]').click();
    await page.locator('[data-slot-pick="s4"]').click();
    await page.locator('[data-setup-pick="karaoke"]').click();

    await page.fill('#bName', 'Tanishk Sharma');
    await page.fill('#bPhone', '7999656039');
    await page.fill('#bEmail', 'tanishk@example.com');
    await page.locator('input[name=bkPay][value=later]').check();
    await page.locator('[data-bk-next]').click();

    await expect(page.locator('#bkTitle')).toContainText("You're on the list");
    await expect(page.locator('#bkSendState')).toContainText('reached us', { timeout: 10_000 });

    expect(sent, 'the booking was posted').toHaveLength(1);
    const body = sent[0] as Record<string, string>;
    expect(body.Name).toBe('Tanishk Sharma');
    expect(body.Occasion).toBe('Karaoke');
    expect(body.Guests).toBe('5');
    expect(body.Karaoke).toBe('₹750');
    expect(body['Date & time']).toContain('4:30 PM – 5:00 PM');
    expect(body.Total).toBe('₹750');
    expect(body.Payment).toContain('Nothing paid');
    expect(body['Booking ref']).toMatch(/^YS-/);
    expect(body._autoresponse).toContain('Thanks Tanishk');
  });

  test('a booking needs an email before it can be confirmed', async ({ page }) => {
    await page.goto('/book/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('[data-exp-pick="date"]').click();
    await page.locator('[data-date-pick]').nth(2).click();
    await page.locator('[data-bk-next]').click();
    await page.locator('[data-slot-pick="s8"]').click();
    await page.locator('[data-setup-pick="movie"]').click();
    await page.fill('#bName', 'Akash');
    await page.fill('#bPhone', '9429690584');
    await page.locator('[data-bk-next]').click();
    await expect(page.locator('.bk-flash')).toContainText('email');
  });

  test('a booking that cannot be emailed says so', async ({ page }) => {
    await fail(page);
    await page.goto('/book/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('[data-exp-pick="date"]').click();
    await page.locator('[data-date-pick]').nth(2).click();
    await page.locator('[data-bk-next]').click();
    await page.locator('[data-slot-pick="s8"]').click();
    await page.locator('[data-setup-pick="movie"]').click();
    await page.fill('#bName', 'Akash');
    await page.fill('#bPhone', '9429690584');
    await page.fill('#bEmail', 'a@example.com');
    await page.locator('input[name=bkPay][value=later]').check();
    await page.locator('[data-bk-next]').click();
    await expect(page.locator('#bkSendState')).toContainText("didn't reach us", { timeout: 15_000 });
  });

  test('no form hands the visitor off to WhatsApp — the WhatsApp link is for questions only', async ({ page }) => {
    for (const path of ['/', '/prebook/', '/contact/', '/book/', '/thanks/', '/tickets/']) {
      await page.goto(path);
      const stray = await page.evaluate(() =>
        [...document.querySelectorAll('form a[href], form[action], a[href]')]
          .filter((el) => !el.hasAttribute('data-whatsapp'))
          .map((el) => el.getAttribute('href') ?? el.getAttribute('action') ?? '')
          .filter((h) => h.includes('wa.me') || h.includes('whatsapp')));
      expect(stray, `${path} should send nothing to WhatsApp except the contact link`).toEqual([]);
      await expect(page.locator('form a[data-whatsapp]'), path).toHaveCount(0);
    }
  });

  test('every form carries the hidden decoy field', async ({ page }) => {
    for (const [path, count] of [['/prebook/', 2], ['/contact/', 3], ['/tickets/', 1]] as const) {
      await page.goto(path);
      await expect(page.locator('input[name=_gotcha]')).toHaveCount(count);
    }
  });

  test('the content policy allows exactly the service in use', async () => {
    const { readFileSync } = await import('node:fs');
    const headers = readFileSync('dist/_headers', 'utf8');
    const csp = headers.match(/connect-src [^;]*/)?.[0] ?? '';
    expect(csp).toMatch(/formsubmit\.co|api\.web3forms\.com/);
  });

  test('a rate limit is reported as busy, not as a dead connection', async ({ page }) => {
    let calls = 0;
    await page.route(ENDPOINT, (route) => {
      calls++;
      return route.fulfill({
        status: 429, contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Rate limit exceeded. Please try again later.' }),
      });
    });
    await page.goto('/contact/');
    await page.fill('#kName', 'Akash');
    await page.fill('#kPhone', '9429690584');
    await page.fill('#kEmail', 'a@example.com');
    await page.locator('#callbackForm button[type=submit]').click();

    const note = page.locator('#callbackForm .form-note');
    await expect(note).toContainText('a lot of messages');
    await expect(note).not.toContainText('connection dropped');
    expect(calls, 'a rate limit must not be hammered with a retry').toBe(1);
  });

  test('a dropped connection is retried once', async ({ page }) => {
    let calls = 0;
    await page.route(ENDPOINT, (route) => {
      calls++;
      return calls === 1
        ? route.abort('failed')
        : route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":"true"}' });
    });
    await page.goto('/contact/');
    await page.fill('#kName', 'Akash');
    await page.fill('#kPhone', '9429690584');
    await page.fill('#kEmail', 'a@example.com');
    await page.locator('#callbackForm button[type=submit]').click();
    await expect(page.locator('#callbackForm .form-note')).toContainText('Thanks', { timeout: 15_000 });
    expect(calls, 'one retry after a network failure').toBe(2);
  });
});
