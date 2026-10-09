# YourSpace Jabalpur

A private screening room in Jabalpur. Marketing site plus a six-step booking flow.

**Stack:** [Astro 5](https://astro.build) · TypeScript (strict) · hand-written CSS ·
[Playwright](https://playwright.dev) · no UI framework.

Pages ship as static HTML with ~24 KB of JavaScript. No cookies, no analytics,
no third-party requests at all.

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # static site -> dist/
npm run preview    # serve the built site
npm run check      # TypeScript + Astro diagnostics
npm test           # Playwright: 440 checks across Chromium, Firefox, WebKit, mobile
npm run verify     # check + test, the pre-deploy gate
```

## Layout

```
src/
  data/             ← the files you normally edit
    site.ts           phone, WhatsApp, address, hours, email
    booking.ts        prices, packages, add-ons, experiences, capacity
    faq.ts            every question and answer
    nav.ts            the menus
  pages/            one file per route
  components/       masthead, menu, footer, ticket stub, price list, forms, schema
  layouts/Base.astro  the shared page shell (head, OG, icons, landmarks)
  scripts/          app.ts (page behaviour) · booking.ts (the flow) · dom.ts (helpers)
  styles/           global.css (design system) · fonts.css (self-hosted faces)
  integrations/     security-headers.ts (writes dist/_headers at build time)
public/             fonts, icons, OG image, manifest
tests/              the suite that gates a release
```

### Prices live in exactly one place

`src/data/booking.ts` is the single source of truth. The booking flow charges from
it **and** the tickets page renders from it, so a price cannot be right in one place
and wrong in the other. A test asserts the two agree.

### The page changes with the hour

An inline script sets `data-daypart` on `<html>` before the first paint, and the
palette shifts with it: cooler and softer in the morning, warmest at dusk, deepest
at night. The hero greeting and the "good for a Tuesday" suggestion are filled in
by script rather than baked into the HTML, because the pages are static and cached
and would otherwise go stale. Contrast is tested in all four dayparts.

### Heritage marks

The city is set in Devanagari — जबलपुर — beside the footer wordmark, in Tiro
Devanagari subset to those six glyphs (1.2 KB). A jaali lattice, the pierced stone
screen, is used as a texture on the warm sections and as a band at the seam between
dark and light. Both are deliberately quiet: the point is a sense of place, not
decoration.

### Security headers are generated, not hand-written

`src/integrations/security-headers.ts` runs after each build, hashes every inline
script it finds in the output, and writes `dist/_headers` with a Content-Security-Policy
that allows those hashes. The policy never needs `'unsafe-inline'` for scripts and
cannot go stale when content changes. Netlify and Cloudflare Pages read the file
automatically; on another host, copy the directives into its header config.

## Before it goes live

| # | What | Who | Status |
|---|------|-----|--------|
| 1 | Confirm both numbers in `src/data/site.ts` (`phone` is the line we answer first and the one WhatsApp uses; `phoneAlt` is the second) | Client | **Blocking** — Call/WhatsApp buttons stay off until a valid `+91` number is set |
| 2 | Full address, map link and opening hours (`site.ts`) | Client | **Blocking** for local SEO and the schema |
| 3 | Set the real domain as `SITE_URL` in `astro.config.mjs` | Dev | **Blocking** — canonical URLs, sitemap and OG image URLs derive from it |
| 4 | Confirm every price in `src/data/booking.ts` | Client | **Blocking** |
| 5 | Legal review of `/terms`, `/privacy`, `/refunds` | Client | **Blocking** — drafts, with the refund windows as placeholders |
| 6 | Real photographs of the room | Client | High — the marks are CSS-drawn stand-ins |
| 7 | Room specs: projector, sound, seat count, AC | Client | High |
| 8 | Decide where bookings land (Google Form or an API) | Both | High |

Everything above is also marked `TODO` in the code.

## Where bookings go

There is no server yet, so nothing is stored centrally:

- every submission is saved to `localStorage` under `ys-requests` (that browser only), and
- the visitor is handed to WhatsApp, or to a Google Form if `googleForm` is set in `site.ts`.

For the Reddit validation run the Google Form is the reliable option — it is the only
one that collects responses somewhere you can read them.

When you want real bookings, add an Astro server endpoint under `src/pages/api/` and
switch that one route to `output: 'server'`.

## Testing

`npm test` runs the suite against a real production build in four browser profiles:

- **SEO** — status, title and description length and uniqueness, canonical, OG, one `h1`
  per page, `noindex` only where intended, robots.txt, sitemap contents, structured data
- **Accessibility** — axe-core (WCAG 2.1 A/AA + best practice) on every page, on the open
  dialog and on each step of the booking flow; focus visibility, `inert` background,
  focus trap, reduced motion, and the no-JavaScript path
- **Booking** — the full flow, seat pricing, validation, confirmation wording, resuming
  after a reload, and behaviour when `localStorage` throws
- **Forms** — all four forms: empty, invalid, valid, reset, double submit, overlong input,
  and that text is readable on the paper sections
- **Layout** — no horizontal overflow at 320–2560px, no visible text cut off, the full
  brand name fits the footer at every width, nothing overlaps (measured per text line,
  not by bounding box), the sticky bar never covers the last line, tap-target sizes,
  logo rendering, duplicate ids, dangling SVG gradient references
- **Live theme** — the right palette, greeting and suggestion at each daypart, contrast
  in all four, and a sane fallback with JavaScript off
- **Contact details** — both numbers appear everywhere they should, `tel:` links match
  the printed digits, and no page shows a number that is not ours (the SOP's
  cross-contamination check)
- **Integrity** — no console errors, no failed requests, every internal link resolves,
  tickets-page prices match what the flow charges, generated security headers, no
  third-party requests, no secrets in the build

Four WebKit keyboard tests are skipped by design: Safari does not move focus to links
on Tab unless Full Keyboard Access is enabled. The same behaviour is asserted a
different way so WebKit still gets covered.

## Deploying

`npm run build` produces a static `dist/`. Netlify, Cloudflare Pages, Vercel or GitHub
Pages will all serve it. `dist/_headers` is picked up by Netlify and Cloudflare Pages.

## Deliberately not on this site

- **No invented numbers.** No ratings, no review counts, no "celebrations hosted" — the
  place has not opened, so there is nothing to count. A test asserts the structured data
  carries no `aggregateRating` or reviews.
- **No money is taken.** Pre-booking states in several places that nothing is charged and
  that you call to confirm. If you later collect a token amount, say so upfront and refund
  it on the stated terms — do not collect it against a reason that is not true.
- **No tracking.** No cookies, no analytics, no third-party requests. The privacy page
  says so because it is true; adding any of them means updating that page.
