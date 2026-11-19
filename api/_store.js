/**
 * The bookings database, for the admin dashboard (/admin/).
 *
 * Every booking made on the site is saved here by /api/send, as well as being
 * emailed. The team sees them at /admin/, can confirm, cancel (which frees the
 * slot on the site again), move a booking to another date or time, and add
 * bookings taken over the phone so the site cannot sell the same slot twice.
 *
 * Storage is Upstash Redis over its REST API (no package needed). In Vercel:
 * Project > Storage (or Marketplace) > Upstash for Redis > connect to this
 * project. That sets KV_REST_API_URL and KV_REST_API_TOKEN by itself.
 * UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN work too.
 *
 * Without either, nothing breaks: bookings are still emailed, the site greys
 * nothing out, and the dashboard says the database is not connected.
 *
 * All bookings live in one Redis hash, ref -> JSON. A small business with a
 * few thousand bookings a year reads that in one call.
 */
import { SLOT_STARTS, heldSpan, fitsBeforeClose } from './_prices.js';

const KEY = 'ys:bookings';

function creds() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
  return url && token ? { url: url.replace(/\/+$/, ''), token } : null;
}

/** In-memory stand-in, only for the test suite (YS_STORE=memory). */
const memory = new Map();
const useMemory = () => process.env.YS_STORE === 'memory';

export const storeReady = () => useMemory() || Boolean(creds());

async function redis(command) {
  const c = creds();
  if (!c) throw new Error('Bookings database is not connected.');
  const res = await fetch(c.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new Error(`Redis refused: ${body.error ?? res.status}`);
  return body.result;
}

async function readAll() {
  if (useMemory()) return [...memory.values()].map((v) => JSON.parse(v));
  const flat = (await redis(['HGETALL', KEY])) ?? [];
  const out = [];
  for (let i = 1; i < flat.length; i += 2) {
    try { out.push(JSON.parse(flat[i])); } catch { /* skip a damaged row */ }
  }
  return out;
}

async function readOne(ref) {
  if (useMemory()) return memory.has(ref) ? JSON.parse(memory.get(ref)) : null;
  const raw = await redis(['HGET', KEY, ref]);
  return raw ? JSON.parse(raw) : null;
}

async function write(b) {
  if (useMemory()) { memory.set(b.ref, JSON.stringify(b)); return; }
  await redis(['HSET', KEY, b.ref, JSON.stringify(b)]);
}

/** Only for tests. */
export function _resetMemory() { memory.clear(); }

/* ------------------------------------------------------------------ */
/*  Cleaning what comes in                                             */
/* ------------------------------------------------------------------ */

export const SETUP_NAMES = {
  date: 'Celebration & Date Night',
  movie: 'Movie Space',
  karaoke: 'Karaoke',
  watch: 'Watch Party',
};
export const STATUSES = ['new', 'confirmed', 'cancelled'];

const clip = (v, n) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, n);
const isIso = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d ?? '')) && !Number.isNaN(Date.parse(d));
export const isRef = (r) => /^YS-[A-Z0-9]{6}$/.test(String(r ?? ''));
const isSlot = (s) => Object.hasOwn(SLOT_STARTS, s);
const isSetup = (s) => Object.hasOwn(SETUP_NAMES, s);

/**
 * A booking as the site sends it, checked field by field. Returns null when
 * the essentials (ref, date, slot, setup, name, phone) are not all there.
 * A browser can never set the status or say it has paid: those come from the
 * team or from Razorpay.
 */
export function cleanBooking(raw, source = 'website') {
  if (!raw || typeof raw !== 'object') return null;
  const ref = String(raw.ref ?? '');
  if (!isRef(ref) || !isIso(raw.date) || !isSlot(raw.slot) || !isSetup(raw.setup)) return null;
  const name = clip(raw.name, 80);
  const phone = clip(raw.phone, 20);
  if (!name || !/\d{10}/.test(phone.replace(/\D/g, ''))) return null;
  const guests = Math.min(7, Math.max(1, Math.floor(Number(raw.guests) || 1)));
  return {
    ref,
    source,
    status: 'new',
    date: raw.date,
    slot: raw.slot,
    setup: raw.setup,
    guests,
    seats: Array.isArray(raw.seats) ? raw.seats.filter((n) => Number.isInteger(n) && n >= 1 && n <= 7).slice(0, 7) : [],
    name,
    phone,
    email: clip(raw.email, 120),
    occasion: clip(raw.occasion, 120),
    decor: clip(raw.decor, 60),
    addons: Array.isArray(raw.addons) ? raw.addons.slice(0, 6).map((a) => clip(a, 60)).filter(Boolean) : [],
    total: clip(raw.total, 60),
    pay: raw.pay === 'online' ? 'online' : 'later',
    paid: null,
    notes: clip(raw.notes, 600),
    adminNote: '',
    createdAt: new Date().toISOString(),
    history: [{ at: new Date().toISOString(), what: source === 'admin' ? 'Added from the dashboard' : 'Booked on the website' }],
  };
}

/* ------------------------------------------------------------------ */
/*  Who is in the room when                                            */
/* ------------------------------------------------------------------ */

/** Bookings that hold the room. Cancelled ones do not. */
const holds = (b) => b.status !== 'cancelled';

/** Times taken on a date, [start, end) in minutes past midnight, buffer included. */
export function busyOn(bookings, date, exceptRef = '') {
  return bookings
    .filter((b) => b.date === date && holds(b) && b.ref !== exceptRef)
    .map((b) => heldSpan(b.slot, b.setup))
    .filter(Boolean)
    .sort((a, b) => a[0] - b[0]);
}

/** Other bookings this one would overlap. */
export function clashesWith(bookings, b) {
  const span = heldSpan(b.slot, b.setup);
  if (!span) return [];
  // the candidate itself needs no buffer after it to clash: a session
  // starting exactly when the last one's reset gap ends is fine
  const [a, z] = [span[0], span[1] - 15];
  return bookings.filter((o) => {
    if (o.ref === b.ref || o.date !== b.date || !holds(o)) return false;
    const s = heldSpan(o.slot, o.setup);
    return s && a < s[1] && z > s[0];
  });
}

/* ------------------------------------------------------------------ */
/*  What the API calls                                                 */
/* ------------------------------------------------------------------ */

/**
 * Save a booking from the website. Idempotent on the ref: a retried send
 * never makes a second copy or overwrites what the team has done to it.
 * Marks it `clash` if the slot was already taken, so the dashboard shows it.
 */
export async function saveWebsiteBooking(raw) {
  const b = cleanBooking(raw, 'website');
  if (!b) return { ok: false, reason: 'invalid' };
  if (await readOne(b.ref)) return { ok: true, existed: true };
  const all = await readAll();
  const clash = clashesWith(all, b);
  if (clash.length || !fitsBeforeClose(b.slot, b.setup)) b.clash = true;
  await write(b);
  return { ok: true, clash: Boolean(b.clash) };
}

export async function takenOn(date) {
  if (!isIso(date)) return [];
  return busyOn(await readAll(), date);
}

export async function listBookings() {
  return (await readAll()).sort((a, b) =>
    a.date.localeCompare(b.date) || (SLOT_STARTS[a.slot] ?? 0) - (SLOT_STARTS[b.slot] ?? 0));
}

/** Razorpay confirmed the money (api/pay.js). */
export async function markPaid(ref, paymentId, amount) {
  if (!storeReady() || !isRef(ref)) return;
  const b = await readOne(ref);
  if (!b) return;
  b.paid = { paymentId: clip(paymentId, 40), amount: Number(amount) || 0, at: new Date().toISOString() };
  b.history = [...(b.history ?? []), { at: new Date().toISOString(), what: `Paid online, ₹${b.paid.amount} (${b.paid.paymentId})` }];
  await write(b);
}

/**
 * A change from the dashboard: status, a new date/time/setup, or the team's
 * own note. Moving onto a taken slot is refused unless `force` is set.
 */
export async function updateBooking(ref, patch, force = false) {
  const b = await readOne(ref);
  if (!b) return { ok: false, status: 404, message: 'No booking with that reference.' };
  const before = { date: b.date, slot: b.slot, setup: b.setup, status: b.status };
  const notes = [];

  if (patch.status !== undefined) {
    if (!STATUSES.includes(patch.status)) return { ok: false, status: 400, message: 'Unknown status.' };
    if (patch.status !== b.status) notes.push(`Status: ${b.status} → ${patch.status}`);
    b.status = patch.status;
  }
  if (patch.date !== undefined) {
    if (!isIso(patch.date)) return { ok: false, status: 400, message: 'That date is not valid.' };
    b.date = patch.date;
  }
  if (patch.slot !== undefined) {
    if (!isSlot(patch.slot)) return { ok: false, status: 400, message: 'That time is not valid.' };
    b.slot = patch.slot;
  }
  if (patch.setup !== undefined) {
    if (!isSetup(patch.setup)) return { ok: false, status: 400, message: 'That setup is not valid.' };
    b.setup = patch.setup;
  }
  if (patch.adminNote !== undefined) b.adminNote = clip(patch.adminNote, 600);

  const moved = b.date !== before.date || b.slot !== before.slot || b.setup !== before.setup;
  if (moved) notes.push(`Moved: ${before.date} ${before.slot} ${before.setup} → ${b.date} ${b.slot} ${b.setup}`);

  // only check the room when this booking holds it and something about that changed
  if (holds(b) && (moved || before.status === 'cancelled')) {
    if (!fitsBeforeClose(b.slot, b.setup)) {
      return { ok: false, status: 409, message: 'That would run past midnight.' };
    }
    const clash = clashesWith(await readAll(), b);
    if (clash.length && !force) {
      return {
        ok: false, status: 409,
        message: `That time is taken by ${clash.map((c) => `${c.name} (${c.ref})`).join(', ')}.`,
        clash: clash.map((c) => c.ref),
      };
    }
    b.clash = clash.length > 0;
  }
  if (!holds(b)) b.clash = false;

  if (notes.length || patch.adminNote !== undefined) {
    b.history = [...(b.history ?? []), ...notes.map((what) => ({ at: new Date().toISOString(), what }))].slice(-40);
  }
  await write(b);
  return { ok: true, booking: b };
}

/** A booking taken by phone or walk-in, added from the dashboard. */
export async function createBooking(raw, force = false) {
  const ref = isRef(raw?.ref) ? raw.ref : makeRef();
  const b = cleanBooking({ ...raw, ref }, 'admin');
  if (!b) return { ok: false, status: 400, message: 'Name, a 10-digit phone, date, time and setup are needed.' };
  if (await readOne(b.ref)) return { ok: false, status: 409, message: 'That reference is already used.' };
  b.status = 'confirmed';
  if (!fitsBeforeClose(b.slot, b.setup)) return { ok: false, status: 409, message: 'That would run past midnight.' };
  const clash = clashesWith(await readAll(), b);
  if (clash.length && !force) {
    return {
      ok: false, status: 409,
      message: `That time is taken by ${clash.map((c) => `${c.name} (${c.ref})`).join(', ')}.`,
      clash: clash.map((c) => c.ref),
    };
  }
  b.clash = clash.length > 0;
  await write(b);
  return { ok: true, booking: b };
}

function makeRef() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return 'YS-' + Array.from(bytes, (x) => abc[x % abc.length]).join('');
}
