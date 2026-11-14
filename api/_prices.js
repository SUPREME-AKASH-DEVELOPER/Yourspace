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

/** When each slot starts, in minutes past midnight. Mirrors src/data/booking.ts. */
const SLOT_STARTS = {
  s1: 12 * 60, s2: 13 * 60 + 45, s3: 15 * 60 + 30, s4: 17 * 60 + 15,
  s5: 19 * 60, s6: 20 * 60 + 45, s7: 22 * 60 + 30,
};

/**
 * The notice one decorator needs to buy flowers, get to the room and build the
 * set (decorStatus() in src/data/booking.ts). Three hours.
 *
 * The browser works this out too, to grey the slot out, but the browser's
 * clock belongs to the customer and its code can be edited. This is the one
 * that decides, and it reads Jabalpur's clock from the server.
 */
export const DECOR_NOTICE_MINUTES = 3 * 60;
export const VENUE_TZ = 'Asia/Kolkata';

/** Now, in Jabalpur: the date there and the minutes past midnight there. */
export function venueNow(at = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: VENUE_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(at).map((x) => [x.type, x.value]));
  return { iso: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

/**
 * 'online' | 'call' | 'closed' for a decoration, exactly as the site works it
 * out. tests/payments.spec.ts runs both against the same clock and fails if
 * they ever disagree.
 */
export function decorStatus(slot, dateIso, now = venueNow()) {
  if (!DECOR_SLOTS.includes(slot)) return 'closed';
  const day = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
    return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : NaN;
  };
  const from = day(now.iso), to = day(dateIso);
  // a date we cannot read is never treated as far enough away
  if (Number.isNaN(from) || Number.isNaN(to)) return 'call';
  const until = (to - from) / 60000 + SLOT_STARTS[slot] - now.minutes;
  return until >= DECOR_NOTICE_MINUTES ? 'online' : 'call';
}

/** null = priced on the call, so the booking cannot be paid online. */
/** @type {Record<string, number|null>} */
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
/**
 * @param {{ setup?: string, guests?: number|string, slot?: string, decor?: string,
 *           addons?: string[], date?: string, agreed?: string[],
 *           now?: { iso: string, minutes: number } }} [booking]
 * @returns {{ amount: number|null, reason?: string }}
 */
export function priceBooking(booking = {}) {
  const {
    setup, guests, slot = '', decor = '', addons = [], date = '', agreed = [], now = venueNow(),
  } = booking;
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

  if (s.decor) {
    /* Hours and notice, both decided here, because the page that asked them
       runs on the customer's machine. A decoration we cannot actually do is
       refused outright rather than quietly dropped and charged for: they
       would be paying for a room they believe is being decorated.
       Where decoration is not on offer, the room alone still is. */
    const state = decorStatus(slot, date, now);
    if (decor) {
      if (state === 'closed') return { amount: null, reason: 'Decoration is not available at that time.' };
      if (state === 'call') return { amount: null, reason: 'That session is too soon to add decoration online. Please call us.' };
      if (!Object.hasOwn(DECOR_PRICES, decor)) return { amount: null, reason: 'Pick a decoration.' };
      const d = DECOR_PRICES[decor];
      if (d === null) return { amount: null, reason: 'That decoration is priced on the call.' };
      total += d;
    } else if (state === 'online') {
      // decoration is on offer at this hour, so one has to be chosen
      return { amount: null, reason: 'Pick a decoration.' };
    }
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

  if (!rulesAccepted(agreed)) {
    return { amount: null, reason: 'The house rules have to be agreed to before paying.' };
  }

  return { amount: total };
}

/**
 * The house rules that must be ticked, mirroring HOUSE_RULES in
 * src/data/booking.ts. A booking is not paid for until all of them are agreed
 * to, and the browser is not trusted to have asked.
 */
export const REQUIRED_RULES = ['smoking', 'celebration', 'staff', 'damage', 'more'];

export function rulesAccepted(agreed) {
  if (!Array.isArray(agreed)) return false;
  return REQUIRED_RULES.every((id) => agreed.includes(id));
}
