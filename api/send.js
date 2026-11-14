/**
 * POST /api/send, every form on the site ends here.
 *
 * It sends the lead to the team, then a confirmation to the visitor, through
 * Resend. Who receives the lead is decided here, never by the browser, and the
 * browser cannot supply the wording of either email.
 *
 * Needs RESEND_API_KEY in Vercel. Without it this answers 503, and the site falls
 * back to Web3Forms so a lead still reaches the team (with no customer email).
 */
import { canEmailCustomer, customerEmail, ownerEmail } from './_email.js';

export const FROM = process.env.MAIL_FROM || 'YourSpace Jabalpur <bookings@yourspacejbp.com>';
const list = (value, fallback) => (value ?? fallback).split(',').map((s) => s.trim()).filter(Boolean);
export const TEAM_TO = () => list(process.env.NOTIFY_TO, 'tanishkofficial27@gmail.com');
export const TEAM_CC = () => list(process.env.NOTIFY_CC, 'badalakki11@gmail.com');

const ALLOWED_ORIGINS = new Set([
  'https://www.yourspacejbp.com',
  'https://yourspacejbp.com',
  'https://yourspace-sand.vercel.app',
]);

/** Our own pages, and Vercel's preview deployments of this project. */
export const allowedOrigin = (origin) =>
  ALLOWED_ORIGINS.has(origin) || /^https:\/\/yourspace-[\w-]+\.vercel\.app$/.test(origin);

const MAX_BODY = 16_000;
const MAX_FIELDS = 30;
const MAX_VALUE = 2_000;

/* Envelope fields for the fallback service, or ones the browser may not choose.
   The payment ones only ever come from api/pay.js, after Razorpay has confirmed
   the money: a browser must not be able to send an email that says "paid". */
const IGNORED = /^(access_key|from_name|ccemail|replyto|subject|botcheck|_.*|Razorpay payment|Amount paid|Paid by)$/i;

/* Best effort: this lives in one server instance, and resets when it does. */
const WINDOW_MS = 10 * 60_000;
const LIMIT_PER_WINDOW = 12;
const hits = new Map();

export function overLimit(key, now = Date.now()) {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5_000) hits.clear();
  return recent.length > LIMIT_PER_WINDOW;
}

const answer = (status, body) => Response.json(body, { status });
const oneLine = (value) => String(value ?? '').replace(/[\r\n]+/g, ' ').trim();

/** Keep only what is safe to treat as a booking field. */
export function cleanFields(body) {
  const fields = {};
  for (const [key, value] of Object.entries(body)) {
    if (IGNORED.test(key) || typeof value !== 'string' || !value.trim()) continue;
    if (key === 'Status' && /\bpaid\b.*verified/i.test(value)) continue;
    if (Object.keys(fields).length >= MAX_FIELDS) break;
    fields[key.slice(0, 80)] = value.trim().slice(0, MAX_VALUE);
  }
  return fields;
}

export async function resend(apiKey, message, idempotencyKey) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify(message),
  });
  if (!res.ok) console.error('Resend refused an email', res.status, await res.text().catch(() => ''));
  return res.ok;
}

export async function POST(request) {
  if (!allowedOrigin(request.headers.get('origin') ?? '')) {
    return answer(403, { success: false, message: 'Not allowed.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return answer(503, { success: false, message: 'Email is not set up yet.' });

  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  if (overLimit(ip)) return answer(429, { success: false, message: 'Rate limit exceeded.' });

  const raw = await request.text();
  if (raw.length > MAX_BODY) return answer(413, { success: false, message: 'Too long.' });

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return answer(400, { success: false, message: 'Not valid JSON.' });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return answer(400, { success: false, message: 'Not valid JSON.' });
  }

  const fields = cleanFields(body);
  if (!fields.Name || !fields.Phone) {
    return answer(400, { success: false, message: 'A name and a phone number are needed.' });
  }

  const subject = oneLine(body.subject).slice(0, 180) || `Enquiry from ${oneLine(fields.Name)}`;
  const safeRef = /^YS-[A-Z0-9]{6}$/.test(fields['Booking ref'] ?? '') ? fields['Booking ref'] : '';
  const onceKey = (who) => (safeRef ? `${safeRef}-${who}` : undefined);
  const canReply = /^[^@\s,;<>]+@[^@\s,;<>]+\.[^@\s,;<>]+$/.test(fields.Email ?? '');

  const lead = ownerEmail(fields, subject);
  const delivered = await resend(apiKey, {
    from: FROM,
    to: TEAM_TO(),
    cc: TEAM_CC(),
    subject,
    html: lead.html,
    text: lead.text,
    ...(canReply ? { reply_to: fields.Email } : {}),
  }, onceKey('team'));

  // The site falls back to its second route on a 502, so the lead is not lost.
  if (!delivered) return answer(502, { success: false, message: 'The email service refused it.' });

  let customer = 'none';
  if (canEmailCustomer(fields)) {
    const note = customerEmail(fields, subject);
    const sent = await resend(apiKey, {
      from: FROM,
      to: [fields.Email],
      subject: note.subject,
      html: note.html,
      text: note.text,
      reply_to: TEAM_TO()[0],
    }, onceKey('customer'));
    customer = sent ? 'sent' : 'failed';
  }

  return answer(200, { success: true, customer });
}
