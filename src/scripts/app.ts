import { $, $$, stash } from './dom';
import { site, phoneIsSet, phoneAltIsSet, prettyPhone, prettyPhoneAlt, waLink } from '../data/site';
import { mountBooking, openBooking, prefillBooking } from './booking';
import { experiences, OTHER } from '../data/booking';

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
  wireOtherFields();
  wireForms();
  mountBooking();

  document.addEventListener('click', (e) => {
    const trigger = (e.target as HTMLElement).closest('[data-book]');
    if (!trigger) return;
    e.preventDefault();
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
