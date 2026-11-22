/**
 * A tiny, blurred copy of a photograph to sit behind it.
 *
 * Every photograph on the site is shown whole (object-fit: contain), never
 * cropped to fill its frame (Akash, 22 Nov 2026: "the full image should be
 * visible, without the cut"). The frames stay one tidy shape, and whatever room
 * the photograph does not cover is filled with this, blurred and darkened, so a
 * tall picture in a wide frame reads as deliberate rather than letterboxed.
 *
 * 40px wide is plenty for something that is blurred anyway: a few hundred bytes.
 */
import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';

export async function backdrop(src: ImageMetadata): Promise<string> {
  const img = await getImage({ src, width: 40, format: 'webp', quality: 50 });
  return img.src;
}

/** The inline style for the backdrop element. */
export const backdropStyle = (url: string) => `background-image:url(${url})`;
