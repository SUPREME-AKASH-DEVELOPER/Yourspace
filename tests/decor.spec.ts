import { test, expect } from '@playwright/test';

test.describe('the deck of setups', () => {
  test('all three cards are dealt, with photographs', async ({ page }) => {
    await page.goto('/tickets/');
    await expect(page.locator('[data-card]')).toHaveCount(3);
    for (const id of ['aesthetic', 'elite', 'royal']) {
      await expect(page.locator(`#${id}`)).toBeVisible();
    }
  });

  test('prices match what Tanishk quoted, and the unknown one is not invented', async ({ page }) => {
    await page.goto('/tickets/');
    await expect(page.locator('#aesthetic .card-price-chip')).toHaveText('₹1,000');
    await expect(page.locator('#elite .card-price-chip')).toHaveText('₹2,000');
    // Royal was quoted on 11 Nov; before that the card said "On request"
    await expect(page.locator('#royal .card-price-chip')).toHaveText('₹5,000');
  });

  test('a card turns over and announces that it did', async ({ page }) => {
    await page.goto('/tickets/');
    const card = page.locator('#elite');
    await expect(card).toHaveAttribute('aria-expanded', 'false');

    await card.click();
    await expect(card).toHaveAttribute('aria-expanded', 'true');
    await expect(card.locator('.card-back')).not.toHaveAttribute('inert', '');
    await expect(card.locator('.card-front')).toHaveAttribute('inert', '');

    await card.click();
    await expect(card).toHaveAttribute('aria-expanded', 'false');
    await expect(card.locator('.card-back')).toHaveAttribute('inert', '');
  });

  test('a card turns over from the keyboard', async ({ page }) => {
    await page.goto('/tickets/');
    const card = page.locator('#aesthetic');
    await card.focus();
    await page.keyboard.press('Enter');
    await expect(card).toHaveAttribute('aria-expanded', 'true');
  });

  test('the hidden face is kept out of the tab order', async ({ page }) => {
    await page.goto('/tickets/');
    // the back starts inert, so nothing behind the card can be tabbed to
    for (const id of ['aesthetic', 'elite', 'royal']) {
      await expect(page.locator(`#${id} .card-back`)).toHaveAttribute('inert', '');
    }
  });

  test('"Book this setup" carries the setup into the booking', async ({ page }) => {
    await page.goto('/tickets/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.locator('.card-seat', { has: page.locator('#elite') })
      .getByRole('button', { name: /Book this setup/ }).click();
    await expect(page.locator('#bk')).toBeVisible();

    // it becomes a Date Night with that decoration already chosen
    const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('ys-booking-v3') ?? '{}'));
    expect(saved.setup).toBe('date');
    expect(saved.decor).toBe('elite');
  });
});

test.describe('the reel', () => {
  test('runs every photograph through the strip, twice, so it can loop', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.reel-frame')).toHaveCount(16);
    await expect(page.locator('.reel-frame:not([data-copy])')).toHaveCount(8);
    await expect(page.locator('.reel-rail')).toHaveCount(2);
    // the second copy is scenery: no duplicate links for screen readers
    await expect(page.locator('.reel-frame[aria-hidden="true"]')).toHaveCount(8);
  });

  test('it drifts along on its own', async ({ page }) => {
    await page.goto('/');
    await page.mouse.move(5, 5);
    const track = page.locator('[data-reel-track]');
    const start = await track.evaluate((e) => e.scrollLeft);
    await expect.poll(() => track.evaluate((e) => e.scrollLeft), { timeout: 10_000 })
      .toBeGreaterThan(start + 15);
  });

  test('it holds still while you are reading it', async ({ page }) => {
    await page.goto('/');
    const track = page.locator('[data-reel-track]');
    await page.locator('.reel').first().hover();
    await page.waitForTimeout(600);
    const a = await track.evaluate((e) => e.scrollLeft);
    await page.waitForTimeout(1200);
    const b = await track.evaluate((e) => e.scrollLeft);
    expect(Math.abs(b - a), 'hovering should hold it').toBeLessThan(4);
  });

  test('pause and captions can be switched', async ({ page }) => {
    await page.goto('/');
    await page.mouse.move(5, 5);
    const play = page.locator('[data-reel-play]');
    await expect(play).toHaveAttribute('aria-pressed', 'true');
    await play.click();
    await expect(play).toHaveAttribute('aria-pressed', 'false');

    const cc = page.locator('[data-reel-cc]');
    await expect(page.locator('.reel-cc').first()).toHaveCSS('opacity', '1');
    await cc.click();
    await expect(cc).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.reel-cc').first()).toHaveCSS('opacity', '0');
  });

  test('the arrows move it, and stop at the ends', async ({ page }) => {
    await page.goto('/');
    // the strip drifts on its own, so hold it still before judging the arrows
    await page.locator('[data-reel-play]').click();
    await page.evaluate(() => { document.querySelector('[data-reel-track]')!.scrollLeft = 0; });
    const track = page.locator('[data-reel-track]');
    await expect(page.locator('[data-reel-prev]')).toBeDisabled();

    await page.locator('[data-reel-next]').click();
    // smooth scrolling can take a moment when the machine is busy
    await expect.poll(() => track.evaluate((e) => e.scrollLeft), { timeout: 10_000 })
      .toBeGreaterThan(50);
    await expect(page.locator('[data-reel-prev]')).toBeEnabled({ timeout: 10_000 });
  });

  test('the strip is reachable and steerable by keyboard', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-reel-play]').click();     // stop the drift first
    const track = page.locator('[data-reel-track]');
    await track.focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => track.evaluate((e) => e.scrollLeft), { timeout: 10_000 })
      .toBeGreaterThan(50);
  });

  test('every frame loads and describes itself', async ({ page }) => {
    await page.goto('/');
    // frames further along the strip load lazily; ask for them all up front
    // rather than relying on a scripted scroll to trip the loader
    await page.evaluate(() => {
      document.querySelectorAll<HTMLImageElement>('.reel-frame:not([data-copy]) img')
        .forEach((i) => i.setAttribute('loading', 'eager'));
    });

    await expect
      .poll(() => page.evaluate(() =>
        [...document.querySelectorAll<HTMLImageElement>('.reel-frame:not([data-copy]) img')]
          .filter((i) => !i.complete || i.naturalWidth === 0).length), { timeout: 20_000 })
      .toBe(0);

    // the second copy of the strip is scenery and carries empty alt on purpose
    const thin = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLImageElement>('.reel-frame:not([data-copy]) img')]
        .filter((i) => (i.getAttribute('alt') ?? '').trim().length < 20).length);
    expect(thin, 'each real frame needs a description').toBe(0);
  });
});

test.describe('photographs in general', () => {
  test('are served as modern, resized files with dimensions', async ({ page }) => {
    await page.goto('/tickets/');
    const srcs = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLImageElement>('.card img')].map((i) => i.currentSrc || i.src));
    expect(srcs.length).toBeGreaterThan(0);
    expect(srcs.every((s) => /\.(webp|avif)/.test(s)), `got ${srcs[0]}`).toBe(true);

    const sized = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLImageElement>('.card img')]
        .every((i) => i.hasAttribute('width') && i.hasAttribute('height')));
    expect(sized, 'width/height stop the page jumping as they load').toBe(true);
  });

  test('open full size and close again', async ({ page }) => {
    await page.goto('/');
    const frame = page.locator('.reel-shot').first();
    await frame.click();

    const box = page.locator('#lightbox');
    await expect(box).toHaveJSProperty('open', true);
    await expect(page.locator('#lightboxCap')).not.toBeEmpty();

    await page.keyboard.press('Escape');
    await expect(box).toHaveJSProperty('open', false);
    await expect(frame, 'focus returns to the frame').toBeFocused();
  });

  test('the screenshot caption was cropped off the source', async () => {
    // royal-2 arrived with "Bare minimum?" burned across the top. It was cropped,
    // so the file must be shorter than the 1600px it came in at.
    const { default: sharp } = await import('sharp');
    const meta = await sharp('src/assets/decor/royal-2.jpeg').metadata();
    expect(meta.height, 'top band should be gone').toBeLessThan(1500);
    expect(meta.width).toBe(1098);
  });

  test('the room page no longer claims there are no pictures', async ({ page }) => {
    await page.goto('/room/');
    await expect(page.locator('body')).not.toContainText("haven't photographed the room yet");
  });
});
