# Email

Every form posts to `/api/send` (`api/send.js`), which sends two emails through
[Resend](https://resend.com) from `bookings@yourspacejbp.com`:

- **To the team:** the lead. Name and number first, the details as a slip, their
  own words highlighted, Call and WhatsApp buttons. Replying reaches the customer.
- **To the customer:** a confirmation reading the booking back. Replying reaches
  Tanishk. UPI bookings say "awaiting confirmation", never "paid".

The wording and layout live in `api/_email.js`. The two `.html` files here are
rendered samples: run `npm run email:preview` after a change and open them.

Who receives the lead is set on the server (`NOTIFY_TO`, `NOTIFY_CC`), and the
browser cannot change it or write the customer email. A customer email is skipped
if a field contains a link, so the form cannot be used to message strangers. The
lead still arrives.

## Setup

1. Resend > Domains: `yourspacejbp.com` verified (DKIM TXT plus the `send` and
   `rsend` CNAMEs in GoDaddy).
2. Resend > API keys: create a "Sending access" key.
3. Vercel > yourspace > Settings > Environment Variables: `RESEND_API_KEY`
   (Production and Preview), then redeploy.

## If it breaks

If `/api/send` is down or not set up, the site falls back to Web3Forms
(`web3formsKey` in `src/data/site.ts`). The team still gets the lead, but the
customer gets no email, and the site stops saying a copy is on its way.
Failures show under Vercel > Logs and Resend > Logs.

Resend's free plan allows 100 emails a day and 3,000 a month. Each booking uses two.
