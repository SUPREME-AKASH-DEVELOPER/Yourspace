/**
 * The three decoration setups, with the photographs of each.
 *
 * Prices are Tanishk's (WhatsApp, 11 Oct): Aesthetic ₹1,000 and Trendy ₹2,000.
 * The Royal price was not given, so it is left null and the site says
 * "price on request" rather than guessing a number.
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
 *   1. Set ROYAL's price.
 *   2. These prices sit alongside the package prices in booking.ts, which were
 *      placeholders. Decide which is the real offer and reconcile the two.
 */
import type { ImageMetadata } from 'astro';

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
    id: 'trendy',
    name: 'Trendy',
    price: 2000,
    tagline: 'A crescent moon and low cloud',
    blurb:
      'A tall crescent moon, brass lanterns and pillar stands, with low fog rolling across a floor of pearl and gold balloons.',
    includes: [
      'Crescent moon backdrop',
      'Low fog across the floor',
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
    price: null,                     // TODO: Tanishk to confirm
    tagline: 'With your own message and photographs',
    blurb:
      'Deep red roses, velvet drapes and candlelight, plus a written message and printed photographs of the two of you — the most personal of the three.',
    includes: [
      'Rose and velvet backdrop',
      'Candlelit table',
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
