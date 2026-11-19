/**
 * /api/admin, behind the bookings dashboard at /admin/.
 *
 *   POST { action: 'login', password }      sets a signed cookie for 12 hours
 *   POST { action: 'logout' }
 *   GET                                      every booking (needs the cookie)
 *   POST { action: 'update', ref, patch, force? }
 *        patch: { status: 'new'|'confirmed'|'cancelled', date, slot, setup, adminNote }
 *        Cancelling frees the slot on the website straight away.
 *        Moving onto a taken slot is refused unless force is true.
 *   POST { action: 'create', booking, force? }   a phone or walk-in booking
 *
 * Needs, in Vercel (Project > Settings > Environment Variables):
 *   ADMIN_PASSWORD   the password Tanishk types at /admin/
 *   ADMIN_SECRET     optional, any long random string, signs the login cookie.
 *                    Changing it logs everyone out.
 * and the bookings database (see api/_store.js).
 */
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { allowedOrigin, overLimit } from './send.js';
import { storeReady, listBookings, updateBooking, createBooking, isRef } from './_store.js';

const COOKIE = 'ys_admin';
const TTL_SECONDS = 12 * 60 * 60;

const json = (status, body, headers = {}) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'no-store', ...headers },
});

const secret = () => process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || '';

const sign = (exp) => createHmac('sha256', secret()).update(`ys-admin.${exp}`).digest('base64url');

function same(a, b) {
  const x = createHash('sha256').update(String(a)).digest();
  const y = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(x, y);
}

function cookie(value, maxAge) {
  // Path is the API itself: the cookie is never sent with ordinary page loads
  return `${COOKIE}=${value}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

function signedIn(request) {
  if (!secret()) return false;
  const raw = (request.headers.get('cookie') ?? '')
    .split(';').map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`));
  if (!raw) return false;
  const [exp, mac] = raw.slice(COOKIE.length + 1).split('.');
  if (!exp || !mac || !/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) return false;
  return same(mac, sign(exp));
}

const ipOf = (request) => (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';

export async function GET(request) {
  if (!process.env.ADMIN_PASSWORD) return json(503, { success: false, setup: 'password', message: 'ADMIN_PASSWORD is not set in Vercel yet.' });
  if (!signedIn(request)) return json(401, { success: false, message: 'Please log in.' });
  if (!storeReady()) return json(503, { success: false, setup: 'store', message: 'The bookings database is not connected yet.' });
  try {
    return json(200, { success: true, bookings: await listBookings() });
  } catch (err) {
    console.error(err);
    return json(502, { success: false, message: 'Could not read the bookings database.' });
  }
}

export async function POST(request) {
  if (!allowedOrigin(request.headers.get('origin') ?? '')) {
    return json(403, { success: false, message: 'Not allowed.' });
  }
  if (!process.env.ADMIN_PASSWORD) return json(503, { success: false, setup: 'password', message: 'ADMIN_PASSWORD is not set in Vercel yet.' });

  const raw = await request.text();
  if (raw.length > 8_000) return json(413, { success: false, message: 'Too long.' });
  let body;
  try { body = JSON.parse(raw); } catch { body = null; }
  if (!body || typeof body !== 'object') return json(400, { success: false, message: 'Not valid JSON.' });

  if (body.action === 'login') {
    if (overLimit(`admin:${ipOf(request)}`)) return json(429, { success: false, message: 'Too many tries. Wait ten minutes.' });
    if (!same(body.password ?? '', process.env.ADMIN_PASSWORD)) {
      return json(401, { success: false, message: 'That password is not right.' });
    }
    const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
    return json(200, { success: true }, { 'Set-Cookie': cookie(`${exp}.${sign(exp)}`, TTL_SECONDS) });
  }
  if (body.action === 'logout') {
    return json(200, { success: true }, { 'Set-Cookie': cookie('', 0) });
  }

  if (!signedIn(request)) return json(401, { success: false, message: 'Please log in.' });
  if (!storeReady()) return json(503, { success: false, setup: 'store', message: 'The bookings database is not connected yet.' });

  try {
    if (body.action === 'update') {
      if (!isRef(body.ref)) return json(400, { success: false, message: 'Missing booking reference.' });
      const patch = body.patch && typeof body.patch === 'object' ? body.patch : {};
      const r = await updateBooking(body.ref, patch, body.force === true);
      return r.ok ? json(200, { success: true, booking: r.booking })
        : json(r.status, { success: false, message: r.message, clash: r.clash });
    }
    if (body.action === 'create') {
      const r = await createBooking(body.booking, body.force === true);
      return r.ok ? json(200, { success: true, booking: r.booking })
        : json(r.status, { success: false, message: r.message, clash: r.clash });
    }
  } catch (err) {
    console.error(err);
    return json(502, { success: false, message: 'Could not save to the bookings database.' });
  }
  return json(400, { success: false, message: 'Unknown action.' });
}
