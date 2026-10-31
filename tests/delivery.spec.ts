import { test, expect, type Page } from '@playwright/test';

const ENDPOINT = 'https://formsubmit.co/**';

/** Pretend the service accepted it, and record what we sent. */
async function acceptAndCapture(page: Page, sink: Record<string, unknown>[]) {
  await page.route(ENDPOINT, async (route) => {
    sink.push(JSON.parse(route.request().postData() ?? '{}'));
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
    expect(body._subject).toContain('Pre-booking');
    expect(body._subject).toContain('Tanishk Sharma');
    expect(body._subject).toContain('7999656039');
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

    await expect(page.locator('#prebookForm .form-note')).toContainText("didn't send");
    // they are handed a way through that does work
    const opened = await page.evaluate(() => (window as any).__opened as string[]);
    expect(opened.join(' ')).toContain('wa.me');
    // and their details are still kept locally
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
    await expect(page.locator('#callbackForm .form-note')).toContainText("didn't send");
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

  test('the team is copied in on every submission', async ({ page }) => {
    const sent: Record<string, unknown>[] = [];
    await acceptAndCapture(page, sent);
    await page.goto('/contact/');
    await page.fill('#kName', 'Akash');
    await page.fill('#kPhone', '9429690584');
    await page.fill('#kEmail', 'akash@example.com');
    await page.locator('#callbackForm button[type=submit]').click();
    await expect(page.locator('#callbackForm .form-note')).toContainText('Thanks');

    const body = sent[0] as Record<string, string>;
    expect(body._cc, 'second recipient copied').toContain('badalakki11@gmail.com');
    expect(body._replyto, 'replying reaches the visitor').toBe('akash@example.com');
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

  test('every form carries the hidden decoy field', async ({ page }) => {
    for (const [path, count] of [['/prebook/', 2], ['/contact/', 3], ['/tickets/', 1]] as const) {
      await page.goto(path);
      await expect(page.locator('input[name=_gotcha]')).toHaveCount(count);
    }
  });

  test('the content policy allows posting to the endpoint', async () => {
    const { readFileSync } = await import('node:fs');
    const headers = readFileSync('dist/_headers', 'utf8');
    expect(headers).toContain('connect-src \'self\' https://formsubmit.co');
  });
});
