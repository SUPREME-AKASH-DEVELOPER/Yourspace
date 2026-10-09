import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { PAGES } from './pages';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

/** The dialog fades in over 0.4s; auditing mid-animation judges a half-faded panel. */
async function dialogReady(page: import('@playwright/test').Page) {
  await expect(page.locator('#bk')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => {
      const p = document.querySelector('.bk-panel');
      return p ? getComputedStyle(p).opacity : '0';
    }), { timeout: 5_000 })
    .toBe('1');
}

/**
 * Sections fade in as they are scrolled to. Auditing before that happens judges
 * a state no reader ever sees, so walk the page down first and let the reveals
 * settle — exactly what a sighted user does.
 */
async function settle(page: import('@playwright/test').Page) {
  await page.evaluate(async () => {
    const step = window.innerHeight;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 60)));
    }
    window.scrollTo(0, 0);
  });
  // wait on the real state rather than a guessed delay, so the audit never
  // races a transition that is still running
  await expect
    .poll(() => page.evaluate(() =>
      [...document.querySelectorAll('.reveal')]
        .every((el) => getComputedStyle(el).opacity === '1')), { timeout: 10_000 })
    .toBe(true);
}

test.describe('accessibility', () => {
  for (const path of PAGES) {
    test(`${path} has no WCAG violations`, async ({ page }) => {
      await page.goto(path);
      await settle(page);
      const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      expect(violations.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);
    });
  }

  test('the booking dialog is accessible while open', async ({ page }) => {
    await page.goto('/programme/');
    await page.locator('.prog-cta').first().click();
    await dialogReady(page);
    // Scope to the dialog: the page behind it is inert and covered by the
    // scrim, and it is audited on its own in the per-page tests above.
    const { violations } = await new AxeBuilder({ page }).include('#bk').withTags(TAGS).analyze();
    const detail = violations.flatMap((v) =>
      v.nodes.map((n) => `${v.id}: ${n.html.slice(0, 120)} — ${n.failureSummary?.split('\n')[1] ?? ''}`));
    expect(detail).toEqual([]);
  });

  test('each step of the dialog is accessible', async ({ page }) => {
    await page.goto('/book/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    const audit = async (label: string) => {
      const { violations } = await new AxeBuilder({ page }).include('#bookMount').withTags(TAGS).analyze();
      expect(violations.map((v) => v.id), label).toEqual([]);
    };

    await audit('occasion');
    await page.locator('[data-exp-pick="proposal"]').click();
    await audit('date and seats');
    await page.locator('[data-date-pick]').first().click();
    await page.locator('[data-bk-next]').click();
    await audit('time');
    await page.locator('[data-slot-pick="s1"]').click();
    await audit('package');
    await page.locator('[data-pkg-pick="romantic"]').click();
    await audit('extras');
    await page.locator('[data-bk-next]').click();
    await audit('details');
  });

  test('the skip link is first and shows a visible focus ring', async ({ page }) => {
    await page.goto('/');

    // first focusable element in document order, in every engine
    const firstFocusable = await page.evaluate(() => {
      const sel = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])';
      return document.querySelector<HTMLElement>(sel)?.className ?? '';
    });
    expect(firstFocusable).toContain('skip-link');

    await page.locator('.skip-link').focus();
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
    expect(outline, 'focus must be visible').not.toBe('none');
  });

  // Safari only tabs to links when "Full Keyboard Access" is enabled, so the
  // Tab-order assertion is meaningful on Chromium and Firefox only.
  test('Tab reaches the skip link first', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit does not tab to links by default');
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toHaveClass(/skip-link/);
  });

  test('the dialog makes the page behind it inert, and Escape closes it', async ({ page }) => {
    await page.goto('/programme/');
    await page.locator('.prog-cta').first().click();
    await dialogReady(page);

    for (const sel of ['#main', '.masthead', '.colophon']) {
      await expect(page.locator(sel), `${sel} inert`).toHaveAttribute('inert', '');
    }

    await page.keyboard.press('Escape');
    await expect(page.locator('#bk')).toBeHidden();
    expect(await page.evaluate(() => document.querySelector('#main')!.hasAttribute('inert'))).toBe(false);
  });

  test('the dialog keeps Tab inside it', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit does not tab to links by default');
    await page.goto('/programme/');
    await page.locator('.prog-cta').first().click();
    await dialogReady(page);

    for (let i = 0; i < 40; i++) await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('#bk'))).toBe(true);
  });

  test('all content is visible with JavaScript disabled', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('/prebook/');
    // the reveal classes must not hide anything when the script never ran
    for (const el of await page.locator('.reveal').all()) {
      await expect(el).toHaveCSS('opacity', '1');
    }
    await expect(page.locator('h1')).toBeVisible();
    await ctx.close();
  });

  test('content is readable when motion is reduced', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('.reveal').first()).toHaveCSS('opacity', '1');
    await expect(page.locator('.ys-light').first()).toHaveCSS('opacity', '1');
  });
});
