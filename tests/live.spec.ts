import { test, expect, type Browser } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { PAGES } from './pages';

/** Pin the clock so the time-aware theme is deterministic. */
async function atTime(browser: Browser, iso: string) {
  const ctx = await browser.newContext();
  await ctx.addInitScript(`
    const Real = Date;
    const fixed = new Real('${iso}').getTime();
    class Pinned extends Real {
      constructor(...a) { if (!a.length) super(fixed); else super(...a); }
      static now() { return fixed; }
    }
    window.Date = Pinned;
  `);
  return ctx;
}

const DAYPARTS = [
  { label: 'morning',   iso: '2026-10-09T08:30:00', greeting: 'Good morning' },
  { label: 'afternoon', iso: '2026-10-09T13:30:00', greeting: 'Good afternoon' },
  { label: 'evening',   iso: '2026-10-09T18:30:00', greeting: 'Good evening' },
  { label: 'night',     iso: '2026-10-09T23:30:00', greeting: 'Still up' },
];

test.describe('the site reacts to the time of day', () => {
  for (const part of DAYPARTS) {
    test(`${part.label}: theme, greeting and suggestion`, async ({ browser }) => {
      const ctx = await atTime(browser, part.iso);
      const page = await ctx.newPage();
      await page.goto('/');

      await expect(page.locator('html')).toHaveAttribute('data-daypart', part.label);
      await expect(page.locator('[data-greeting]')).toHaveText(part.greeting);
      await expect(page.locator('[data-daily-pick]')).toContainText('Good for a Friday');
      await ctx.close();
    });

    test(`${part.label}: contrast still passes`, async ({ browser }) => {
      const ctx = await atTime(browser, part.iso);
      const page = await ctx.newPage();
      await page.goto('/');
      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(violations.map((v) => v.id), `${part.label} palette`).toEqual([]);
      await ctx.close();
    });
  }

  test('the accent actually differs between day and night', async ({ browser }) => {
    const read = async (iso: string) => {
      const ctx = await atTime(browser, iso);
      const page = await ctx.newPage();
      await page.goto('/');
      const amber = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--amber').trim());
      await ctx.close();
      return amber;
    };
    expect(await read('2026-10-09T08:30:00')).not.toBe(await read('2026-10-09T23:30:00'));
  });

  test('without JavaScript the page still renders a sane theme', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('/');
    // no daypart attribute, so the base palette applies and nothing is invisible
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('[data-greeting]')).toHaveText('Now booking');
    await ctx.close();
  });
});

test.describe('heritage marks', () => {
  test('the city is set in Devanagari in the footer', async ({ page }) => {
    await page.goto('/');
    const mark = page.locator('.devanagari');
    await expect(mark).toHaveText('जबलपुर');
    await expect(mark).toHaveAttribute('lang', 'hi');
    await expect(mark).toHaveCSS('font-family', /Tiro Devanagari/);
  });

  test('the Devanagari glyphs actually render, not as tofu', async ({ page }) => {
    await page.goto('/');
    const width = await page.locator('.devanagari').evaluate((el) => el.getBoundingClientRect().width);
    expect(width, 'six glyphs should occupy real width').toBeGreaterThan(40);
  });

  test('the jaali lattice is present on the warm sections', async ({ page }) => {
    await page.goto('/tickets/');
    const texture = await page.evaluate(() =>
      getComputedStyle(document.querySelector('.band-paper')!, '::before').backgroundImage);
    expect(texture).toContain('svg');
  });
});

test.describe('the enquiry form in the hero', () => {
  const withHero = PAGES.filter((p) => p !== '/' && p !== '/thanks/');

  for (const path of withHero) {
    test(`${path} has one`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('.hero-enquiry')).toHaveCount(1);
    });
  }

  test('home uses the fuller booking ticket instead', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#quickStart')).toHaveCount(1);
  });

  test('it validates and accepts', async ({ page }) => {
    await page.addInitScript(() => { window.open = () => null; });
    await page.goto('/tickets/');
    const form = page.locator('.hero-enquiry');
    const note = form.locator('.form-note');

    await form.locator('button[type=submit]').click();
    await expect(note).toContainText('Please add');

    await form.locator('input[name=name]').fill('Akash');
    await form.locator('input[name=phone]').fill('12345');
    await form.locator('button[type=submit]').click();
    await expect(note).toContainText('valid 10-digit');

    await form.locator('input[name=phone]').fill('7999656039');
    await form.locator('button[type=submit]').click();
    await expect(note).toContainText('Thanks');
  });

  test('its ids are unique so nothing collides', async ({ page }) => {
    await page.goto('/contact/');
    const duplicates = await page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
      return ids.length - new Set(ids).size;
    });
    expect(duplicates).toBe(0);
  });
});
