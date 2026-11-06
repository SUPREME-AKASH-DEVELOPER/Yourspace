# YourSpace Jabalpur

A private screening room in Jabalpur. Marketing site plus a six-step booking flow that ends in UPI payment.

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
npm test           # Playwright: 760 checks across Chromium, Firefox, WebKit, mobile
npm run verify     # check + test, the pre-deploy gate
```

## Layout

```
src/
  data/             ← the files you normally edit
    site.ts           phone, WhatsApp, address, hours, email
    booking.ts        occasions, slots, setups, add-ons, and quote() — the only place a total is added up
    decorations.ts    the three decoration packages, their prices and photographs
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
it **and** the tickets, home, room and FAQ pages render from it, so a price cannot be
right in one place and wrong in the other. A test asserts the two agree.

A price that has not been confirmed is `null`, never a guess. It shows as
"price on call", is left out of the total (which then reads "₹X + on call"), and
switches UPI off for that booking, because we cannot ask for an amount we don't know.

### The booking flow

| Step | What | Notes |
|---|---|---|
| 1 | Occasion | Each occasion suggests a setup on step 4 |
| 2 | Date and seats | Pick the seats themselves — 5 recliners, 2 bean bags |
| 3 | Time | Eight 90-minute slots, 12 PM to 12 AM; slots already started today are disabled |
| 4 | Setup | Photo cards with the price for *this* group size. Date Night opens the three decorations underneath |
| 5 | Add-ons | Bouquet, cake, photoshoot, one of each. Date Night only; the step is skipped otherwise |
| 6 | Details and payment | Pay now by UPI, or after we call |

| Setup | Length | Price | Guests |
|---|---|---|---|
| Celebration & Date Night | 90 min | ₹1,500 + decoration | Set up for 2, up to 7 |
| Movie Space | 90 min | ₹1,500 up to 5, ₹1,700 for 6–7 | 1–7 |
| Karaoke | 30 min | ₹150 per person (3–5); 6–7 on call | 3–7, fewer must call |
| Watch Party | — | — | Listed, closed to online booking |

Photographs for the flow come from `src/components/BookingMedia.astro`, which renders
them once (resized, WebP) into a `<template>` the flow copies from. **To add the owner's
photos, drop them in `src/assets/booking/` named by key** — `addon-bouquet-s.jpg`,
`setup-movie.jpg` and so on; that folder's README lists every one. No code changes.
Anything without a photograph gets a drawn gold card.

"Today", the date list and which slots have already started are all worked out in
**Jabalpur time** (Asia/Kolkata), whatever the visitor's device is set to — a UTC date
would offer yesterday between midnight and 5:30 AM in India.

Saved progress is read back from the visitor's browser, so every value is checked
against what the flow could have produced before it is used, and the cleaned state is
written back.

### The seats

The room is five recliners in a back row and two bean bags in front, nearer the screen —
seven in all. `SEATING` in `src/data/booking.ts` is the only place those numbers live, so
the picker, the room drawing, the home and room pages, the booking summary and the email
to the team cannot disagree with each other.

In the picker each seat is **its own toggle**: one tap takes that seat and nothing else.
(It used to fill every seat up to the one you tapped, which made tapping a bean bag look
as though it had taken all five recliners with it.) Recliners are square with armrests,
bean bags are round, and the seats someone actually picks are what the summary and the
email say — "1 recliner + 2 bean bags", not just a head count. The chosen seats live in
`state.seats`; `state.guests` is only ever `seats.length`, and `setSeats()` is the one
function that writes either, so the two cannot drift apart.

### Payment

The last screen shows the amount as a UPI pay link (phones), a QR code (computers,
drawn in the browser — no third-party request) and the UPI ID to copy, with the booking
reference (`YS-XXXXXX`) in the note. The UPI ID is `upiId` in `src/data/site.ts`.

**The site never calls a booking paid.** It cannot see the bank account. The booking
email says `Payment: … NOT VERIFIED`, and when the customer sends their 12-digit UPI
reference a second email arrives marked `UNVERIFIED` with that reference — find it in
the bank app before confirming. The customer is told their booking is *awaiting
confirmation*.

Duplicates are guarded on the client: a booking is sent once (a double tap or a reload
does not resend it), the reference is made once, and the payment screen survives a
reload so someone who switches to their UPI app and back doesn't lose it.

**What a static site cannot do**, and needs a server before it can be relied on:

- **Stop double bookings.** Two people can request the same slot; the team sees both
  emails and calls the second. A real check needs a database of held slots and an API
  the flow asks before step 6.
- **Verify payment automatically.** That needs Razorpay (or similar): a server route
  that creates an order for the exact amount, the Razorpay checkout, and a server route
  that verifies the signature with the secret key, plus a webhook for payments that
  finish after the tab closes. The booking is marked paid only by the server, on a
  verified signature, keyed by booking reference so a retried payment can't create a
  second booking. Vercel functions under `/api` would host it; it also means a
  Razorpay account with KYC, a privacy-page update, and allowing Razorpay's origins in
  the CSP. UPI as it is now stays as the fallback when Razorpay is down.

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

`src/data/decorations.ts` holds the three decoration packages — Aesthetic ₹1,000, Elite
₹2,000 and Royal — with their photographs and descriptions. Every one includes fog entry
and candlelight. **Elite is assumed to be the package previously called Trendy**, so it
carries Trendy's photos and price; correct that file if not. They appear on the home page, the room
page and the tickets page, and any one can be opened full size.

Two things need your attention before launch. **The Royal price was never quoted**, so the
site says "Price on request" rather than inventing a number. And **the provenance of the
photographs needs confirming**: if any of them are a supplier's pictures rather than your
own room and your own work, they have to come down, because someone who books from them
will turn up expecting exactly what they saw.

### The logo, and the gold

The logo is the supplied artwork itself, in `src/assets/brand/`: `logo.png` (the full
circle) and `wordmark.png` (YOUR SPACE, cropped from it for the header). Both were made
from the original JPEG by turning its black background into transparency, so they sit
on the dark page exactly as they look on black. If a new version of the artwork
arrives, regenerate both the same way — positions in the CSS are measured from it.

They are made to feel alive by light laid *over* the artwork, never by redrawing it:
the eclipse's glow breathes (`.ys-halo`), and on the full logo a glint travels round the
gold ring (`.ys-glint`). With reduced motion switched on, both hold still. The header
is 96px at the top of the page and slims to 74px once you scroll.

The palette is taken from the same artwork — near-black and the ring's champagne gold
(`--amber`), with bronze (`--ember`) where gold has to sit on the cream sections. Red is
kept only for errors (`--alert`). The favicons, app icons and `og.png` share image are
rendered from the new mark.

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
| 1 | Phone number | Client | **Done** — one number everywhere, +91 79996 56039 (`phone` in `src/data/site.ts`; `whatsapp` is empty so WhatsApp follows it). Set `phoneAlt` if a second line is ever published |
| 2 | Full address, map link and opening hours (`site.ts`) | Client | **Blocking** for local SEO and the schema |
| 3 | Set the real domain as `SITE_URL` in `astro.config.mjs` | Dev | **Blocking** — canonical URLs, sitemap and OG image URLs derive from it |
| 4 | Confirm every price in `src/data/booking.ts` | Client | **Blocking** |
| 5 | Legal review of `/terms`, `/privacy`, `/refunds` | Client | **Blocking** — drafts, with the refund windows as placeholders |
| 6 | Confirm the decoration photographs are ours to publish, and add pictures of the empty room | Client | **Blocking** — see note below |
| 9 | Set the Royal decoration price in `src/data/decorations.ts` (it shows "Price on request" until then) | Client | High |
| 10 | Confirm the decoration prices, and that they are added on top of the ₹1,500 Date Night session | Client | High |
| 11 | Karaoke price for 6–7 guests (₹150 a head, or the "₹500" mentioned?) — shows "price on call" until then | Client | High |
| 12 | Movie Space for 6–7: confirm ₹1,700 | Client | High |
| 13 | Bouquet and cake options: names, photographs, prices. Photoshoot: ₹400 or ₹500 | Client | High |
| 14 | Watch Party: length, price, guest limit — it is closed to online booking until set | Client | High |
| 15 | Are all eight slots open for every setup? When in the slot does a 30-minute karaoke run? | Client | Medium |
| 16 | Payments go to a personal UPI ID; consider a business one (pay links to personal IDs are sometimes blocked, and daily limits are lower) | Client | Medium |
| 17 | Razorpay and a booking database, for automatic payment checks and double-booking protection | Both | When ready |
| 18 | Owner's photographs for Movie Space, Karaoke, Watch Party and every add-on (see `src/assets/booking/README.md`) | Client | High |
| 19 | Upgrade Astro 5 → 7 to clear the remaining `npm audit` advisories (build-time only; none reach the static site) | Dev | Medium |
| 7 | Room specs: projector, sound, AC (seating is set: 5 recliners + 2 bean bags, `SEATING` in `src/data/booking.ts`, and each seat is picked individually) | Client | High |
| 20 | WhatsApp number | Client | **Done** — +91 79996 56039, the same line as calls |
| 21 | New Aesthetic decoration photographs from Tanishk — steps at the top of `src/data/decorations.ts` | Client | High |
| 22 | Temporary bouquet and photoshoot pictures as `*.sample.jpg` in `src/assets/booking/` (badged "Sample image"), then the real ones | Both | High |
| 23 | Payment gateway KYC — see "Payment gateway KYC" below | Client | Before any gateway |
| 24 | Domain: see "Connecting the domain" below | Both | Blocking |
| 8 | Decide where bookings land (Google Form or an API) | Both | High |

Everything above is also marked `TODO` in the code.

## WhatsApp

"For more information — contact us on WhatsApp" sits on the contact page, under the
booking flow, and in every page's footer. It uses WhatsApp's official click-to-chat link
(`https://wa.me/<number>?text=…`), which opens the app on phones and WhatsApp Web or
Desktop on computers, with an editable opening message. The number and message are
`whatsapp` and `whatsappMessage` in `src/data/site.ts`; the component is
`src/components/WhatsApp.astro`. With no valid number set, every WhatsApp button hides.

The number in use is **+91 79996 56039**, confirmed by Tanishk, and it is the only
number the site publishes — calls and WhatsApp both come to it. `whatsapp` is left empty
so it follows `phone`; set it only if WhatsApp ever moves to a different line.
`tests/contact.spec.ts` checks every `wa.me` and `tel:` link agrees with the printed
number, and that the retired +91 94296 90584 appears nowhere on the site.

### Finishing a booking in the chat

On the confirmation screen there is also **"Send my booking on WhatsApp"**, which opens
the chat with the whole booking — reference, occasion, date and time, seats, add-ons and
total — already written out. Tanishk asked for it so someone who would rather talk than
wait for the call can carry their booking straight into the chat.

It is an extra way through, never the only one. By the time the button appears the
booking has already been emailed to the team, so nothing is lost if it is never tapped,
and `tests/booking.spec.ts` checks both happen. A WhatsApp message is still not a
payment: the UPI panel, the "nothing has been charged" wording and the call to confirm
are all unchanged.

WhatsApp is for questions and for that hand-off. No form posts to WhatsApp instead of
the inbox, and a message is never treated as proof of payment.

## Payment gateway KYC

There is **no payment gateway in the code yet**: payment is UPI to the ID in `site.ts`,
checked by hand. The activation error — *"You selected Media and Entertainment. Event
Ticket Reseller doesn't currently support this category"* — is about the gateway account,
not the site, and nothing here needs changing for it.

The likely cause: YourSpace was registered as an **Event Ticket Reseller**, and the
gateway doesn't onboard that sub-category. It is also not what the business does. It
doesn't resell tickets to someone else's events. It rents a private room by the hour for
screenings, celebrations and karaoke, with decoration add-ons.

Next steps:

1. Contact the gateway's support (or the activation form's "change category" option) and
   describe the business in those plain words. Ask which category and sub-category they
   use for a **private venue / party room rental** or **recreation / entertainment
   services**. Don't pick one just because it gets approved: a category that doesn't
   match the business can get the account frozen later, with payouts held.
2. Have ready: PAN, bank account, GST (if registered), the business address, and the live
   website with Terms, Privacy and Refund pages on the new domain. Gateways check those
   pages exist.
3. Expect questions about screening films and matches. Showing copyrighted content to
   paying groups can need a public-performance licence, and a reviewer may ask. Have an
   answer (for example, customers stream from their own accounts on a private booking)
   checked with whoever advises the business.
4. Until the account is active, UPI as it works now stays the only online payment. When
   it is active, the integration plan is under "Payment" above (server-created order,
   signature check, webhook). Nothing is marked paid on the client.

## Connecting the domain

The site is static, so there are no API URLs, payment callbacks, webhooks or CORS
settings yet. What depends on the domain:

| What | Where | Action |
|---|---|---|
| Canonical URLs, sitemap, robots.txt, OG image, structured data | `SITE_URL` in `astro.config.mjs` | Set `PUBLIC_SITE_URL=https://<domain>` in Vercel (Production), or edit the fallback there. Then rebuild. |
| Domain itself | Vercel → Project → Domains | Add the apex and `www`, set the DNS records Vercel shows at the registrar, pick one to redirect to the other. |
| Customer email template link | `email/customer-confirmation.html` | Replace `yourspace-jabalpur.example` |
| Form delivery | Web3Forms dashboard | If the key is restricted to domains, add the new one. Send a test booking afterwards. |
| HSTS `preload` | `vercel.json` | Already on. Only submit to hstspreload.org once HTTPS works on every subdomain. |
| WhatsApp links, image paths | — | Nothing to do. They don't depend on the domain. |
| Future payment gateway | Gateway dashboard | Callback and webhook URLs go on the new domain, e.g. `https://<domain>/api/razorpay/webhook`. |

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
- if the post fails, the form stays filled in and they can try again or call;
- a hidden decoy field catches bots without a captcha;
- anyone who leaves an email address gets a written confirmation back.

The emails themselves are in [`email/`](email/) — see that folder's README for how to
switch to a provider that renders them.

## Testing

`tests/requirements.spec.ts` checks every rule from the owner's call one by one —
every price for every group size, the slots, the durations, the ruled-out add-ons —
plus the edge cases around them (time zones, going back, tampered saved state).

`npm test` runs the suite against a real production build in four browser profiles:

- **SEO** — status, title and description length and uniqueness, canonical, OG, one `h1`
  per page, `noindex` only where intended, robots.txt, sitemap contents, structured data
- **Accessibility** — axe-core (WCAG 2.1 A/AA + best practice) on every page, on the open
  dialog and on each step of the booking flow; focus visibility, `inert` background,
  focus trap, reduced motion, and the no-JavaScript path
- **Booking** — the full flow, seat pricing, validation, confirmation wording, resuming
  after a reload, the WhatsApp hand-off on the confirmation screen, and behaviour when
  `localStorage` throws
- **Seats** (`tests/seats.spec.ts`) — five recliners and two bean bags, told apart by
  shape; one tap takes one seat and no other; the last seat cannot be given back; the
  seats chosen are what the summary and the email say; a tampered seat list is cleaned
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
- **No card details, and no "paid" we haven't seen.** Payment is by UPI in the
  customer's own app. Paying later is always offered, and the site says a booking is
  paid only once the money has reached us.
- **No tracking.** No cookies, no analytics, no third-party requests. The privacy page
  says so because it is true; adding any of them means updating that page.
