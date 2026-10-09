import { test, expect } from '@playwright/test';
import { PAGES } from './pages';

/** Kept in step with src/data/site.ts. */
const PRIMARY = { raw: '+919429690584', pretty: '+91 94296 90584' };
const SECOND  = { raw: '+917999656039', pretty: '+91 79996 56039' };

test.describe('contact details', () => {
  test('both numbers are published on the contact page', async ({ page }) => {
    await page.goto('/contact/');
    const info = page.locator('.infolist');          // the footer lists them too
    await expect(info.locator('[data-phone-text]')).toHaveText(PRIMARY.pretty);
    await expect(info.locator('[data-phone-alt]')).toHaveText(SECOND.pretty);
  });

  test('both numbers are callable', async ({ page }) => {
    await page.goto('/contact/');
    const info = page.locator('.infolist');
    await expect(info.locator('a[data-call]')).toHaveAttribute('href', `tel:${PRIMARY.raw}`);
    await expect(info.locator('a[data-phone-alt]')).toHaveAttribute('href', `tel:${SECOND.raw}`);
  });

  test('the footer carries both lines on every page', async ({ page }) => {
    for (const path of PAGES) {
      await page.goto(path);
      const footer = page.locator('.colophon');
      await expect(footer.locator('[data-phone-text]'), `primary on ${path}`).toHaveText(PRIMARY.pretty);
      await expect(footer.locator('[data-phone-alt]'), `second on ${path}`).toHaveText(SECOND.pretty);
    }
  });

  /**
   * The EthixWeb SOP calls this the cross-contamination check: the same
   * business details, identical, everywhere they appear.
   */
  test('no page shows a number that is not ours', async ({ page }) => {
    const allowed = new Set([PRIMARY.pretty, SECOND.pretty]);
    for (const path of PAGES) {
      await page.goto(path);
      const found = await page.evaluate(() => {
        const text = document.body.innerText;
        // any +91 number, however it is spaced
        return [...text.matchAll(/\+91[\s-]?\d{5}[\s-]?\d{5}/g)].map((m) => m[0]);
      });
      for (const n of found) {
        expect(allowed.has(n.replace(/[\s-]+/g, ' ').trim()), `${n} on ${path}`).toBe(true);
      }
    }
  });

  test('tel: links never disagree with the printed number', async ({ page }) => {
    for (const path of PAGES) {
      await page.goto(path);
      const pairs = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLAnchorElement>('a[href^="tel:"]')]
          .map((a) => ({ href: a.getAttribute('href')!.replace('tel:', ''), text: a.innerText.trim() })));
      for (const { href, text } of pairs) {
        if (!/\d/.test(text)) continue;             // "Call us" style links
        expect(text.replace(/[\s-]+/g, ''), `${path}`).toBe(href);
      }
    }
  });

  test('structured data lists both numbers', async ({ page }) => {
    await page.goto('/');
    const data = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() ?? '{}');
    expect(data.telephone).toEqual([PRIMARY.raw, SECOND.raw]);
  });

  test('WhatsApp still goes to the primary line', async ({ page }) => {
    await page.goto('/contact/');
    const href = await page.locator('a[data-wa]').first().getAttribute('href');
    expect(href).toContain('wa.me/919429690584');
  });
});
