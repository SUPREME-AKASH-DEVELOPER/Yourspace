/**
 * Real footage of the decoration setups (public/media): a few silent seconds
 * that loop. They sit over the setup's photograph and fade in once playing, so
 * anyone who never sees them play still sees the photograph.
 *
 * A clip plays only while it is on screen, and never for anyone who has asked
 * their device for reduced motion or to save data. Nothing downloads until the
 * clip is about to be seen (preload="none").
 */
import type { Film } from '../data/decorations';

const quiet = () =>
  matchMedia('(prefers-reduced-motion: reduce)').matches ||
  Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);

let watcher: IntersectionObserver | null = null;

/** Start watching every film inside `root` that is not watched yet. */
export function watchFilms(root: ParentNode = document): void {
  if (quiet() || !('IntersectionObserver' in window)) return;
  watcher ??= new IntersectionObserver((entries) => {
    for (const e of entries) {
      const v = e.target as HTMLVideoElement;
      if (e.isIntersecting) {
        v.play().then(() => v.classList.add('is-playing')).catch(() => { /* blocked autoplay: the photo stays */ });
      } else {
        v.pause();
      }
    }
  }, { threshold: 0.35 });
  root.querySelectorAll<HTMLVideoElement>('video[data-film]').forEach((v) => {
    if (v.dataset.watched) return;
    v.dataset.watched = '1';
    v.muted = true;            // some browsers only autoplay what is muted in script too
    watcher!.observe(v);
  });
}

/** The same markup DecorDeck.astro writes, for cards drawn in the browser. */
export const filmMarkup = (film: Film): string =>
  `<video class="film" data-film muted loop playsinline preload="none" aria-hidden="true" tabindex="-1"` +
  ` poster="${film.poster}" src="${film.src}"></video>` +
  `<span class="film-tag" aria-hidden="true"><i></i>Filmed in our room</span>`;
