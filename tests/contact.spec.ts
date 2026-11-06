import { test, expect } from '@playwright/test';
import { PAGES } from './pages';

/**
 * Kept in step with src/data/site.ts. YourSpace publishes one number: calls
 * and WhatsApp both come to it (Akash/Tanishk, Nov 2026). RETIRED is the line
 * that used to be on the site and must not come back by accident.
 */
const PRIMARY = { raw: '+917999656039', pretty: '+91 79996 56039' };
const WA = PRIMARY;
const RETIRED = '+91 94296 90584';

test.describe('contact details', () => {
  test('the number is published on the contact page', async ({ page }) => {
    await page.goto('/contact/');
    const info = page.locator('.infolist');          // the footer lists it too
    await expect(info.locator('[data-phone-text]')).toHaveText(PRIMARY.pretty);
  });

  test('the number is callable', async ({ page }) => {
    await page.goto('/contact/');
    await expect(page.locator('.infolist a[data-call]')).toHaveAttribute('href', `tel:${PRIMARY.raw}`);
  });

  test('the footer carries the number on every page, and no empty second line', async ({ page }) => {
    for (const path of PAGES) {
      await page.goto(path);
      const footer = page.locator('.colophon');
      await expect(footer.locator('[data-phone-text]'), `number on ${path}`).toHaveText(PRIMARY.pretty);
      // with no second line set, its slot is taken out rather than left blank
      await expect(footer.locator('[data-phone-alt]'), `no empty slot on ${path}`).toHaveCount(0);
    }
  });

  test('the retired line is nowhere on the site', async ({ page }) => {
    for (const path of PAGES) {
      await page.goto(path);
      const body = await page.evaluate(() => document.body.innerText);
      expect(body.includes(RETIRED), `${RETIRED} still on ${path}`).toBe(false);
      const links = await page.evaluate(() =>
        [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') ?? '').join(' '));
      expect(links.includes('9429690584'), `a link still points at it on ${path}`).toBe(false);
    }
  });

  /**
   * The EthixWeb SOP calls this the cross-contamination check: the same
   * business details, identical, everywhere they appear.
   */
  test('no page shows a number that is not ours', async ({ page }) => {
    const allowed = new Set([PRIMARY.pretty]);
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

  test('structured data lists the one number', async ({ page }) => {
    await page.goto('/');
    const data = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() ?? '{}');
    expect(data.telephone).toBe(PRIMARY.raw);
  });

  test('WhatsApp is offered for information, to the configured number, with a message', async ({ page }) => {
    for (const path of ['/contact/', '/book/']) {
      await page.goto(path);
      const strip = page.locator('.wa-strip');
      await expect(strip, path).toContainText('For more information');
      const a = strip.locator('a[data-whatsapp]');
      await expect(a).toContainText('Contact us on WhatsApp');
      await expect(a).toHaveAttribute('target', '_blank');
      await expect(a).toHaveAttribute('rel', /noopener/);
      const href = new URL((await a.getAttribute('href'))!);
      expect(href.origin + href.pathname).toBe(`https://wa.me/${WA.raw.replace('+', '')}`);
      expect(href.searchParams.get('text')).toMatch(/^Hi YourSpace/);
    }
  });

  test('every WhatsApp link on a page is one of ours — no stray numbers', async ({ page }) => {
    for (const path of ['/', '/contact/', '/prebook/', '/thanks/', '/tickets/']) {
      await page.goto(path);
      const hrefs = await page.evaluate(() =>
        [...document.querySelectorAll('a[href*="wa.me"], a[href*="whatsapp"]')]
          .map((a) => [a.getAttribute('href') ?? '', a.hasAttribute('data-whatsapp')] as const));
      expect(hrefs.length, `${path} has the footer link`).toBeGreaterThan(0);
      for (const [h, tagged] of hrefs) {
        expect(tagged, `${path}: ${h}`).toBe(true);
        expect(h.startsWith(`https://wa.me/${WA.raw.replace('+', '')}`), `${path}: ${h}`).toBe(true);
      }
    }
  });
});
