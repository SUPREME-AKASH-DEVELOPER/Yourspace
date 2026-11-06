/**
 * The single source of truth for what a booking costs.
 *
 * The booking flow AND the marketing pages (tickets, home, room, FAQ) all read
 * this file, so a price can never be right in one place and wrong in another.
 * `quote()` at the bottom is the only function that adds anything up.
 *
 * WHERE THESE NUMBERS COME FROM
 *   The owner's walkthrough of the booking flow (recorded, Nov 2026).
 *   Anything that walkthrough left open is `null` here, and the site says
 *   "confirmed on call" for it instead of guessing. Search for TODO(owner).
 *
 * A `null` price is deliberate, not a bug: it means "we have not been told".
 * Online payment is switched off for any booking that contains one.
 */

export type ArtKey = 'heart' | 'screen' | 'mic' | 'ring' | 'flame' | 'stage';

/* ------------------------------------------------------------------ */
/*  The room                                                           */
/* ------------------------------------------------------------------ */

/**
 * The seats, as they physically are (Tanishk, Nov): five recliners in the back
 * row and two bean bags in front of them, nearer the screen. Seven in all.
 * The picker, the room drawings and the booking summary all read this, so the
 * site can never suggest seven recliners.
 */
export const SEATING = { recliners: 5, beanBags: 2 } as const;

/** Nobody books more than this online, whatever the setup — one person per seat. */
export const MAX_GUESTS = SEATING.recliners + SEATING.beanBags;

/**
 * Every seat has a number, and the number says which kind it is: 1–5 are the
 * recliners in the back row, 6 and 7 the bean bags in front. The picker lets
 * people choose the seats they actually want — any one of them on its own —
 * so these two helpers are what everything else reads.
 */
export const SEAT_IDS: readonly number[] = Array.from({ length: MAX_GUESTS }, (_, i) => i + 1);

export type SeatKind = 'recliner' | 'beanbag';

export const seatKind = (n: number): SeatKind => (n <= SEATING.recliners ? 'recliner' : 'beanbag');

/** A seat number this room really has. Saved progress is checked against it. */
export const isSeatId = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= MAX_GUESTS;

/** Recliners fill first; bean bags only once all five recliners are taken. */
export function seatsFor(guests: number): { recliners: number; beanBags: number } {
  const g = Math.min(MAX_GUESTS, Math.max(0, Math.floor(guests)));
  const recliners = Math.min(g, SEATING.recliners);
  return { recliners, beanBags: g - recliners };
}

/**
 * The seats to start someone off with when all we have is a head count — from
 * the home page, say, or older saved progress. Recliners first, as before.
 */
export function defaultSeats(guests: number): number[] {
  const { recliners, beanBags } = seatsFor(guests);
  return [
    ...Array.from({ length: recliners }, (_, i) => i + 1),
    ...Array.from({ length: beanBags }, (_, i) => SEATING.recliners + i + 1),
  ];
}

/** Tidy a list of seats: real seats only, no duplicates, in room order. */
export const cleanSeats = (seats: unknown): number[] =>
  Array.isArray(seats) ? [...new Set(seats.filter(isSeatId))].sort((a, b) => a - b) : [];

/** "2 recliners", "1 recliner + 1 bean bag" — from the seats actually chosen. */
export function seatsLabel(seats: number[]): string {
  const recliners = seats.filter((n) => seatKind(n) === 'recliner').length;
  const beanBags = seats.length - recliners;
  const parts = [
    ...(recliners ? [`${recliners} ${recliners === 1 ? 'recliner' : 'recliners'}`] : []),
    ...(beanBags ? [`${beanBags} ${beanBags === 1 ? 'bean bag' : 'bean bags'}`] : []),
  ];
  return parts.join(' + ') || 'no seats yet';
}

/** "2 recliners", "5 recliners + 1 bean bag" — from a head count alone. */
export const seatingLabel = (guests: number): string => seatsLabel(defaultSeats(guests));

/** The lowest price anything starts from — used for "From ₹…" on the marketing pages. */
export const ROOM_BASE = 1500;

/** A standard session. Karaoke is shorter; see its setup below. */
export const SESSION_MINUTES = 90;
export const RUNTIME = '90 min';
export const SESSION_LABEL = '90-minute private session';

/* ------------------------------------------------------------------ */
/*  Occasions — step 1. What they are celebrating, not what they book. */
/* ------------------------------------------------------------------ */

export interface Experience {
  id: string;
  name: string;
  note: string;
  art: ArtKey;
  blurb: string;
  bestFor: string;
  setUp: string;
  cta: string;
  /** The setup we point them to on step 4. They can still pick another. */
  suggests: SetupId;
}

export const experiences: Experience[] = [
  {
    id: 'date', name: 'Date Night', note: 'Just the two of you', art: 'heart', suggests: 'date',
    blurb: "Just the two of you, a screen that's all yours, and nobody waiting on your table. No queue for the good seats, no stranger's phone lighting up two rows ahead, and no one asking you to settle the bill while the film is still running.",
    bestFor: '2 guests', setUp: 'Decor, fog entry, candlelight', cta: 'Plan a date night',
  },
  {
    id: 'watch', name: 'Watch Party', note: 'Your match, your show', art: 'screen', suggests: 'watch',
    blurb: "Your match, your show, your people — at a volume you'd never get away with at home. Bring the group, put the game on the big screen, and shout at it as loudly as it deserves.",
    bestFor: `Up to ${MAX_GUESTS} guests`, setUp: 'Big screen, full sound', cta: 'Plan a watch party',
  },
  {
    id: 'karaoke', name: 'Karaoke', note: 'Your playlist, no queue', art: 'mic', suggests: 'karaoke',
    blurb: "Your playlist, your voices, no queue and absolutely no judging. The room is closed, so the only people who hear the high note you didn't reach are the ones who came with you.",
    bestFor: `3–${MAX_GUESTS} guests`, setUp: 'Mic, lyrics on screen', cta: 'Book karaoke',
  },
  {
    id: 'proposal', name: 'Proposal', note: 'Set the scene, then ask', art: 'ring', suggests: 'date',
    blurb: "Set the scene exactly how you pictured it, then ask the question. Tell us the moment you want — the song, the slide, the cue to dim the lights — and we'll have it ready and stay out of the way.",
    bestFor: '2 guests', setUp: 'Decor, your cue, our timing', cta: 'Plan a proposal',
  },
  {
    id: 'candle', name: 'Candlelight Dinner', note: 'A table laid for two', art: 'flame', suggests: 'date',
    blurb: 'A table laid for two, warm light, and an empty room around you. Good for an anniversary, a birthday, or a Tuesday that needed rescuing.',
    bestFor: '2 guests', setUp: 'Candles, table, quiet', cta: 'Plan your dinner',
  },
  {
    id: 'standup', name: 'Stand-Up Night', note: 'Laugh as loud as you like', art: 'stage', suggests: 'movie',
    blurb: 'Pull up the specials, bring the snacks, and laugh as loud as you like. Or put someone from your own group on the floor and find out how they do.',
    bestFor: `Up to ${MAX_GUESTS} guests`, setUp: 'Lights down, volume up', cta: 'Plan a stand-up night',
  },
];

/**
 * The seventh choice: anything the six above do not cover.
 * Picking it asks the person to describe the night in their own words, which
 * we carry through the booking and read back on the call.
 */
export const OTHER = {
  id: 'other',
  name: 'Something else',
  note: 'Tell us what you have in mind',
  prompt: "What are you planning?",
  placeholder: 'A farewell, a reveal, a screening of something odd, a surprise for someone — whatever it is, say it in your own words.',
} as const;

/* ------------------------------------------------------------------ */
/*  Time slots — step 3                                                */
/* ------------------------------------------------------------------ */

export interface Slot { id: string; start: string; end: string }

/**
 * Eight 90-minute slots, noon to midnight.
 * TODO(owner): confirm every slot is open for every setup.
 * Karaoke runs 30 minutes from the start of whichever slot is chosen —
 * also to confirm.
 */
export const slots: Slot[] = [
  { id: 's1', start: '12:00 PM', end: '1:30 PM' },
  { id: 's2', start: '1:30 PM',  end: '3:00 PM' },
  { id: 's3', start: '3:00 PM',  end: '4:30 PM' },
  { id: 's4', start: '4:30 PM',  end: '6:00 PM' },
  { id: 's5', start: '6:00 PM',  end: '7:30 PM' },
  { id: 's6', start: '7:30 PM',  end: '9:00 PM' },
  { id: 's7', start: '9:00 PM',  end: '10:30 PM' },
  { id: 's8', start: '10:30 PM', end: '12:00 AM' },
];

/** "7:30 PM" plus 30 minutes is "8:00 PM". Only used for the shorter karaoke session. */
export function addMinutes(clock: string, mins: number): string {
  const m = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(clock);
  if (!m) return clock;
  let total = ((Number(m[1]) % 12) + (m[3] === 'PM' ? 12 : 0)) * 60 + Number(m[2]) + mins;
  total %= 24 * 60;
  const h24 = Math.floor(total / 60), mm = total % 60;
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/* ------------------------------------------------------------------ */
/*  Setups — step 4. What they actually book.                          */
/* ------------------------------------------------------------------ */

export type SetupId = 'date' | 'movie' | 'karaoke' | 'watch';

export interface Setup {
  id: SetupId;
  name: string;
  tagline: string;
  art: ArtKey;
  /** Session length, or null where it has not been set. */
  minutes: number | null;
  /** Fewer than this and it cannot be booked online — they call instead. */
  minGuests: number;
  maxGuests: number;
  /** Shown on the card as "₹150 per person", beside the total. */
  perPerson?: number;
  /** A decoration package is part of this setup and must be picked. */
  hasDecor: boolean;
  /** Step 5 offers add-ons for this setup; otherwise step 5 is skipped. */
  hasAddons: boolean;
  includes: string[];
  /** Key into the booking media (see BookingMedia.astro). Without one, the card is illustrated. */
  photo?: string;
  /** Set when the whole setup is not open for online booking yet. */
  closed?: string;
  /** Who it is built for, said gently rather than enforced. */
  idealFor?: number;
}

/** Shown when someone cannot book a setup online. Wording from the owner. */
export const CALL_US = 'This service is not available for online booking. Please contact us directly at the provided phone number.';

/**
 * Movie Space with a larger group.
 * TODO(owner): the walkthrough said "approximately ₹1,700" for 6–7. Confirm.
 */
const MOVIE_SMALL_MAX = 5;
const MOVIE_LARGE_PRICE = 1700;

/**
 * Karaoke at ₹150 a head is confirmed for 3–5 people.
 * TODO(owner): 6–7 was described as "₹500", which contradicts ₹150 a head.
 * Until that is settled, 6–7 can still be booked but is priced on the call.
 */
const KARAOKE_RATE = 150;
const KARAOKE_PRICED_MAX = 5;

export const setups: Setup[] = [
  {
    id: 'date', name: 'Celebration & Date Night', tagline: 'Decorated, candlelit, made for two',
    art: 'heart', minutes: SESSION_MINUTES, minGuests: 1, maxGuests: MAX_GUESTS, idealFor: 2,
    hasDecor: true, hasAddons: true, photo: 'setup-date',
    includes: ['Private room, 90 min', 'Your choice of decoration', 'Fog entry', 'Candlelight setup'],
  },
  {
    id: 'movie', name: 'Movie Space', tagline: 'Big screen, lights down, nothing else',
    art: 'screen', minutes: SESSION_MINUTES, minGuests: 1, maxGuests: MAX_GUESTS,
    hasDecor: false, hasAddons: false,
    includes: ['Private room, 90 min', 'Big screen + sound', `Up to ${MAX_GUESTS} guests`],
  },
  {
    id: 'karaoke', name: 'Karaoke', tagline: 'Thirty minutes, full volume',
    art: 'mic', minutes: 30, minGuests: 3, maxGuests: MAX_GUESTS, perPerson: KARAOKE_RATE,
    hasDecor: false, hasAddons: false,
    includes: ['Private room, 30 min', 'Mic + lyrics on screen', 'Minimum 3 guests'],
  },
  {
    // TODO(owner): Watch Party's duration, price, guest limit and flow were not
    // given. It is listed so people can see it exists, and closed to online booking.
    id: 'watch', name: 'Watch Party', tagline: 'Your match, on the big screen',
    art: 'stage', minutes: null, minGuests: 1, maxGuests: MAX_GUESTS,
    hasDecor: false, hasAddons: false,
    includes: ['Big screen + full sound', 'Bring the whole group'],
    closed: 'Opening for online booking soon. Call us and we will set it up.',
  },
];

export const setupOf = (id: string) => setups.find((s) => s.id === id) ?? null;

/** What a setup costs for this many guests, or why it cannot be booked online. */
export function setupPrice(id: string, guests: number): {
  amount: number | null;
  /** Shown under the price, e.g. "₹150 per person". */
  note?: string;
  /** Set when it cannot be booked online at this group size. */
  blocked?: string;
} {
  const s = setupOf(id);
  if (!s) return { amount: null, blocked: 'Pick a setup.' };
  if (s.closed) return { amount: null, blocked: s.closed };
  if (guests > s.maxGuests) return { amount: null, blocked: `Up to ${s.maxGuests} guests can book online. ${CALL_US}` };
  if (guests < s.minGuests) return { amount: null, blocked: CALL_US };

  switch (s.id) {
    case 'date':
      return { amount: ROOM_BASE, note: 'plus your decoration' };
    case 'movie':
      return guests <= MOVIE_SMALL_MAX
        ? { amount: ROOM_BASE, note: `up to ${MOVIE_SMALL_MAX} guests` }
        : { amount: MOVIE_LARGE_PRICE, note: `${MOVIE_SMALL_MAX + 1}–${s.maxGuests} guests` };
    case 'karaoke':
      return guests <= KARAOKE_PRICED_MAX
        ? { amount: KARAOKE_RATE * guests, note: `₹${KARAOKE_RATE} per person` }
        : { amount: null, note: `Price for ${KARAOKE_PRICED_MAX + 1}–${s.maxGuests} confirmed on call` };
    default:
      return { amount: null };
  }
}

/* ------------------------------------------------------------------ */
/*  Add-ons — step 5. Date Night only.                                 */
/* ------------------------------------------------------------------ */

export interface AddonOption {
  id: string;
  name: string;
  /** null = not set yet; it shows as "confirmed on call" and blocks online payment. */
  price: number | null;
  /** Said where the price would be when there is no price, e.g. "₹400–₹500". */
  priceNote?: string;
  /** Key into the booking media. Without one, the card is illustrated. */
  photo?: string;
}

export interface AddonGroup {
  id: string;
  name: string;
  blurb: string;
  art: ArtKey;
  options: AddonOption[];
  /** A line under the group pointing people to the phone for what is not online. */
  callFor?: string;
}

/**
 * One choice per group (tap again to remove it).
 *
 * Deliberately NOT here, per the owner: bubble entry, rose (separately),
 * LED balloons, snack platter. Fog entry and candlelight are already in every
 * decoration package, so they are not sold again.
 *
 * TODO(owner): real names, photographs and prices for every option below.
 * To add a photograph: drop it in src/assets/addons/, register it in
 * src/components/BookingMedia.astro, and set `photo` to its key here.
 */
export const addonGroups: AddonGroup[] = [
  {
    id: 'bouquet', name: 'Flower bouquet', art: 'heart',
    blurb: 'Waiting on the table when you walk in.',
    options: [
      { id: 'bouquet-s', name: 'Small bouquet',  price: 200 },
      { id: 'bouquet-m', name: 'Medium bouquet', price: 250 },
      { id: 'bouquet-l', name: 'Large bouquet',  price: 300 },
    ],
  },
  {
    id: 'cake', name: 'Cake', art: 'flame',
    blurb: 'Ready on the table, with a knife and candles.',
    options: [
      { id: 'cake-strawberry', name: 'Strawberry', price: null },
      { id: 'cake-chocolate',  name: 'Chocolate',  price: null },
    ],
  },
  {
    id: 'photo', name: 'Photoshoot', art: 'ring',
    blurb: 'Fifteen minutes of photographs during your session.',
    options: [
      { id: 'photo-15', name: '15-minute photoshoot', price: null, priceNote: '₹400–₹500' },
    ],
    callFor: 'Want something more elaborate? Custom shoots are arranged by phone, not online.',
  },
];

export const addonOf = (id: string) => {
  for (const g of addonGroups) {
    const o = g.options.find((x) => x.id === id);
    if (o) return { group: g, option: o };
  }
  return null;
};

/* ------------------------------------------------------------------ */
/*  The one place a total is worked out                                */
/* ------------------------------------------------------------------ */

export interface Line { label: string; amount: number | null; note?: string }

export interface Quote {
  lines: Line[];
  /** The sum of every line that has a price. */
  total: number;
  /** Labels of lines without a price yet. When non-empty, `total` is a floor. */
  unpriced: string[];
  /** Why this cannot be booked online, if it cannot. */
  blocked?: string;
}

/**
 * Price a booking.
 * `decorPrice` is passed in rather than looked up so this file does not import
 * the photographs (which would pull image metadata into every page's script).
 */
export function quote(sel: {
  setup: string;
  guests: number;
  decor?: { name: string; price: number | null } | null;
  addons?: string[];
}): Quote {
  const lines: Line[] = [];
  const s = setupOf(sel.setup);
  const sp = setupPrice(sel.setup, sel.guests);
  if (s) lines.push({ label: s.name, amount: sp.amount, note: sp.note });
  if (s?.hasDecor && sel.decor) {
    lines.push({ label: `${sel.decor.name} decoration`, amount: sel.decor.price });
  }
  if (s?.hasAddons) {
    (sel.addons ?? []).forEach((id) => {
      const hit = addonOf(id);
      if (hit) lines.push({ label: `${hit.group.name}: ${hit.option.name}`, amount: hit.option.price, note: hit.option.priceNote });
    });
  }
  return {
    lines,
    total: lines.reduce((sum, l) => sum + (l.amount ?? 0), 0),
    unpriced: lines.filter((l) => l.amount === null).map((l) => l.label),
    blocked: sp.blocked,
  };
}

/* ------------------------------------------------------------------ */
/*  For the marketing pages                                            */
/* ------------------------------------------------------------------ */

/** The public add-on list on the tickets page, from the same data the flow charges. */
export const priceList = addonGroups.flatMap((g) => g.options.map((o) => ({
  name: g.options.length > 1 ? `${g.name}, ${o.name.toLowerCase()}` : o.name,
  price: o.price,
  priceNote: o.priceNote,
}))).sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity) || a.name.localeCompare(b.name));

export const stepNames = ['Occasion', 'Date & guests', 'Time', 'Setup', 'Add-ons', 'Pay'];
