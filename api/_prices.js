/**
 * What a booking costs, worked out on the server.
 *
 * The browser shows the price from src/data/booking.ts and decorations.ts, but
 * the amount a customer is CHARGED is decided here, so nobody can edit the page
 * and pay ₹1 for a ₹6,500 night. Those files cannot be imported here (they are
 * TypeScript, and decorations.ts pulls in the photographs), so the numbers are
 * repeated below.
 *
 * tests/payments.spec.ts prices every setup, guest count, decoration and add-on
 * both ways and fails if this file and the site ever disagree. Change a price in
 * src/data and that test tells you to change it here too.
 */

const MAX_GUESTS = 7;
const ROOM_BASE = 1500;
const MOVIE_SMALL_MAX = 5;
const MOVIE_LARGE_PRICE = 1700;
const KARAOKE_RATE = 150;
const KARAOKE_PRICED_MAX = 5;

/** setup id -> the guest range that can book it online. Watch Party is closed. */
const SETUPS = {
  date: { min: 1, max: MAX_GUESTS, decor: true, addons: true },
  movie: { min: 1, max: MAX_GUESTS, decor: false, addons: false },
  karaoke: { min: 3, max: MAX_GUESTS, decor: false, addons: false },
};

/**
 * The slots a decoration can be set up for: sessions starting from 2:30 PM and
 * before 9:30 PM, while the one decorator is working (decorAvailable() in
 * src/data/booking.ts). Outside them Date Night is the room alone.
 */
export const DECOR_SLOTS = ['s3', 's4', 's5', 's6'];

/** null = priced on the call, so the booking cannot be paid online. */
export const DECOR_PRICES = { aesthetic: 1000, elite: 2000, royal: 5000 };

export const ADDON_PRICES = {
  'bouquet-s': 200,
  'bouquet-m': 250,
  'bouquet-l': 300,
  'cake-strawberry': null,
  'cake-chocolate': null,
  'photo-15': null,
};

/** The add-on groups, so a booking can hold at most one of each. */
const ADDON_GROUP = (id) => id.split('-')[0];

/**
 * The amount in rupees, or null with a reason when this booking cannot be
 * paid online (something is priced on the call, or it is not bookable).
 */
export function priceBooking({ setup, guests, slot, decor, addons }) {
  const s = Object.hasOwn(SETUPS, setup) ? SETUPS[setup] : null;
  const g = Number(guests);
  if (!s) return { amount: null, reason: 'That setup cannot be paid for online.' };
  if (!Number.isInteger(g) || g < s.min || g > s.max) return { amount: null, reason: 'That number of guests cannot be paid for online.' };

  let total;
  if (setup === 'date') total = ROOM_BASE;
  else if (setup === 'movie') total = g <= MOVIE_SMALL_MAX ? ROOM_BASE : MOVIE_LARGE_PRICE;
  else {
    if (g > KARAOKE_PRICED_MAX) return { amount: null, reason: 'Karaoke for this many is priced on the call.' };
    total = KARAOKE_RATE * g;
  }

  if (s.decor && !DECOR_SLOTS.includes(slot)) {
    if (decor) return { amount: null, reason: 'Decoration is not available at that time.' };
  } else if (s.decor) {
    if (!Object.hasOwn(DECOR_PRICES, decor)) return { amount: null, reason: 'Pick a decoration.' };
    const d = DECOR_PRICES[decor];
    if (d === null) return { amount: null, reason: 'That decoration is priced on the call.' };
    total += d;
  }

  if (s.addons && Array.isArray(addons)) {
    const groups = new Set();
    for (const id of addons) {
      if (typeof id !== 'string' || !Object.hasOwn(ADDON_PRICES, id)) return { amount: null, reason: 'Unknown add-on.' };
      if (groups.has(ADDON_GROUP(id))) return { amount: null, reason: 'One of each add-on at most.' };
      groups.add(ADDON_GROUP(id));
      const p = ADDON_PRICES[id];
      if (p === null) return { amount: null, reason: 'An add-on is priced on the call.' };
      total += p;
    }
  }

  return { amount: total };
}
