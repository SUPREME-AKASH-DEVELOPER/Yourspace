import { test, expect } from '@playwright/test';
import { PAGES, NOINDEX } from './pages';

test.describe('SEO and document head', () => {
  for (const path of PAGES) {
    test(`${path} head is complete`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status(), 'HTTP status').toBe(200);

      const title = await page.title();
      expect(title.length, 'title length').toBeGreaterThan(10);
      expect(title.length, 'title length').toBeLessThan(70);

      const desc = await page.locator('meta[name=description]').getAttribute('content');
      expect(desc?.length ?? 0).toBeGreaterThanOrEqual(50);
      expect(desc?.length ?? 0).toBeLessThanOrEqual(165);

      await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', new RegExp(`${path}$`));
      await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
      await expect(page.locator('h1'), 'exactly one h1').toHaveCount(1);
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');

      const robots = await page.evaluate(
        () => document.querySelector<HTMLMetaElement>('meta[name=robots]')?.content ?? '');
      expect(robots.includes('noindex'), `noindex on ${path}`).toBe(NOINDEX.has(path));
    });
  }

  test('titles and descriptions are unique across the site', async ({ page }) => {
    const titles = new Set<string>();
    const descs = new Set<string>();
    for (const path of PAGES) {
      await page.goto(path);
      titles.add(await page.title());
      descs.add(await page.evaluate(
        () => document.querySelector<HTMLMetaElement>('meta[name=description]')?.content ?? ''));
    }
    expect(titles.size).toBe(PAGES.length);
    expect(descs.size).toBe(PAGES.length);
  });

  test('structured data describes the real business only', async ({ page }) => {
    await page.goto('/');
    const raw = await page.locator('script[type="application/ld+json"]').textContent();
    const data = JSON.parse(raw ?? '{}');
    expect(data['@type']).toBe('EntertainmentBusiness');
    expect(data.address.addressLocality).toBe('Jabalpur');
    expect(data.address.addressCountry).toBe('IN');
    // nothing invented: the place has not opened, so there is nothing to rate
    expect(data.aggregateRating).toBeUndefined();
    expect(data.review).toBeUndefined();
  });

  test('robots.txt points at the sitemap', async ({ request }) => {
    const res = await request.get('/robots.txt');
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain('Sitemap:');
    expect(body).toContain('Disallow: /thanks/');
  });

  test('sitemap lists the real pages and excludes the rest', async ({ request }) => {
    const index = await (await request.get('/sitemap-index.xml')).text();
    const match = index.match(/<loc>([^<]+sitemap-0\.xml)<\/loc>/);
    expect(match, 'sitemap-0.xml referenced').toBeTruthy();
    const body = await (await request.get(new URL(match![1]).pathname)).text();
    expect(body).toContain('/programme/');
    expect(body).not.toContain('/thanks/');
    expect(body).not.toContain('/404/');
  });
});
