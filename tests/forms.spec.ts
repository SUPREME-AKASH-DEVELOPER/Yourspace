import { test, expect, type Page } from '@playwright/test';

/** Submitting hands off to WhatsApp; stop that opening tabs mid-test. */
async function muteHandoff(page: Page) {
  await page.addInitScript(() => { window.open = () => null; });
}

const CASES = [
  {
    name: 'pre-book (home)', path: '/', form: '#prebookForm',
    fill: { '#pName': 'Akash', '#pPhone': '9876543210', '#pDate': '2026-12-01' },
    select: { '#pExperience': 'Karaoke' },
  },
  {
    name: 'pre-book (page)', path: '/prebook/', form: '#prebookForm',
    fill: { '#pName': 'Akash', '#pPhone': '9876543210', '#pDate': '2026-12-01' },
    select: { '#pExperience': 'Karaoke' },
  },
  {
    name: 'contact', path: '/contact/', form: '#contactForm',
    fill: { '#cName': 'Akash', '#cPhone': '9876543210', '#cMessage': 'Is the 9th free?' },
    select: { '#cTopic': 'Booking a session' },
  },
  {
    name: 'callback', path: '/contact/', form: '#callbackForm',
    fill: { '#kName': 'Akash', '#kPhone': '9876543210' },
    select: {},
  },
];

test.describe('forms', () => {
  for (const c of CASES) {
    test(`${c.name} refuses empty, accepts valid, then resets`, async ({ page }) => {
      await muteHandoff(page);
      await page.goto(c.path);
      const note = page.locator(`${c.form} .form-note`);

      await page.locator(`${c.form} button[type=submit]`).click();
      await expect(note).toContainText('Please add');
      await expect(note).toHaveClass(/is-err/);

      for (const [sel, val] of Object.entries(c.fill)) await page.fill(sel, val);
      for (const [sel, val] of Object.entries(c.select)) await page.selectOption(sel, val);

      await page.locator(`${c.form} button[type=submit]`).click();
      await expect(note).toContainText('Thanks');
      await expect(note).toHaveClass(/is-ok/);

      const first = Object.keys(c.fill)[0];
      await expect(page.locator(first), 'form cleared').toHaveValue('');
    });
  }

  test('a bad phone number is rejected', async ({ page }) => {
    await muteHandoff(page);
    await page.goto('/contact/');
    await page.fill('#kName', 'Akash');
    await page.fill('#kPhone', '12345');
    await page.locator('#callbackForm button[type=submit]').click();
    await expect(page.locator('#callbackForm .form-note')).toContainText('valid 10-digit');
  });

  test('form text is readable on the paper sections', async ({ page }) => {
    await page.goto('/contact/');
    await page.fill('#kName', 'Akash');
    const [colour, background] = await page.evaluate(() => {
      const input = document.querySelector<HTMLInputElement>('#kName')!;
      const band = input.closest('.band') as HTMLElement;
      return [getComputedStyle(input).color, getComputedStyle(band).backgroundColor];
    });
    expect(colour, 'input text must not match its background').not.toBe(background);
  });

  test('repeated submits do not break anything', async ({ page }) => {
    await muteHandoff(page);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/contact/');
    await page.fill('#kName', 'Akash');
    await page.fill('#kPhone', '9876543210');
    for (let i = 0; i < 6; i++) await page.locator('#callbackForm button[type=submit]').click();
    expect(errors).toEqual([]);
  });

  test('an overlong name is handled', async ({ page }) => {
    await muteHandoff(page);
    await page.goto('/prebook/');
    await page.fill('#pName', 'x'.repeat(600));
    await page.fill('#pPhone', '9876543210');
    await page.selectOption('#pExperience', 'Karaoke');
    await page.fill('#pDate', '2026-12-01');
    await page.locator('#prebookForm button[type=submit]').click();
    await expect(page.locator('#prebookForm .form-note')).toContainText('Thanks');
  });
});
