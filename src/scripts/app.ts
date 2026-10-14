import { $, $$, stash } from './dom';
import { site, phoneIsSet, phoneAltIsSet, prettyPhone, prettyPhoneAlt, waLink } from '../data/site';
import { mountBooking, openBooking, prefillBooking, prefillDecor } from './booking';
import { experiences, OTHER } from '../data/booking';
import { decorations } from '../data/decorations';

/* ---------- contact links ---------- */
function wireContact() {
  $$('[data-phone-text]').forEach((el) => {
    el.textContent = phoneIsSet ? prettyPhone : 'Phone number coming soon';
  });
  // the second line: fill it, or take the slot out entirely if there isn't one
  $$('[data-phone-alt]').forEach((el) => {
    if (!phoneAltIsSet) { el.closest('[data-phone-alt-wrap]')?.remove() ?? el.remove(); return; }
    el.textContent = prettyPhoneAlt;
    if (el instanceof HTMLAnchorElement) el.href = `tel:${site.phoneAlt}`;
  });
  $$<HTMLAnchorElement>('[data-call]').forEach((a) => {
    if (phoneIsSet) { a.href = `tel:${site.phone}`; return; }
    a.href = '/contact/';
    a.title = 'Set phone in src/data/site.ts to enable calling';
  });
  $$<HTMLAnchorElement>('[data-wa]').forEach((a) => {
    if (!phoneIsSet) { a.href = '/contact/'; return; }
    a.target = '_blank';
    a.rel = 'noopener';
    a.href = waLink('Hi YourSpace! I would like to pre-book a slot.');
  });
  $$<HTMLAnchorElement>('[data-email]').forEach((a) => {
    if (site.email) { a.href = `mailto:${site.email}`; a.textContent = site.email; }
    else { a.removeAttribute('href'); a.textContent = 'Email coming soon'; }
  });
}

/* ---------- the page knows the hour and the day ----------
   The greeting and the suggestion are filled in here rather than rendered
   into the HTML, because a static page is cached and would otherwise go
   stale. Both have sensible defaults in the markup if this never runs.    */
function wireLive() {
  const hour = new Date().getHours();
  const greeting =
    hour < 5  ? 'Still up' :
    hour < 12 ? 'Good morning' :
    hour < 16 ? 'Good afternoon' :
    hour < 22 ? 'Good evening' : 'Still up';
  $$('[data-greeting]').forEach((el) => { el.textContent = greeting; });

  const pick = $('[data-daily-pick]');
  if (pick) {
    const day = new Date().getDay();
    const weekday = new Date().toLocaleDateString('en-IN', { weekday: 'long' });
    const choice = experiences[day % experiences.length];
    pick.innerHTML =
      `Good for a ${weekday}: <a href="/programme/#${choice.id}">${choice.name}</a>.`;
  }
}

/* ---------- page chrome ---------- */
function wireChrome() {
  const head = $('#head');
  const sticky = $('.sticky-cta');
  const onScroll = () => {
    const y = window.scrollY;
    head?.classList.toggle('is-stuck', y > 10);
    sticky?.classList.toggle('is-show', y > window.innerHeight * 0.6);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // the projector throw follows the pointer, slowly
  const beam = $('#beam');
  if (beam && window.matchMedia('(pointer:fine)').matches) {
    window.addEventListener('pointermove', (e) => {
      const x = e.clientX / window.innerWidth;
      beam.style.setProperty('--bx', `${38 + x * 34}%`);
      beam.style.setProperty('--br', `${((x - 0.5) * 9).toFixed(2)}deg`);
    }, { passive: true });
  }

  const targets = $$('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target as HTMLElement;
        const sibs = $$('.reveal', el.parentNode as ParentNode);
        el.style.transitionDelay = `${(Math.max(0, sibs.indexOf(el)) % 4) * 80}ms`;
        el.classList.add('is-in');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -7% 0px', threshold: 0.1 });
    targets.forEach((t) => io.observe(t));
  } else {
    targets.forEach((t) => t.classList.add('is-in'));
  }

  const today = new Date().toISOString().slice(0, 10);
  $$<HTMLInputElement>('input[type=date]').forEach((d) => { if (!d.min) d.min = today; });
}

/* ---------- "Something else" reveals a box to describe it ----------
   Each pair is a select and the field that belongs to it. The field is
   required only while it is showing, so an unused one never blocks a submit. */
function wireOtherFields() {
  ([['#qExperience', '#qCustomField', '#qCustom'],
    ['#pExperience', '#pCustomField', '#pCustom']] as const).forEach(([selectSel, wrapSel, inputSel]) => {
    const select = $<HTMLSelectElement>(selectSel);
    const wrap = $(wrapSel);
    const input = $<HTMLInputElement>(inputSel);
    if (!select || !wrap || !input) return;

    const sync = () => {
      const on = select.value === OTHER.id;
      wrap.hidden = !on;
      if (on) input.setAttribute('data-req', '');
      else { input.removeAttribute('data-req'); input.value = ''; }
    };
    select.addEventListener('change', () => {
      sync();
      if (select.value === OTHER.id) input.focus();
    });
    sync();
  });
}

/* ---------- the deck ----------
   The pointer tilts each card and drags a band of light across it; clicking
   turns it over. All of it is decoration on top of a plain button, so the
   keyboard path is just "focus, press, it flips".                          */
function wireDeck() {
  const cards = $$<HTMLButtonElement>('[data-card]');
  if (!cards.length) return;

  const fine = window.matchMedia('(pointer:fine)').matches;
  const still = window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  cards.forEach((card) => {
    const inner = card.querySelector<HTMLElement>('.card-inner');

    card.addEventListener('click', () => {
      const open = card.getAttribute('aria-expanded') === 'true';
      card.setAttribute('aria-expanded', String(!open));
      // the hidden face must leave the tab order and the screen-reader tree
      card.querySelector('.card-front')?.toggleAttribute('inert', !open);
      card.querySelector('.card-back')?.toggleAttribute('inert', open);
    });

    // the back starts hidden
    card.querySelector('.card-back')?.setAttribute('inert', '');

    if (!fine || still || !inner) return;

    let frame = 0;
    card.addEventListener('pointermove', (e) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        inner.style.setProperty('--ry', `${(x - 0.5) * 13}deg`);
        inner.style.setProperty('--rx', `${(0.5 - y) * 11}deg`);
        card.style.setProperty('--sheen', String(x));
      });
    });
    card.addEventListener('pointerleave', () => {
      inner.style.setProperty('--ry', '0deg');
      inner.style.setProperty('--rx', '0deg');
    });
  });
}

/* ---------- the reel ----------
   A horizontal strip you can drag, flick, or step through with the arrows. */
function wireReel() {
  $$('[data-reel]').forEach((reel) => {
    const track = $<HTMLElement>('[data-reel-track]', reel);
    const prev = $<HTMLButtonElement>('[data-reel-prev]', reel);
    const next = $<HTMLButtonElement>('[data-reel-next]', reel);
    if (!track) return;

    const frameWidth = () => track.querySelector('.reel-frame')?.getBoundingClientRect().width ?? 240;
    const page = () => Math.max(1, Math.floor(track.clientWidth / frameWidth())) * frameWidth();

    const sync = () => {
      const max = track.scrollWidth - track.clientWidth - 2;
      prev?.toggleAttribute('disabled', track.scrollLeft <= 2);
      next?.toggleAttribute('disabled', track.scrollLeft >= max);
    };
    track.addEventListener('scroll', sync, { passive: true });
    sync();

    // The arrows are enabled from the track's scrollable width. Until the
    // photographs have laid out, that width is too small and both arrows end
    // up disabled with nothing to re-enable them, so re-check as the strip
    // grows and whenever the window changes size.
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(() => sync());
      ro.observe(track);
      track.querySelectorAll('img').forEach((img) => ro.observe(img));
    }
    track.querySelectorAll('img').forEach((img) => {
      if (!img.complete) img.addEventListener('load', sync, { once: true });
    });
    window.addEventListener('resize', sync, { passive: true });

    prev?.addEventListener('click', () => track.scrollBy({ left: -page(), behavior: 'smooth' }));
    next?.addEventListener('click', () => track.scrollBy({ left: page(), behavior: 'smooth' }));

    // drag to pull the strip along
    let down = false;
    let startX = 0;
    let startLeft = 0;
    let moved = 0;

    track.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      down = true;
      moved = 0;
      startX = e.clientX;
      startLeft = track.scrollLeft;
      track.classList.add('is-dragging');
    });
    track.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      moved = Math.max(moved, Math.abs(dx));
      track.scrollLeft = startLeft - dx;
    });
    const release = () => {
      if (!down) return;
      down = false;
      track.classList.remove('is-dragging');
      sync();
    };
    track.addEventListener('pointerup', release);
    track.addEventListener('pointercancel', release);
    track.addEventListener('pointerleave', release);

    // a drag should not also open the photograph it finished on
    track.addEventListener('click', (e) => {
      if (moved > 6) { e.preventDefault(); e.stopPropagation(); moved = 0; }
    }, true);

    // arrow keys when the strip itself has focus
    track.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); track.scrollBy({ left: page(), behavior: 'smooth' }); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); track.scrollBy({ left: -page(), behavior: 'smooth' }); }
    });

    /* ---- it runs on its own ----
       The frames are rendered twice, so when the first copy has passed we can
       jump back by exactly one copy and the loop is seamless. It stops while
       you are touching it, reading it, or looking at a photograph full size. */
    const still = window.matchMedia('(prefers-reduced-motion:reduce)');
    const playBtn = $<HTMLButtonElement>('[data-reel-play]', reel);
    const playLabel = $('[data-reel-play-label]', reel);

    let wanted = !still.matches;      // what the visitor asked for
    let held = 0;                     // reasons to hold still right now
    let last = 0;
    const SPEED = 22;                 // pixels a second — a drift, not a ride

    const half = () => track.scrollWidth / 2;

    // scrollLeft is rounded to whole pixels, so a fraction of a pixel per frame
    // would never accumulate. Keep the true position here and write it across.
    let pos = track.scrollLeft;
    track.addEventListener('scroll', () => {
      // if anything else moved the strip, take its word for where we are
      if (Math.abs(track.scrollLeft - pos) > 2) pos = track.scrollLeft;
    }, { passive: true });

    const tick = (now: number) => {
      if (!last) last = now;
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (wanted && !held && !down && document.visibilityState === 'visible') {
        pos += SPEED * dt;
        if (pos >= half()) pos -= half();
        track.scrollLeft = pos;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    const hold = () => { held++; };
    const release2 = () => { held = Math.max(0, held - 1); };
    ['pointerenter', 'focusin'].forEach((ev) => reel.addEventListener(ev, hold));
    ['pointerleave', 'focusout'].forEach((ev) => reel.addEventListener(ev, release2));
    // a photograph open full size should stop the strip behind it
    document.addEventListener('ys:lightbox', (e) => {
      if ((e as CustomEvent).detail) hold(); else release2();
    });

    const paint = () => {
      playBtn?.setAttribute('aria-pressed', String(wanted));
      if (playLabel) playLabel.textContent = wanted ? 'Pause' : 'Play';
    };
    playBtn?.addEventListener('click', () => { wanted = !wanted; paint(); });
    paint();
    still.addEventListener?.('change', (e) => { wanted = !e.matches; paint(); });

    // captions on or off
    const ccBtn = $<HTMLButtonElement>('[data-reel-cc]', reel);
    ccBtn?.addEventListener('click', () => {
      const on = ccBtn.getAttribute('aria-pressed') !== 'true';
      ccBtn.setAttribute('aria-pressed', String(on));
      reel.classList.toggle('cc-off', !on);
    });
  });
}

/* ---------- photographs open at full size ----------
   <dialog> gives us focus handling and Escape for free; this only fills it
   in, opens it, and puts focus back where it was.                        */
function wireLightbox() {
  const box = $<HTMLDialogElement>('#lightbox');
  const img = $<HTMLImageElement>('#lightboxImg');
  const cap = $('#lightboxCap');
  if (!box || !img || !cap || typeof box.showModal !== 'function') return;

  let opener: HTMLElement | null = null;

  document.addEventListener('click', (e) => {
    const trigger = (e.target as HTMLElement).closest<HTMLElement>('[data-lightbox]');
    if (!trigger) return;
    e.preventDefault();
    opener = trigger;
    img.src = trigger.dataset.lightbox ?? '';
    img.alt = trigger.dataset.caption ?? '';
    cap.textContent = trigger.dataset.caption ?? '';
    box.showModal();
    document.dispatchEvent(new CustomEvent('ys:lightbox', { detail: true }));
  });

  box.addEventListener('click', (e) => {
    // clicking the backdrop, or the close button, shuts it
    if ((e.target as HTMLElement).closest('[data-lightbox-close]') || e.target === box) box.close();
  });
  box.addEventListener('close', () => {
    document.dispatchEvent(new CustomEvent('ys:lightbox', { detail: false }));
    img.removeAttribute('src');      // not src = '', which re-requests the page
    img.alt = '';
    opener?.focus();
    opener = null;
  });
}

/* ---------- mobile menu ---------- */
function wireMenu() {
  const menu = $('#menu');
  const open = $('#menuOpen');
  const close = $('#menuClose');
  if (!menu || !open) return;

  const show = (on: boolean) => {
    menu.hidden = !on;
    open.setAttribute('aria-expanded', String(on));
    document.body.classList.toggle('is-locked', on);
    if (on) $('.menu-links a', menu)?.focus();
    else open.focus();
  };
  open.addEventListener('click', () => show(true));
  close?.addEventListener('click', () => show(false));
  $$('.menu-links a', menu).forEach((a) => a.addEventListener('click', () => show(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) show(false);
  });
  (window as any).__ysCloseMenu = () => { if (!menu.hidden) show(false); };
}

/* ---------- the standalone forms (pre-book, contact, callback) ----------
   One validator serves them all: fields declare data-req / data-phone.   */
function wireForms() {
  $$<HTMLFormElement>('form[data-form]').forEach((form) => {
    const note = $('.form-note', form);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data: Record<string, string> = {};
      let problem = '';

      $$<HTMLInputElement>('[name]', form).forEach((f) => {
        const val = (f.value || '').trim();
        const label = f.getAttribute('data-label') || f.name;
        data[f.name] = val;
        if (problem) return;
        if (f.hasAttribute('data-req') && !val) problem = `Please add ${label}.`;
        else if (f.hasAttribute('data-phone') && !/^[6-9]\d{9}$/.test(val.replace(/\D/g, '').slice(-10)))
          problem = 'Enter a valid 10-digit mobile number.';
        else if (f.type === 'email' && val && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val))
          problem = 'That email address does not look right.';
      });

      if (problem) {
        if (note) { note.className = 'form-note is-err'; note.textContent = problem; }
        return;
      }

      const kind = form.getAttribute('data-form') ?? 'enquiry';
      stash({ at: new Date().toISOString(), source: kind, data });

      const who = (data.name || '').split(' ')[0];
      if (note) {
        note.className = 'form-note is-ok';
        note.textContent = kind === 'contact'
          ? `Thanks ${who} — message noted. We'll get back to you on ${data.phone || 'your number'}.`
          : `Thanks ${who} — you're on the list. We'll call you on ${data.phone || 'your number'} to confirm. Nothing has been charged.`;
      }
      form.reset();
      $$<HTMLInputElement>('[name=guests]', form).forEach((g) => { g.value = '2'; });

      const lines = Object.keys(data).filter((k) => data[k])
        .map((k) => `${k[0].toUpperCase()}${k.slice(1)}: ${data[k]}`);
      const msg = `YourSpace — ${kind}\n${lines.join('\n')}`;

      if (site.googleForm) window.open(site.googleForm, '_blank', 'noopener');
      else if (phoneIsSet) window.open(waLink(msg), '_blank', 'noopener');
    });
  });
}

/* ---------- boot ---------- */
function boot() {
  wireLive();
  wireContact();
  wireChrome();
  wireMenu();
  wireDeck();
  wireReel();
  wireLightbox();
  wireOtherFields();
  wireForms();
  mountBooking();

  document.addEventListener('click', (e) => {
    const trigger = (e.target as HTMLElement).closest('[data-book]');
    if (!trigger) return;
    e.preventDefault();
    const decorId = trigger.getAttribute('data-decor');
    if (decorId) {
      const decor = decorations.find((d) => d.id === decorId);
      if (decor) prefillDecor(decor.name);
    }
    openBooking(trigger.getAttribute('data-exp') ?? '');
  });

  // the hero ticket carries its choices straight into the flow
  $<HTMLFormElement>('#quickStart')?.addEventListener('submit', (e) => {
    e.preventDefault();
    prefillBooking({
      exp: $<HTMLSelectElement>('#qExperience')?.value,
      custom: $<HTMLInputElement>('#qCustom')?.value,
      date: $<HTMLInputElement>('#qDate')?.value,
      guests: Number($<HTMLInputElement>('#qGuests')?.value),
    });
    openBooking();
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
