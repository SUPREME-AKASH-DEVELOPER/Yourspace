# Email

Two templates, in the same ink-and-amber as the site:

- **`booking-notification.html`** — what lands in your inbox when someone books.
  Name and number first, the details as a slip, their own words in a highlighted
  block, and Call / WhatsApp buttons so you can act from the email.
- **`customer-confirmation.html`** — the note back to the visitor. Reads their
  booking back to them and says plainly that nothing has been charged.

Both are built the way email has to be: tables, inline styles, 600px, no flexbox
or grid. They hold together in Gmail, Outlook and Apple Mail.

## Right now

The site sends through **FormSubmit**, which is free and needs no account. It
renders its own layout, so these templates are **not in use yet** — what arrives
is a clean table of the same fields, with a subject like
`Pre-booking — Tanishk Sharma · 7999656039`.

That was the trade: working today, free, no signup.

## To use these templates

Move to a provider that accepts HTML. Any of these keep the free tier:

| Provider | Free tier | Custom HTML |
|---|---|---|
| **Web3Forms** | 250 / month | Yes, via their dashboard |
| **EmailJS** | 200 / month | Yes, paste the HTML in |
| **Resend** | 3,000 / month | Yes, needs a small backend |

Then:

1. Sign up and get the key.
2. Paste the template into the provider's editor.
3. Point `formEndpoint` in `src/data/site.ts` at the new URL.
4. The CSP follows automatically — it is generated from that value at build time.

Placeholders are `{{like_this}}`. The field names the site sends are in
`FIELD_LABELS` in `src/scripts/app.ts`.
