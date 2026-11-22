import { test, expect } from '@playwright/test';

/* Find us (22 Nov 2026) and the real footage of the decoration setups. */

test.describe('find us', () => {
  for (const path of ['/', '/contact/']) {
    test(`${path} shows the way in, with directions to the real place`, async ({ page }) => {
      await page.goto(path);
      const fu = page.locator('#find-us [data-findus]');
      await expect(fu).toBeVisible();
      await expect(fu).toContainText('Jai Nagar Rd');
      await expect(fu).toContainText('Labour Chowk');
      await expect(fu.locator('.fu-steps li')).toHaveCount(4);

      const directions = fu.locator('[data-directions]');
      await expect(directions).toHaveAttribute('href', 'https://www.google.com/maps/dir/?api=1&destination=23.1691299,79.9120691');
      await expect(directions).toHaveAttribute('target', '_blank');
      await expect(fu.getByRole('link', { name: 'Open in Google Maps' }))
        .toHaveAttribute('href', 'https://maps.app.goo.gl/7cWP8xYM7fXmnco36');

      // our own drawing, not an embed: no frame, and the map describes itself
      await expect(fu.locator('iframe')).toHaveCount(0);
      await expect(fu.locator('svg[role="img"] title')).toHaveText(/not to scale/i);
    });
  }

  test('the footer offers directions on every page', async ({ page }) => {
    await page.goto('/faq/');
    await expect(page.locator('footer').getByRole('link', { name: 'Get directions' }))
      .toHaveAttribute('href', /google\.com\/maps\/dir\/\?api=1&destination=23\.1691299,79\.9120691/);
  });

  test('copying the address says it worked, or shows the address', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permission is a Chromium setting');
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/contact/');
    await page.locator('#find-us [data-copy-address]').click();
    await expect(page.locator('#find-us [data-copy-state]')).toContainText('Address copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('Jai Nagar Rd');
  });

  test('the structured data carries the coordinates', async ({ page }) => {
    await page.goto('/');
    const data = JSON.parse(await page.locator('script[type="application/ld+json"]').first().innerText());
    expect(data.geo).toMatchObject({ '@type': 'GeoCoordinates', latitude: 23.1691299, longitude: 79.9120691 });
    expect(data.hasMap).toBe('https://maps.app.goo.gl/7cWP8xYM7fXmnco36');
  });
});

test.describe('real footage of the setups', () => {
  test('Elite and Royal carry silent clips that load nothing until seen', async ({ page }) => {
    await page.goto('/tickets/');
    const films = page.locator('[data-deck] video[data-film]');
    await expect(films).toHaveCount(2);
    for (const id of ['elite', 'royal']) {
      const v = page.locator(`#${id} video[data-film]`);
      await expect(v).toHaveAttribute('preload', 'none');
      await expect(v).toHaveAttribute('poster', /\/media\/.+\.jpg$/);
      expect(await v.evaluate((x: HTMLVideoElement) => x.muted)).toBe(true);
      const res = await page.request.get((await v.getAttribute('src'))!);
      expect(res.status(), id).toBe(200);
      expect(res.headers()['content-type']).toContain('video/mp4');
    }
  });

  test('with reduced motion the clips never show, and the photographs stay', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/tickets/');
    await page.locator('[data-deck]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    for (const v of await page.locator('video[data-film]').all()) {
      await expect(v).toBeHidden();
      expect(await v.evaluate((x: HTMLVideoElement) => x.paused)).toBe(true);
    }
    await expect(page.locator('#elite .card-front img')).toBeVisible();
    await ctx.close();
  });

  test('the booking flow shows the clips on the decoration cards too', async ({ page }) => {
    await page.goto('/book/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('[data-exp-pick="date"]').click();
    await page.locator('[data-date-pick]').nth(2).click();
    await page.locator('[data-bk-next]').click();
    await page.locator('[data-slot-pick="s6"]').click();
    await page.locator('[data-setup-pick="date"]').click();
    await expect(page.locator('[data-decor-pick="elite"] video[data-film]')).toHaveCount(1);
    await expect(page.locator('[data-decor-pick="royal"] video[data-film]')).toHaveCount(1);
    await expect(page.locator('[data-decor-pick="aesthetic"] video[data-film]')).toHaveCount(0);
  });
});
