/**
 * The single source of truth for what a night costs.
 *
 * The booking flow AND the tickets page both read this file, so a price can
 * never be right in one place and wrong in the other.
 *
 * TODO (Akash/Tanishk): confirm every number here against the final catalogue.
 */

export type ArtKey = 'heart' | 'screen' | 'mic' | 'ring' | 'flame' | 'stage';

export interface Experience {
  id: string;
  name: string;
  note: string;
  art: ArtKey;
  blurb: string;
  bestFor: string;
  setUp: string;
  cta: string;
}

export interface Slot { id: string; start: string; end: string }

export interface Package {
  id: string;
  name: string;
  price: number;
  desc: string;
  includes: string[];
  tag?: string;
}

export interface Extra {
  id: string;
  group: string;
  name: string;
  /** How it reads on the public price list, where that differs. */
  listName?: string;
  price: number;
  max: number;
}

/** The room, up to 4 guests. */
export const ROOM_BASE = 1499;
export const BASE_GUESTS = 4;
export const EXTRA_GUEST = 300;
export const MAX_GUESTS = 12;
export const SESSION_LABEL = '2 hr 30 min private session';
export const RUNTIME = '2h 30m';

export const experiences: Experience[] = [
  {
    id: 'date', name: 'Date Night', note: 'Just the two of you', art: 'heart',
    blurb: "Just the two of you, a screen that's all yours, and nobody waiting on your table. No queue for the good seats, no stranger's phone lighting up two rows ahead, and no one asking you to settle the bill while the film is still running.",
    bestFor: '2 guests', setUp: 'Low light, table for two', cta: 'Plan a date night',
  },
  {
    id: 'watch', name: 'Watch Party', note: 'Your match, your show', art: 'screen',
    blurb: "Your match, your show, your people — at a volume you'd never get away with at home. Bring the group, put the game on the big screen, and shout at it as loudly as it deserves.",
    bestFor: '4–8 guests', setUp: 'Big screen, full sound', cta: 'Plan a watch party',
  },
  {
    id: 'karaoke', name: 'Karaoke', note: 'Your playlist, no queue', art: 'mic',
    blurb: "Your playlist, your voices, no queue and absolutely no judging. The room is closed, so the only people who hear the high note you didn't reach are the ones who came with you.",
    bestFor: '4–10 guests', setUp: 'Mic, lyrics on screen', cta: 'Book karaoke',
  },
  {
    id: 'proposal', name: 'Proposal', note: 'Set the scene, then ask', art: 'ring',
    blurb: "Set the scene exactly how you pictured it, then ask the question. Tell us the moment you want — the song, the slide, the cue to dim the lights — and we'll have it ready and stay out of the way.",
    bestFor: '2 guests', setUp: 'Decor, your cue, our timing', cta: 'Plan a proposal',
  },
  {
    id: 'candle', name: 'Candlelight Dinner', note: 'A table laid for two', art: 'flame',
    blurb: 'A table laid for two, warm light, and an empty room around you. Good for an anniversary, a birthday, or a Tuesday that needed rescuing.',
    bestFor: '2 guests', setUp: 'Candles, table, quiet', cta: 'Plan your dinner',
  },
  {
    id: 'standup', name: 'Stand-Up Night', note: 'Laugh as loud as you like', art: 'stage',
    blurb: 'Pull up the specials, bring the snacks, and laugh as loud as you like. Or put someone from your own group on the floor and find out how they do.',
    bestFor: '4–10 guests', setUp: 'Lights down, volume up', cta: 'Plan a stand-up night',
  },
];

export const slots: Slot[] = [
  { id: 's1', start: '10:30 AM', end: '1:00 PM' },
  { id: 's2', start: '1:30 PM',  end: '4:00 PM' },
  { id: 's3', start: '4:30 PM',  end: '7:00 PM' },
  { id: 's4', start: '7:30 PM',  end: '10:00 PM' },
  { id: 's5', start: '10:30 PM', end: '1:00 AM' },
];

export const packages: Package[] = [
  {
    id: 'room', name: 'Just the Room', price: 1499,
    desc: 'The screen, the sound and the room to yourselves. No decor.',
    includes: ['Private room', 'Big screen + sound', 'Lounge seating'],
  },
  {
    id: 'classic', name: 'Celebration Setup', price: 2499, tag: 'Best value',
    desc: 'The room plus a clean celebration setup, ready before you walk in.',
    includes: ['Everything in Just the Room', 'Balloon & LED decor', 'Name on screen', 'Staff on hand'],
  },
  {
    id: 'romantic', name: 'Romantic Setup', price: 3500,
    desc: 'Warm light, candles and petals — built for anniversaries and date nights.',
    includes: ['Everything in Celebration Setup', 'Candlelight setup', 'Rose petal decor', 'Bubble entry'],
  },
  {
    id: 'grand', name: 'Grand Celebration', price: 4500,
    desc: 'The full works, for proposals and milestone nights.',
    includes: ['Everything in Romantic Setup', 'Fog entry (2 matka)', 'Photo shoot (15 min)', 'Personalised decor'],
  },
];

export const extras: Extra[] = [
  { id: 'cake',    group: 'Food',            name: 'Cake (0.5 kg)',        listName: 'Cake, half kilo',          price: 600,  max: 4 },
  { id: 'snacks',  group: 'Food',            name: 'Snack platter',                                              price: 500,  max: 6 },
  { id: 'petal',   group: 'Decor',           name: 'Rose petal decor',                                           price: 300,  max: 2 },
  { id: 'candle',  group: 'Decor',           name: 'Candlelight setup',                                          price: 300,  max: 2 },
  { id: 'balloon', group: 'Decor',           name: 'Balloon & LED decor',                                        price: 499,  max: 2 },
  { id: 'flower',  group: 'Decor',           name: 'Flower bouquet',                                             price: 400,  max: 4 },
  { id: 'fog',     group: 'Special effects', name: 'Fog entry (2 matka)',  listName: 'Fog entry, two matkas',    price: 1000, max: 2 },
  { id: 'bubble',  group: 'Special effects', name: 'Bubble entry',                                               price: 300,  max: 1 },
  { id: 'shoot',   group: 'Photography',     name: 'Photo shoot (15 min)', listName: 'Photo shoot, 15 minutes',  price: 800,  max: 2 },
];

/** The public price list: every extra, plus the extra-guest charge, cheapest first. */
export const priceList = [
  ...extras.map((e) => ({ name: e.listName ?? e.name, price: e.price })),
  { name: 'Each extra guest', price: EXTRA_GUEST },
].sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));

export const stepNames = ['Occasion', 'Date & seats', 'Time', 'Package', 'Extras', 'Details'];

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
