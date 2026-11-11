/**
 * The three decoration setups, with the photographs of each.
 *
 * The three packages are Elite, Royal and Aesthetic (owner's walkthrough, Nov).
 * Every one includes fog entry and candlelight — see DECOR_INCLUDED.
 *
 * Prices are Tanishk's (WhatsApp): Aesthetic ₹1,000 and Trendy ₹2,000 on
 * 11 Oct, Royal ₹5,000 on 11 Nov. Each is the price of the decoration, added
 * on top of the ₹1,500 Date Night session — so Royal comes to ₹6,500.
 *
 * ASSUMPTION — TODO(owner): "Elite" is the package that was called "Trendy" on
 * 11 Oct, so it keeps Trendy's photographs and ₹2,000. If that is wrong, swap
 * the photos and price below. In the booking flow a decoration's price is
 * added on top of the ₹1,500 Date Night session — also to confirm.
 *
 * TODO (Akash/Tanishk):
 *   0. Confirm these photographs are ours to publish — our own room and our own
 *      work, or licensed from whoever shot them. If any are a supplier's or a
 *      reference picture, they must come down before launch: a customer who
 *      books from them will expect exactly what they saw.
 *   0b. CONSENT: royal-2 and royal-3 show a real customer's private things —
 *      recognisable faces, a first name, and a personal letter written to them.
 *      Publishing those without that person's written permission is not ours to
 *      do. Get consent, or swap both for a setup shot taken with no guests and
 *      no personal messages in frame.
 *   1. Royal is ₹5,000 (11 Nov), the decoration on top of the ₹1,500 session
 *      like the other two, so a Royal Date Night is ₹6,500. Confirmed 11 Nov.
 *   2. These prices sit alongside the package prices in booking.ts, which were
 *      placeholders. Decide which is the real offer and reconcile the two.
 */
import type { ImageMetadata } from 'astro';

/*
 * REPLACING THE AESTHETIC PHOTOGRAPHS (Tanishk is sending new ones, Nov)
 *   1. Overwrite src/assets/decor/aesthetic-1.jpeg, -2 and -3 with the new
 *      pictures, keeping those names (any count: add aesthetic-4.jpeg and an
 *      import + entry below for more, or drop an entry for fewer).
 *      aesthetic-1 is the one the booking flow shows on the Aesthetic card.
 *   2. Rewrite each `alt` under Aesthetic to describe the new picture.
 *   3. If the new setup looks different, update its `blurb` and `includes`.
 *   Price and booking logic do not change. Use only photographs of our own
 *   room and our own work — never an AI or stock picture presented as ours.
 */
import aesthetic1 from '../assets/decor/aesthetic-1.jpeg';
import aesthetic2 from '../assets/decor/aesthetic-2.jpeg';
import aesthetic3 from '../assets/decor/aesthetic-3.jpeg';
import trendy1 from '../assets/decor/trendy-1.jpeg';
import trendy2 from '../assets/decor/trendy-2.jpeg';
import royal1 from '../assets/decor/royal-1.jpeg';
import royal2 from '../assets/decor/royal-2.jpeg';
import royal3 from '../assets/decor/royal-3.jpeg';

export interface Photo {
  src: ImageMetadata;
  /** Describes the picture for anyone who cannot see it. */
  alt: string;
}

/** In every package, and said so on every card. */
export const DECOR_INCLUDED = ['Fog entry', 'Candlelight setup'];

export interface Decoration {
  id: string;
  name: string;
  /** null means we have not set a price yet — the site says so plainly. */
  price: number | null;
  tagline: string;
  blurb: string;
  includes: string[];
  photos: Photo[];
}

export const decorations: Decoration[] = [
  {
    id: 'aesthetic',
    name: 'Aesthetic',
    price: 1000,
    tagline: 'Soft, light and uncluttered',
    blurb:
      'Balloons in soft blues, creams and gold, a draped backdrop and a neon sign, with the floor filled so the whole room feels part of it.',
    includes: [
      ...DECOR_INCLUDED,
      'Balloon arch in soft tones',
      'Draped backdrop',
      'Neon sign',
      'Floor balloons',
      'Pedestals for the cake',
    ],
    photos: [
      { src: aesthetic1, alt: 'A draped white backdrop lit warm, with a Happy Birthday neon sign, an arch of blue, cream and gold balloons, and cake pedestals standing in a floor of balloons.' },
      { src: aesthetic2, alt: 'A lilac arch backdrop with a Happy Birthday neon sign, a balloon garland in lilac, cream and gold, low fog, and a cake on a fluted pedestal.' },
      { src: aesthetic3, alt: 'The projection screen showing guest names and photos above a candlelit table, with balloons filling the floor of the dark room.' },
    ],
  },
  {
    id: 'elite',
    name: 'Elite',
    price: 2000,
    tagline: 'A crescent moon and low cloud',
    blurb:
      'A tall crescent moon, brass lanterns and pillar stands, with low fog rolling across a floor of pearl and gold balloons.',
    includes: [
      ...DECOR_INCLUDED,
      'Crescent moon backdrop',
      'Brass lanterns and props',
      'Pearl and gold balloons',
      'Fluted pedestals',
    ],
    photos: [
      { src: trendy1, alt: 'A tall crescent moon backdrop with brass bird lanterns on fluted pedestals, half-covered by low fog.' },
      { src: trendy2, alt: 'The room from the doorway: the projection screen on the left, the crescent moon and a Happy Birthday neon on the right, and fog over a floor of gold and pearl balloons.' },
    ],
  },
  {
    id: 'royal',
    name: 'Royal',
    price: 5000,                     // Tanishk, 11 Nov 2026
    tagline: 'With your own message and photographs',
    blurb:
      'Deep red roses, velvet drapes and candlelight, plus a written message and printed photographs of the two of you — the most personal of the three.',
    includes: [
      ...DECOR_INCLUDED,
      'Rose and velvet backdrop',
      'Your message, printed large',
      'Photo panels of your own pictures',
      'Floor balloons in red and white',
    ],
    photos: [
      { src: royal1, alt: 'A backdrop of deep red roses and velvet curtains beside an open-book panel, with tall candles on a draped table and red and white balloons across the floor.' },
      { src: royal2, alt: 'Four tall printed panels strung with fairy lights, showing photographs and written messages, beside a framed birthday portrait on an easel, with fog at the base.' },
      { src: royal3, alt: 'A long printed message in handwriting script hung between white drapes, lit by candles, with balloons at its foot.' },
    ],
  },
];

/** Every photograph, for the pages that show a gallery rather than the tiers. */
export const allDecorPhotos: Photo[] = decorations.flatMap((d) => d.photos);
