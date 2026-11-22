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
  const films = root.querySelectorAll<HTMLVideoElement>('video[data-film]');
  if (quiet()) {
    // autoplay is in the markup so the loop starts without waiting for this
    // script; for anyone who asked for less motion, stop it outright
    films.forEach((v) => { v.removeAttribute('autoplay'); v.autoplay = false; v.pause(); });
    return;
  }
  if (!('IntersectionObserver' in window)) return;
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
  films.forEach((v) => {
    if (v.dataset.watched) return;
    v.dataset.watched = '1';
    v.muted = true;            // some browsers only autoplay what is muted in script too
    v.loop = true;
    // belt and braces: if a browser ever stops at the end, start it again
    v.addEventListener('ended', () => { v.currentTime = 0; v.play().catch(() => {}); });
    v.addEventListener('playing', () => v.classList.add('is-playing'));
    watcher!.observe(v);
  });
}

/** The same markup DecorDeck.astro writes, for cards drawn in the browser. */
export const filmMarkup = (film: Film): string =>
  `<video class="film" data-film muted loop autoplay playsinline disablepictureinpicture disableremoteplayback preload="none" aria-hidden="true" tabindex="-1"` +
  ` poster="${film.poster}" src="${film.src}"></video>` +
  `<span class="film-tag" aria-hidden="true"><i></i>Filmed in our room</span>`;

// a tab that was hidden pauses its videos; pick the visible ones up again
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || quiet()) return;
    document.querySelectorAll<HTMLVideoElement>('video[data-film].is-playing').forEach((v) => {
      if (v.paused) v.play().catch(() => {});
    });
  });
}
