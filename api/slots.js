/**
 * GET /api/slots?date=YYYY-MM-DD
 *
 * The stretches of that day already booked, so the booking flow can grey them
 * out. Times only, in minutes past midnight with the reset gap included:
 * never a name, a phone number or anything else about who booked.
 *
 *   { success: true, store: true, busy: [[720, 825], [930, 1125]] }
 *
 * With no bookings database connected it answers `store: false, busy: []`
 * and the site behaves exactly as before (the team checks by phone).
 */
import { storeReady, takenOn } from './_store.js';

const answer = (status, body) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'no-store' },
});

export async function GET(request) {
  const date = new URL(request.url).searchParams.get('date') ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return answer(400, { success: false, message: 'Give a date as YYYY-MM-DD.' });
  if (!storeReady()) return answer(200, { success: true, store: false, busy: [] });
  try {
    return answer(200, { success: true, store: true, busy: await takenOn(date) });
  } catch (err) {
    console.error('Could not read the bookings', err);
    return answer(200, { success: true, store: false, busy: [] });
  }
}
