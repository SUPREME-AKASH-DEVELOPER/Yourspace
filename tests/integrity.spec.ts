import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { PAGES } from './pages';

test.describe('site integrity', () => {
  test('no console errors or failed requests anywhere', async ({ page }) => {
    const errors: string[] = [];
    const failed: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    // WebKit's own media controls log this for an autoplaying video; it comes from
    // the browser's internals, not from the page, and visitors never see it
    const browserNoise = /^Button failed to load, iconName = [a-z-]+-placard/;
    page.on('console', (m) => { if (m.type() === 'error' && !browserNoise.test(m.text())) errors.push(m.text()); });
    page.on('requestfailed', (r) => failed.push(r.url()));

    for (const path of PAGES) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
    }
    expect(errors).toEqual([]);
    expect(failed).toEqual([]);
  });

  test('every internal link resolves', async ({ page, request }) => {
    const seen = new Set<string>();
    for (const path of PAGES) {
      await page.goto(path);
      const hrefs = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLAnchorElement>('a[href]')]
          .map((a) => a.getAttribute('href') ?? '')
          .filter((h) => h.startsWith('/')));
      for (const href of hrefs) seen.add(href.split('#')[0]);
    }
    for (const href of seen) {
      if (!href) continue;
      const res = await request.get(href);
      expect(res.status(), `link ${href}`).toBeLessThan(400);
    }
  });

  test('prices on the tickets page match what the flow charges', async ({ page }) => {
    await page.goto('/tickets/');
    const listed = await page.locator('.leaders li', { hasText: 'small red rose bouquet' }).locator('b').innerText();
    const movie = await page.locator('.pkg', { hasText: 'Movie Space' }).locator('.pkg-price').innerText();

    await page.goto('/book/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('[data-exp-pick="date"]').click();
    await page.locator('[data-date-pick]').nth(2).click();
    await page.locator('[data-bk-next]').click();
    await page.locator('[data-slot-pick="s6"]').click();
    const movieCharged = await page.locator('[data-setup-pick="movie"] .sc-price').innerText();
    await page.locator('[data-setup-pick="date"]').click();
    await page.locator('[data-decor-pick="aesthetic"]').click();
    const charged = await page.locator('[data-addon-pick="bouquet-s"] .ad-price').innerText();

    expect(charged).toContain(listed.trim());
    expect(movie).toContain(movieCharged.trim());
  });

  test('security headers are generated for the host', () => {
    // _headers is consumed by the host (Netlify / Cloudflare Pages), not served,
    // so assert on the built artefact itself
    expect(existsSync('dist/_headers'), 'dist/_headers exists').toBe(true);
    const body = readFileSync('dist/_headers', 'utf8');
    expect(body).toContain('Content-Security-Policy');
    expect(body).toContain("frame-ancestors 'none'");
    expect(body).toContain("object-src 'none'");
    expect(body).toContain('X-Content-Type-Options: nosniff');
    expect(body).toContain('Strict-Transport-Security');
    expect(body).toContain('Referrer-Policy: strict-origin-when-cross-origin');
    // inline scripts are allowed by hash, never by blanket unsafe-inline
    expect(body).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(body).toMatch(/script-src 'self' https:\/\/checkout\.razorpay\.com https:\/\/\*\.razorpay\.com 'sha256-/);
    // Razorpay's checkout window, and the popups banks open from it
    expect(body).toContain('frame-src https://api.razorpay.com https://checkout.razorpay.com');
    expect(body).toContain('Cross-Origin-Opener-Policy: same-origin-allow-popups');
    expect(body).toContain('Cache-Control: public, max-age=31536000, immutable');
  });

  test('no secrets or absolute local paths leak into the build', () => {
    const html = readFileSync('dist/index.html', 'utf8');
    expect(html).not.toMatch(/\/Users\//);
    expect(html).not.toMatch(/sk-[A-Za-z0-9]{12}/);
    expect(html).not.toMatch(/BEGIN (RSA |EC )?PRIVATE KEY/);
  });

  test('no third-party requests are made', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (r) => {
      const url = new URL(r.url());
      if (url.hostname !== 'localhost' && url.protocol !== 'data:') external.push(r.url());
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(external).toEqual([]);
  });
});

test.describe('the security policy reaches the live host', () => {
  // Vercel ignores _headers, so every page carries the policy itself (QA, 22 Nov 2026).
  test('every page carries a Content-Security-Policy before any script', async ({ page }) => {
    for (const path of ['/', '/book/', '/tickets/', '/contact/', '/admin/']) {
      const html = await (await page.request.get(path)).text();
      const at = html.indexOf('http-equiv="Content-Security-Policy"');
      expect(at, `${path} has a policy`).toBeGreaterThan(-1);
      const firstScript = html.search(/<script\b/i);
      if (firstScript > -1) expect(at, `${path} policy comes before the first script`).toBeLessThan(firstScript);
      const policy = html.slice(at, html.indexOf('>', at));
      expect(policy).toContain("object-src 'none'");
      expect(policy).toContain('checkout.razorpay.com');
      expect(policy).not.toContain('frame-ancestors');
    }
  });
});
