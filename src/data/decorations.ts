/**
 * The three decoration setups, with the photographs of each.
 *
 * The three packages are Aesthetic, Elite and Royal (owner's walkthrough, Nov).
 * Every one includes fog entry and candlelight, see DECOR_INCLUDED.
 *
 * Prices are Tanishk's (WhatsApp): Aesthetic ₹1,500 and Elite ₹3,000 (raised on
 * 22 Nov 2026 from ₹1,000 and ₹2,000), Royal ₹5,000 (11 Nov). Each is the price of the
 * decoration, added on top of the ₹1,500 Date Night session, so Royal comes to
 * ₹6,500.
 *
 * PHOTOGRAPHS AND FILM (Tanishk, 22 Nov 2026): every picture and clip here is
 * YourSpace's own room and its own work, shot by Tanishk ("we don't need to use
 * someone's photos now"). The borrowed pictures that were here before are gone,
 * and with them the two that showed a past customer's face and letter.
 *   - Which package each setup belongs to is our reading of the photos: the
 *     lilac arch is Aesthetic, the crescent moon is Elite, the pink rose wall
 *     with the open-book board is Royal. TODO(owner): confirm.
 *   - Shots that showed films or music videos on the projector were cropped so
 *     the screen is out of frame, or left out. Someone else's film and a real
 *     singer's face do not belong in our advertising.
 *   - The clips in public/media are a few seconds each, silent, played forward
 *     then back so the loop has no jump. They play only on screen, and never
 *     for anyone who has asked their device for reduced motion.
 */
import type { ImageMetadata } from 'astro';

import aesthetic1 from '../assets/decor/aesthetic-1.jpeg';
import aesthetic2 from '../assets/decor/aesthetic-2.jpeg';
import aesthetic3 from '../assets/decor/aesthetic-3.jpeg';
import elite1 from '../assets/decor/elite-1.jpeg';
import elite2 from '../assets/decor/elite-2.jpeg';
import royal1 from '../assets/decor/royal-1.jpeg';
import royal2 from '../assets/decor/royal-2.jpeg';
import royal3 from '../assets/decor/royal-3.jpeg';

export interface Photo {
  src: ImageMetadata;
  /** Describes the picture for anyone who cannot see it. */
  alt: string;
}

/** A short silent loop of the real setup, from public/media. */
export interface Film {
  src: string;
  poster: string;
}

/** In every package, and said so on every card. */
export const DECOR_INCLUDED = ['Fog entry', 'Candlelight setup'];

export interface Decoration {
  id: string;
  name: string;
  /** null means we have not set a price yet, the site says so plainly. */
  price: number | null;
  tagline: string;
  blurb: string;
  includes: string[];
  photos: Photo[];
  /** Real footage of this setup, shown in place of the first photograph where there is room. */
  film?: Film;
}

export const decorations: Decoration[] = [
  {
    id: 'aesthetic',
    name: 'Aesthetic',
    price: 1500,                     // Tanishk, 22 Nov 2026 (was ₹1,000)
    tagline: 'Soft lilac, gold and candlelight',
    blurb:
      'A double arch in lilac and white with a glowing Happy Birthday sign, a garland of lilac, blush and gold balloons, and a satin table of candles for the cake, with the floor filled in balloons.',
    includes: [
      ...DECOR_INCLUDED,
      'Double arch backdrop',
      'Happy Birthday neon',
      'Balloon garland',
      'Satin cake table',
      'Floor balloons',
    ],
    photos: [
      { src: aesthetic1, alt: 'A lilac and white double arch with a glowing Happy Birthday sign, a garland of lilac, blush and gold balloons, and a cake under a glass dome on a satin table ringed with candles.' },
      { src: aesthetic2, alt: 'The lilac arch with its Happy Birthday sign behind a cake on a fluted pedestal, with low fog rolling over a floor of balloons.' },
      { src: aesthetic3, alt: 'The arch and balloon garland beside the candlelit cake table, seen from the side, with lilac and white balloons across the floor.' },
    ],
  },
  {
    id: 'elite',
    name: 'Elite',
    price: 3000,                     // Tanishk, 22 Nov 2026 (was ₹2,000)
    tagline: 'A glowing moon over a sea of cloud',
    blurb:
      'A tall crescent moon lit from behind, a vase of pampas grass, and a floor of blush, white and gold balloons with low fog rolling across it, so you walk in through cloud.',
    includes: [
      ...DECOR_INCLUDED,
      'Glowing crescent moon',
      'Blush, white and gold balloon floor',
      'Pampas grass vase',
      'Low-lying fog',
    ],
    photos: [
      { src: elite1, alt: 'A tall white crescent moon glowing against a dark wall, with pampas grass in a white vase and fog drifting over a floor of blush, white and gold balloons.' },
      { src: elite2, alt: 'The crescent moon and pampas grass seen across the room, with gold balloons in the foreground half hidden in fog.' },
    ],
    film: { src: '/media/elite-moon.mp4', poster: '/media/elite-moon-poster.jpg' },
  },
  {
    id: 'royal',
    name: 'Royal',
    price: 5000,                     // Tanishk, 11 Nov 2026
    tagline: 'Roses, velvet and your own words',
    blurb:
      'A wall of pink roses and a velvet curtain framing an open-book board with your message written by hand, tall gold candlesticks and a music-box violin on a satin table, the most personal of the three.',
    includes: [
      ...DECOR_INCLUDED,
      'Pink rose wall',
      'Velvet curtain',
      'Your message, handwritten',
      'Gold candlesticks',
      'Floor balloons',
    ],
    photos: [
      { src: royal1, alt: 'A wall of pink roses and a pink velvet curtain framing a white board with Happy Birthday written by hand, a cake and tall gold candlesticks on a satin table, and blush and white balloons on the floor.' },
      { src: royal2, alt: 'The Royal table up close: a white cake on a gold stand between tall candles, a glass of wine and a little music-box violin, under the handwritten Happy Birthday.' },
      { src: royal3, alt: 'The rose wall, the handwritten Happy Birthday board and the pink velvet curtain, with the candlelit cake table in front.' },
    ],
    film: { src: '/media/royal-roses.mp4', poster: '/media/royal-roses-poster.jpg' },
  },
];

/** Every photograph, for the pages that show a gallery rather than the tiers. */
export const allDecorPhotos: Photo[] = decorations.flatMap((d) => d.photos);
