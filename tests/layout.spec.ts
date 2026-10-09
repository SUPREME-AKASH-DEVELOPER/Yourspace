import { test, expect } from '@playwright/test';
import { PAGES } from './pages';

const WIDTHS = [320, 375, 414, 768, 1024, 1440, 2560];
const KEY = ['/', '/programme/', '/tickets/', '/book/', '/contact/'] as const;

test.describe('layout', () => {
  for (const width of WIDTHS) {
    test(`nothing overflows sideways at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const path of KEY) {
        await page.goto(path);
        const overflows = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
        expect(overflows, `${path} at ${width}px`).toBe(false);
      }
    });
  }

  test('no visible text is cut off at any width', async ({ page }) => {
    // The projector beam and the marquee track are meant to run past the edge;
    // they are decorative and marked aria-hidden.
    const findClipped = () => page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('*')]
        .filter((el) => {
          if (el.closest('[aria-hidden="true"]')) return false;
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') return false;
          if (cs.overflowX !== 'hidden' && cs.overflow !== 'hidden') return false;
          // only elements that render their own text
          const ownText = [...el.childNodes]
            .filter((n) => n.nodeType === 3 && n.textContent!.trim())
            .length > 0;
          if (!ownText) return false;
          return el.scrollWidth > el.clientWidth + 2;
        })
        .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}: ${(el.innerText || '').trim().slice(0, 40)}`));

    for (const width of [320, 375, 768, 1440, 2560]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ['/', '/programme/', '/tickets/', '/contact/']) {
        await page.goto(path);
        await page.evaluate(() => document.querySelectorAll('.reveal').forEach((e) => e.classList.add('is-in')));
        expect(await findClipped(), `${path} at ${width}px`).toEqual([]);
      }
    }
  });

  test('the full brand name fits in the footer at every width', async ({ page }) => {
    for (const width of [320, 360, 414, 768, 1024, 1440, 2560]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      const overflow = await page.locator('.wordmark').evaluate(
        (el) => el.scrollWidth - el.clientWidth);
      expect(overflow, `wordmark cut at ${width}px`).toBeLessThanOrEqual(1);
    }
  });

  test('nothing in the flow of the page overlaps anything else', async ({ page }) => {
    // Fixed bars sit above the page by design, so they are excluded.
    const findOverlaps = () => page.evaluate(() => {
      // An inline link that wraps onto two lines reports a bounding box
      // spanning both, which is not where it can actually be clicked.
      // Compare the per-line rects instead.
      const items = [...document.querySelectorAll<HTMLElement>('a,button,input,select,textarea')]
        .filter((e) => e.offsetParent !== null && getComputedStyle(e).position !== 'fixed')
        .filter((e) => !e.closest('.sticky-cta') && !e.closest('.masthead'))
        .map((e) => ({ e, rects: [...e.getClientRects()].filter((r) => r.width > 1 && r.height > 1) }))
        .filter((o) => o.rects.length > 0);

      const hits: string[] = [];
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i], b = items[j];
          if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
          for (const ra of a.rects) {
            for (const rb of b.rects) {
              const x = Math.max(0, Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left));
              const y = Math.max(0, Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top));
              const smaller = Math.min(ra.width * ra.height, rb.width * rb.height);
              if (x * y > 0.25 * smaller) {
                hits.push(`${a.e.tagName}.${[...a.e.classList].join('.')} over ${b.e.tagName}.${[...b.e.classList].join('.')}`);
              }
            }
          }
        }
      }
      return [...new Set(hits)];
    });

    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ['/', '/programme/', '/tickets/', '/book/', '/contact/']) {
        await page.goto(path);
        await page.evaluate(() => document.querySelectorAll('.reveal').forEach((e) => e.classList.add('is-in')));
        expect(await findOverlaps(), `${path} at ${width}px`).toEqual([]);
      }
    }
  });

  test('the sticky bar never hides the end of the page', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const clear = await page.evaluate(() => {
      const bar = document.querySelector<HTMLElement>('.sticky-cta');
      if (!bar || getComputedStyle(bar).display === 'none') return true;
      const last = document.querySelector<HTMLElement>('.legal');
      if (!last) return true;
      return last.getBoundingClientRect().bottom <= bar.getBoundingClientRect().top + 1;
    });
    expect(clear, 'last line of the page sits above the sticky bar').toBe(true);
  });

  test('tap targets are big enough to hit', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const tooSmall = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('a, button')]
        .filter((el) => el.offsetParent !== null)
        // WCAG 2.2 (2.5.8) exempts a link sitting inside a sentence, where
        // enlarging it would collide with the line above or below.
        .filter((el) => {
          const p = el.parentElement;
          if (!p) return true;
          const inSentence = p.childNodes.length > 1
            && [...p.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim().length > 1);
          return !inSentence;
        })
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { text: (el.innerText || '').trim().slice(0, 30), height: Math.round(r.height) };
        })
        .filter((o) => o.height > 0 && o.height < 24));
    expect(tooSmall).toEqual([]);
  });

  test('every page renders its logo and has no duplicate ids', async ({ page }) => {
    for (const path of PAGES) {
      await page.goto(path);
      expect(await page.locator('.brand-mark svg').count(), `${path} logos`).toBeGreaterThan(0);
      const duplicates = await page.evaluate(() => {
        const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
        return ids.length - new Set(ids).size;
      });
      expect(duplicates, `${path} duplicate ids`).toBe(0);
    }
  });

  test('no gradient reference is left dangling', async ({ page }) => {
    await page.goto('/');
    const broken = await page.evaluate(() => {
      let n = 0;
      document.querySelectorAll<SVGElement>('[fill^="url(#"], [stroke^="url(#"]').forEach((el) => {
        (['fill', 'stroke'] as const).forEach((attr) => {
          const v = el.getAttribute(attr);
          if (v?.startsWith('url(#')) {
            const id = v.slice(5, -1);
            if (!el.ownerSVGElement?.querySelector(`#${CSS.escape(id)}`)) n++;
          }
        });
      });
      return n;
    });
    expect(broken).toBe(0);
  });
});
