/**
 * POST /api/pay — online payment through Razorpay.
 *
 *   { step: 'order',  ref, name, phone, email, setup, guests, decor, addons }
 *     Prices the booking HERE (api/_prices.js), never trusting a total from the
 *     browser, and opens a Razorpay order for that amount. Answers with what
 *     Razorpay Checkout needs: the public key id, the order id and the amount.
 *
 *   { step: 'verify', order_id, payment_id, signature }
 *     Checks Razorpay's signature with the secret, asks Razorpay what was paid,
 *     and only then emails the team (and the customer) that the money is in.
 *     The browser cannot fake this: without the secret there is no valid
 *     signature, and the amount and booking come from Razorpay, not the page.
 *
 * Needs, in Vercel (Project > Settings > Environment Variables, Production):
 *   RAZORPAY_KEY_ID      rzp_live_…   (Razorpay > Account & Settings > API Keys)
 *   RAZORPAY_KEY_SECRET  shown once when the key is generated
 * Without them this answers 503 and the site falls back to "pay after we call".
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { priceBooking } from './_prices.js';
import { customerEmail, ownerEmail, canEmailCustomer } from './_email.js';
import { resend, FROM, TEAM_TO, TEAM_CC, allowedOrigin, overLimit } from './send.js';

const RZP = 'https://api.razorpay.com/v1';
const answer = (status, body) => Response.json(body, { status });
const clip = (v, n) => String(v ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, n);
const rupee = (n) => '₹' + Number(n).toLocaleString('en-IN');

function keys() {
  const id = process.env.RAZORPAY_KEY_ID ?? '';
  const secret = process.env.RAZORPAY_KEY_SECRET ?? '';
  return id && secret ? { id, secret } : null;
}

async function razorpay(k, path, init = {}) {
  const res = await fetch(`${RZP}${path}`, {
    ...init,
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${k.id}:${k.secret}`).toString('base64'),
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) console.error('Razorpay refused', path, res.status, JSON.stringify(body).slice(0, 400));
  return { ok: res.ok, body };
}

/** Razorpay's own check: HMAC-SHA256 of "order_id|payment_id" with the key secret. */
export function signatureValid(secret, orderId, paymentId, signature) {
  const want = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  const got = String(signature ?? '');
  return got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

async function createOrder(k, body) {
  const ref = /^YS-[A-Z0-9]{6}$/.test(body.ref ?? '') ? body.ref : '';
  if (!ref) return answer(400, { success: false, message: 'Missing booking reference.' });

  const price = priceBooking({
    setup: body.setup,
    guests: body.guests,
    slot: body.slot,
    decor: body.decor,
    addons: body.addons,
    // the session's date and the house rules they ticked: both are checked
    // here against this server's clock, not taken on the browser's word
    date: body.date,
    agreed: body.agreed,
  });
  if (price.amount === null) return answer(400, { success: false, message: price.reason });

  const order = await razorpay(k, '/orders', {
    method: 'POST',
    body: JSON.stringify({
      amount: price.amount * 100,       // paise
      currency: 'INR',
      receipt: ref,
      notes: {
        booking_ref: ref,
        name: clip(body.name, 80),
        phone: clip(body.phone, 20),
        email: clip(body.email, 120),
        booking: clip(body.summary, 240),
      },
    }),
  });
  if (!order.ok || !order.body.id) return answer(502, { success: false, message: 'Razorpay did not open the payment.' });

  return answer(200, {
    success: true,
    key: k.id,
    order_id: order.body.id,
    amount: price.amount,
  });
}

async function verify(k, body, mailKey) {
  const orderId = String(body.order_id ?? '');
  const paymentId = String(body.payment_id ?? '');
  if (!/^order_\w+$/.test(orderId) || !/^pay_\w+$/.test(paymentId)) {
    return answer(400, { success: false, message: 'Missing payment details.' });
  }
  if (!signatureValid(k.secret, orderId, paymentId, body.signature)) {
    return answer(400, { success: false, message: 'That payment could not be verified.' });
  }

  // The signature proves Razorpay saw this payment. What was paid, and for which
  // booking, is read back from Razorpay rather than taken from the browser.
  const [order, payment] = await Promise.all([
    razorpay(k, `/orders/${orderId}`),
    razorpay(k, `/payments/${paymentId}`),
  ]);
  if (!order.ok || !payment.ok || payment.body.order_id !== orderId) {
    return answer(502, { success: false, message: 'Razorpay could not be reached to confirm the payment.' });
  }
  const status = payment.body.status;
  if (status !== 'captured' && status !== 'authorized') {
    return answer(400, { success: false, message: 'The payment did not go through.' });
  }

  const notes = order.body.notes ?? {};
  const ref = /^YS-[A-Z0-9]{6}$/.test(notes.booking_ref ?? '') ? notes.booking_ref : order.body.receipt;
  const amount = Number(payment.body.amount) / 100;

  if (mailKey) {
    const fields = {
      'Booking ref': ref,
      Name: clip(notes.name, 80) || 'Customer',
      Phone: clip(notes.phone, 20),
      ...(notes.email ? { Email: clip(notes.email, 120) } : {}),
      'Amount paid': rupee(amount),
      'Paid by': clip(payment.body.method, 20) || 'online',
      'Razorpay payment': paymentId,
      Status: `PAID — ${rupee(amount)} verified with Razorpay (${status}).`,
    };
    const subject = `Payment received — ${ref} · ${rupee(amount)}`;
    const lead = ownerEmail(fields, subject);
    // Keyed on the payment id, so a retried verify never emails twice.
    await resend(mailKey, {
      from: FROM, to: TEAM_TO(), cc: TEAM_CC(), subject,
      html: lead.html, text: lead.text,
      ...(fields.Email ? { reply_to: fields.Email } : {}),
    }, `${paymentId}-team`);
    if (canEmailCustomer(fields)) {
      const note = customerEmail(fields, subject);
      await resend(mailKey, {
        from: FROM, to: [fields.Email], subject: note.subject,
        html: note.html, text: note.text, reply_to: TEAM_TO()[0],
      }, `${paymentId}-customer`);
    }
  }

  return answer(200, { success: true, ref, amount, payment_id: paymentId });
}

export async function POST(request) {
  if (!allowedOrigin(request.headers.get('origin') ?? '')) {
    return answer(403, { success: false, message: 'Not allowed.' });
  }
  const k = keys();
  if (!k) return answer(503, { success: false, message: 'Online payment is not set up yet.' });

  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  if (overLimit(`pay:${ip}`)) return answer(429, { success: false, message: 'Rate limit exceeded.' });

  const raw = await request.text();
  if (raw.length > 8_000) return answer(413, { success: false, message: 'Too long.' });
  let body;
  try { body = JSON.parse(raw); } catch { body = null; }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return answer(400, { success: false, message: 'Not valid JSON.' });
  }

  if (body.step === 'order') return createOrder(k, body);
  if (body.step === 'verify') return verify(k, body, process.env.RESEND_API_KEY);
  return answer(400, { success: false, message: 'Unknown step.' });
}
