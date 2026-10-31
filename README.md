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
npm test           # Playwright: 580 checks across Chromium, Firefox, WebKit, mobile
npm run verify     # check + test, the pre-deploy gate
```

## Layout

```
src/
  data/             ← the files you normally edit
    site.ts           phone, WhatsApp, address, hours, email
    booking.ts        prices, packages, add-ons, experiences
    decorations.ts    the three setups, their prices and photographs, capacity
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

### The reel and the deck

The photographs live in two custom pieces rather than a plain grid. The **reel** is a
35mm filmstrip with drawn perforations — drag it, flick it, or step through with the
arrows; frames sit cool and flat until you hover one, which brings the colour up. The
**deck** on the tickets page is the three setups as cards: the pointer tilts them and
drags a band of light across, and clicking turns a card over to its details. Both are
ordinary buttons underneath, so the keyboard path is just focus and press, and the
hidden face of a card is marked `inert` so it stays out of the tab order.

### The decoration photographs

`src/data/decorations.ts` holds the three setups — Aesthetic ₹1,000, Trendy ₹2,000 and
Royal — with their photographs and descriptions. They appear on the home page, the room
page and the tickets page, and any one can be opened full size.

Two things need your attention before launch. **The Royal price was never quoted**, so the
site says "Price on request" rather than inventing a number. And **the provenance of the
photographs needs confirming**: if any of them are a supplier's pictures rather than your
own room and your own work, they have to come down, because someone who books from them
will turn up expecting exactly what they saw.

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
| 6 | Confirm the decoration photographs are ours to publish, and add pictures of the empty room | Client | **Blocking** — see note below |
| 9 | Set the Royal decoration price in `src/data/decorations.ts` (it shows "Price on request" until then) | Client | High |
| 10 | Reconcile the decoration prices with the placeholder package prices in `booking.ts` | Both | High |
| 7 | Room specs: projector, sound, seat count, AC | Client | High |
| 8 | Decide where bookings land (Google Form or an API) | Both | High |

Everything above is also marked `TODO` in the code.

## Where bookings go

Every form now **posts the submission to a real inbox**. It goes through
[FormSubmit](https://formsubmit.co), which is free and needs no account:
`formEndpoint` in `src/data/site.ts` points at the address that receives them.

**One step before it works:** submit any form once, then open the confirmation email
FormSubmit sends to that address and click the link. Nothing is delivered until that
is done — it is how they stop people pointing forms at strangers.

After that, swap `formEndpoint` for the hashed URL FormSubmit gives you
(`https://formsubmit.co/ajax/<random-string>`) so the address is not sitting in the
page source for scrapers.

Alongside that:

- the visitor's own copy is kept in their browser under `ys-requests`, so a failed
  send never loses the details;
- if the post fails, they are handed a WhatsApp draft rather than a dead end;
- a hidden decoy field catches bots without a captcha;
- anyone who leaves an email address gets a written confirmation back.

The emails themselves are in [`email/`](email/) — see that folder's README for how to
switch to a provider that renders them.

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
