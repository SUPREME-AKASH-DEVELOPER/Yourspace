import qrcode from 'qrcode-generator';
import { $, $$, rupee, esc, dateLabel, nextDays, stash, venueNow, venueToday, isIsoDate } from './dom';
import { site, phoneNumbers, whatsappLink, whatsappIsSet } from '../data/site';
import { deliver, envelope } from './deliver';
import {
  experiences, slots, setups, addonGroups, stepNames, OTHER,
  MAX_GUESTS, SEATING, SEAT_IDS, seatKind, cleanSeats, defaultSeats, seatsLabel,
  setupOf, setupPrice, addonOf, quote, addMinutes,
  type Setup, type Quote,
} from '../data/booking';
import { decorations, DECOR_INCLUDED } from '../data/decorations';

/** The same WhatsApp mark as WhatsApp.astro, for the hand-off on the confirmation screen. */
const WA_ICON = '<svg class="wa-i" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2.2a9.8 9.8 0 0 0-8.4 14.9L2.2 21.8l4.8-1.3A9.8 9.8 0 1 0 12 2.2Zm0 17.8a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1 1 12 20Zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8 1c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.1 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.6.3 2.7 2.7 0 0 0-.9 2c0 1.2.9 2.4 1 2.5.1.2 1.7 2.6 4.2 3.7 1.6.7 2.2.7 3 .6.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1l-.5-.5Z"/></svg>';

/* Line-art marks for the occasion tiles — drawn, not emoji. */
const ICON: Record<string, string> = {
  heart:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9Z"/></svg>',
  screen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="12" rx="1.5"/><path d="M10 9.2v4.6l4-2.3-4-2.3Z" fill="currentColor" stroke="none"/><path d="M8 20h8"/></svg>',
  mic:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="9" y="3" width="6" height="10" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6"/></svg>',
  ring:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="15" r="5.2"/><path d="m9.4 6.6 2.6-3 2.6 3-2.6 2.8-2.6-2.8Z"/></svg>',
  flame:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3c2.6 3 4 5.1 4 7a4 4 0 0 1-8 0c0-1.9 1.4-4 4-7Z"/><path d="M12 14v7M9 21h6"/></svg>',
  stage:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="9" y="3" width="6" height="3" rx="1"/><path d="M12 6 5 20h14L12 6Z"/></svg>',
  other:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 20.5 5 16l9.8-9.8a2 2 0 0 1 2.8 0l1.2 1.2a2 2 0 0 1 0 2.8L9 20l-5 .5Z"/><path d="M13 7.5 16.5 11"/></svg>',
};

type Pay = '' | 'upi' | 'later';
type Send = '' | 'sending' | 'sent' | 'failed';

interface State {
  step: number; exp: string; date: string;
  /**
   * The seat numbers they picked — 1–5 recliners, 6–7 bean bags. This is the
   * truth about who is coming; `guests` is only ever `seats.length`, kept
   * alongside it because the prices are worked out per head. Change seats
   * through setSeats() and the two can never drift apart.
   */
  seats: number[];
  guests: number;
  slot: string; setup: string; decor: string; addons: string[];
  name: string; phone: string; email: string; notes: string;
  /** Filled in when the occasion is "Something else". */
  customOccasion: string;
  pay: Pay;
  /** Made once, when the booking is sent, and printed on everything after. */
  ref: string;
  /** Where the booking email got to. A sent booking is never sent again. */
  send: Send;
  /** The UPI reference they give us. We pass it on; we never call it paid. */
  utr: string;
  utrSend: Send;
}
const BLANK: State = {
  step: 0, exp: '', date: '', seats: [1, 2], guests: 2, slot: '', setup: '', decor: '', addons: [],
  name: '', phone: '', email: '', notes: '', customOccasion: '',
  pay: '', ref: '', send: '', utr: '', utrSend: '',
};

const KEY = 'ys-booking-v3';
const DONE = 6;
let S: State = structuredClone(BLANK);
let root: HTMLElement | null = null;
let mode: 'modal' | 'inline' = 'modal';
let lastFocus: HTMLElement | null = null;
let resumed = false;
/** Guards against a double tap sending the same thing twice. */
let busy = false;
/** The pay panel has been on screen long enough to take a tap. */
let armed = false;

/**
 * The only way seats are set. It tidies the list and keeps `guests` in step,
 * so no caller can leave the head count saying one thing and the seat map
 * another. Returns true if anything changed.
 */
function setSeats(seats: number[]): boolean {
  const next = cleanSeats(seats);
  const same = next.length === S.seats.length && next.every((n, i) => n === S.seats[i]);
  // both are written every time, even when the seats themselves did not move:
  // a head count left over from somewhere else must never survive this call
  S.seats = next;
  S.guests = next.length;
  return !same;
}

const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };
const clearSaved = () => { try { localStorage.removeItem(KEY); } catch {} };
const today = venueToday;
/** Set when something they asked for could not be done as asked, and said once on the next screen. */
let notice = '';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const o = JSON.parse(raw) as Partial<State>;
    if (!o || typeof o !== 'object') return;
    (Object.keys(BLANK) as (keyof State)[]).forEach((k) => {
      if (o[k] !== undefined && o[k] !== null && typeof o[k] === typeof BLANK[k]) (S as any)[k] = o[k];
    });
    // Saved progress lives in the visitor's browser and can be edited there, so
    // nothing is trusted: every value must be one this flow could have made.
    if (!Array.isArray(S.addons)) S.addons = [];
    S.addons = S.addons.filter((a) => typeof a === 'string' && addonOf(a) !== null);
    if (S.date && !isIsoDate(S.date)) S.date = '';
    if (S.slot && !slots.some((x) => x.id === S.slot)) S.slot = '';
    if (S.setup && !setupOf(S.setup)) S.setup = '';
    if (S.decor && !decorations.some((d) => d.id === S.decor)) S.decor = '';
    if (S.exp && S.exp !== OTHER.id && !experiences.some((e) => e.id === S.exp)) S.exp = '';
    if (!(['', 'upi', 'later'] as string[]).includes(S.pay)) S.pay = '';
    if (!(['', 'sending', 'sent', 'failed'] as string[]).includes(S.send)) S.send = '';
    if (!(['', 'sending', 'sent', 'failed'] as string[]).includes(S.utrSend)) S.utrSend = '';
    if (S.ref && !/^YS-[A-Z0-9]{6}$/.test(S.ref)) S.ref = '';
    S.utr = S.utr.replace(/\D/g, '').slice(0, 12);
    if (S.date && S.date < today()) {
      // a finished booking for a day that has gone is of no use to anyone
      if (S.step === DONE) { S = structuredClone(BLANK); clearSaved(); return; }
      S.date = ''; S.slot = '';
    }
    S.step = Math.min(Math.max(0, S.step | 0), DONE);
    // a confirmation screen without a sent booking behind it is not real
    if (S.step === DONE && !S.ref) S.step = 5;
    // the page went away mid-send: we cannot know if it arrived, so offer a resend
    if (S.send === 'sending') S.send = 'failed';
    if (S.utrSend === 'sending') S.utrSend = 'failed';
    // Seats are the truth. A saved list from this browser is checked seat by
    // seat; progress saved before seats existed leaves only a head count, so
    // the seats are worked out from that. Either way one seat is the minimum.
    const saved = cleanSeats((o as { seats?: unknown }).seats);
    setSeats(saved.length ? saved : defaultSeats(Math.min(MAX_GUESTS, Math.max(1, S.guests | 0 || 2))));
    if (!S.seats.length) setSeats([1]);
    resumed = Boolean(S.exp || S.setup || S.date);
    save();   // write the cleaned state back, so what is stored is always valid
  } catch {}
}

/* ---------- what has been chosen ---------- */

/** What to call the occasion: their own words when they gave us some. */
function occasionLabel(): string {
  if (S.exp === OTHER.id) return S.customOccasion.trim() || OTHER.name;
  return expOf()?.name ?? '—';
}

const expOf = () => experiences.find((e) => e.id === S.exp) ?? null;
const slotOf = () => slots.find((s) => s.id === S.slot) ?? null;
const decorOf = () => decorations.find((d) => d.id === S.decor) ?? null;

/** "6:00 PM – 7:30 PM", or 30 minutes from the start for karaoke. */
function timeLabel(): string {
  const sl = slotOf();
  if (!sl) return '';
  const mins = setupOf(S.setup)?.minutes;
  const end = mins && mins !== 90 ? addMinutes(sl.start, mins) : sl.end;
  return `${sl.start} – ${end}`;
}

function totals(): Quote {
  const d = decorOf();
  return quote({
    setup: S.setup,
    guests: S.guests,
    decor: d ? { name: d.name, price: d.price } : null,
    addons: S.addons,
  });
}

/** Online payment is only offered when every line has a real price. */
const canPayOnline = (q: Quote) =>
  Boolean(site.upiId) && !q.blocked && q.unpriced.length === 0 && q.total > 0;

/** A slot that has already started today cannot be booked. */
function slotPassed(start: string): boolean {
  if (S.date !== today()) return false;
  const m = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(start);
  if (!m) return false;
  const mins = ((Number(m[1]) % 12) + (m[3] === 'PM' ? 12 : 0)) * 60 + Number(m[2]);
  return mins <= venueNow().minutes;
}

const totalText = (q: Quote) => q.unpriced.length ? `${rupee(q.total)} + on call` : rupee(q.total);

const tel = () => phoneNumbers[0];
const callLink = () => tel()
  ? `<a href="tel:${tel()!.raw}">${esc(tel()!.pretty)}</a>`
  : 'the number on our contact page';

/* ---------- the panel ---------- */

const PANEL = `
  <div class="bk-scrim" data-bk-close></div>
  <div class="bk-panel" role="dialog" aria-modal="true" aria-labelledby="bkTitle">
    <div class="bk-head">
      <div class="bk-head-top">
        <div class="bk-steps" id="bkSteps"></div>
        <button class="bk-x" type="button" data-bk-close aria-label="Close booking">&times;</button>
      </div>
    </div>
    <div class="bk-rail"><i id="bkBar"></i></div>
    <div class="bk-body" id="bkBody" tabindex="-1"></div>
    <div class="bk-foot" id="bkFoot">
      <button class="btn btn-line" type="button" data-bk-back>Back</button>
      <p class="bk-total" id="bkTotal" aria-live="polite"></p>
      <button class="btn btn-key" type="button" data-bk-next>Continue<span aria-hidden="true">→</span></button>
    </div>
  </div>`;

export function mountBooking() {
  load();
  const inline = $('#bookMount');
  if (inline) {
    root = inline;
    mode = 'inline';
    root.className = 'bk bk-inline';
    root.innerHTML = PANEL;
    const p = $('.bk-panel', root)!;
    p.removeAttribute('role'); p.removeAttribute('aria-modal');
    $$('[data-bk-close]', root).forEach((el) => el.remove());
    const q = new URLSearchParams(location.search).get('exp');
    const hit = experiences.find((e) => e.id === q || e.name.toLowerCase() === (q ?? '').toLowerCase());
    if (hit && S.step !== DONE) { S.exp = hit.id; if (S.step < 1) S.step = 1; save(); }
    bindPanel();
    render();
    return;
  }
  root = document.createElement('div');
  root.className = 'bk';
  root.id = 'bk';
  root.hidden = true;
  root.innerHTML = PANEL;
  document.body.appendChild(root);
  mode = 'modal';
  bindPanel();
}

function bindPanel() {
  root!.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-bk-close]')) return closeBooking();
    if (t.closest('[data-bk-back]')) return go(S.step - 1);
    if (t.closest('[data-bk-next]')) return onNext();
    onBodyClick(e);
  });
  root!.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name === 'bkPay') { S.pay = t.value as Pay; save(); updateNext(); }
  });
  if (mode === 'modal') {
    document.addEventListener('keydown', (e) => {
      if (root!.hidden) return;
      if (e.key === 'Escape') closeBooking();
      if (e.key === 'Tab') trap(e);
    });
  }
}

function trap(e: KeyboardEvent) {
  const f = $$<HTMLElement>('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])', root!)
    .filter((el) => el.offsetParent !== null && !(el as HTMLButtonElement).disabled);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

/** "Book this setup" on a decoration card: Date Night, with that decoration. */
export function prefillDecor(id: string) {
  if (S.step === DONE) return;
  if (!decorations.some((d) => d.id === id)) return;
  S.setup = 'date';
  S.decor = id;
  save();
}

/** Used by the hero ticket: carry what they already chose into the flow. */
export function prefillBooking(opts: { exp?: string; custom?: string; date?: string; guests?: number }) {
  if (S.step === DONE) resetState();
  const hit = experiences.find((e) => e.name.toLowerCase() === (opts.exp ?? '').toLowerCase());
  const isOther = opts.exp === OTHER.id;
  if (hit) S.exp = hit.id;
  if (isOther) {
    S.exp = OTHER.id;
    S.customOccasion = (opts.custom ?? '').trim();
  }
  if (opts.date && opts.date >= today()) S.date = opts.date;
  if (opts.guests && opts.guests > 0) {
    setSeats(defaultSeats(Math.min(MAX_GUESTS, Math.max(1, Math.floor(opts.guests)))));
    if (opts.guests > MAX_GUESTS) {
      notice = `You asked for ${Math.floor(opts.guests)} guests. Online bookings are for up to ${MAX_GUESTS}, so we have set ${MAX_GUESTS} — for a bigger group, call us on ${tel()?.pretty ?? 'the number on our contact page'}.`;
    }
  }
  // with a described occasion we can move on; without one, stay and ask
  const chosen = hit || (isOther && S.customOccasion);
  S.step = chosen ? (S.date ? 2 : 1) : 0;
  save();
}

export function openBooking(expName = '') {
  if (!root) mountBooking();
  const hit = experiences.find((e) => e.id === expName || e.name.toLowerCase() === expName.toLowerCase());
  if (hit && S.step !== DONE) { S.exp = hit.id; if (S.step < 1) S.step = 1; save(); }
  if (mode === 'inline') {
    render();
    window.scrollTo({ top: root!.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
    return;
  }
  (window as any).__ysCloseMenu?.();
  lastFocus = document.activeElement as HTMLElement;
  root!.hidden = false;
  document.body.classList.add('is-locked');
  setBackgroundInert(true);
  render();
  $<HTMLElement>('.bk-body', root!)?.focus({ preventScroll: true });
}

/** Hide everything behind the dialog from assistive tech and tab order. */
function setBackgroundInert(on: boolean) {
  if (mode !== 'modal') return;
  ['.masthead', '#main', '.colophon', '.sticky-cta'].forEach((sel) => {
    const el = $(sel);
    if (!el) return;
    if (on) el.setAttribute('inert', '');
    else el.removeAttribute('inert');
  });
}

function closeBooking() {
  if (!root || mode === 'inline') return;
  root.hidden = true;
  setBackgroundInert(false);
  // keep a booking that is still waiting on a UPI payment, so it can be reopened
  if (S.step === DONE && !(S.pay === 'upi' && S.utrSend !== 'sent')) resetState();
  document.body.classList.remove('is-locked');
  save();
  lastFocus?.focus();
}

function go(n: number) {
  const dir = n >= S.step ? 1 : -1;
  // step 5 (add-ons) only exists for setups that have any
  if (n === 4 && !setupOf(S.setup)?.hasAddons) n += dir;
  S.step = Math.max(0, Math.min(DONE, n));
  save();
  render();
  const body = $('#bkBody');
  if (!body) return;
  if (mode === 'modal') body.scrollTop = 0;
  else window.scrollTo({ top: root!.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
  body.focus({ preventScroll: true });
}

function onNext() {
  const err = validate(S.step);
  if (err) return flash(err);
  if (S.step === 5) return submit();
  go(S.step + 1);
}

function validate(step: number): string {
  if (step === 0 && !S.exp) return 'Pick an occasion to continue.';
  if (step === 0 && S.exp === OTHER.id && !S.customOccasion.trim())
    return 'Tell us what you are planning, in a line or two.';
  if (step === 1 && !S.date) return 'Choose a date to continue.';
  if (step === 1 && S.date < today()) return 'That date has passed. Please pick another.';
  if (step === 1 && (S.guests < 1 || S.guests > MAX_GUESTS)) return `Choose between 1 and ${MAX_GUESTS} guests.`;
  if (step === 2 && !S.slot) return 'Pick a time to continue.';
  if (step === 2 && slotOf() && slotPassed(slotOf()!.start)) return 'That time has already started today. Pick a later one.';
  if (step === 3) {
    if (!S.setup) return 'Choose a setup to continue.';
    const blocked = setupPrice(S.setup, S.guests).blocked;
    if (blocked) return blocked;
    if (setupOf(S.setup)?.hasDecor && !decorOf()) return 'Pick a decoration to continue.';
  }
  if (step === 5) {
    if (!S.name.trim()) return 'Please add your name.';
    if (!/^[6-9]\d{9}$/.test(S.phone.replace(/\D/g, '').slice(-10))) return 'Enter a valid 10-digit mobile number.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(S.email.trim())) return 'Please add an email we can send your confirmation to.';
    if (canPayOnline(totals()) && !S.pay) return 'Choose how you would like to pay.';
  }
  return '';
}

function flash(msg: string) {
  const foot = $('#bkFoot')!;
  $('.bk-flash', foot)?.remove();
  const p = document.createElement('p');
  p.className = 'bk-flash';
  p.setAttribute('role', 'alert');
  p.textContent = msg;
  foot.insertBefore(p, foot.firstChild);
  setTimeout(() => p.remove(), 5200);
}

/* ---------- render ---------- */

function updateNext() {
  const next = $('[data-bk-next]', root!);
  if (!next) return;
  const q = totals();
  const label = S.step < 5 ? 'Continue'
    : S.pay === 'upi' && canPayOnline(q) ? `Send & pay ${rupee(q.total)}`
    : 'Send booking request';
  next.innerHTML = `${label}<span aria-hidden="true">→</span>`;
}

function render() {
  if (S.step === DONE) return renderDone();
  const q = totals();

  $('#bkSteps')!.innerHTML = stepNames.map((n, i) => {
    const skipped = i === 4 && S.setup && !setupOf(S.setup)?.hasAddons;
    const cls = i === S.step ? 'is-now' : i < S.step ? 'is-done' : '';
    return `<span class="bk-step ${cls}${skipped ? ' is-skip' : ''}">${String(i + 1).padStart(2, '0')} ${n}</span>`;
  }).join('');
  ($('#bkBar') as HTMLElement).style.width = `${((S.step + 1) / 6) * 100}%`;

  ($('#bkFoot') as HTMLElement).style.display = '';
  ($('[data-bk-back]') as HTMLElement).style.visibility = S.step === 0 ? 'hidden' : 'visible';
  updateNext();

  const bits = [occasionLabel(), S.date && dateLabel(S.date), slotOf()?.start,
                `${S.guests} ${S.guests === 1 ? 'guest' : 'guests'}`].filter(Boolean);
  const amount = S.setup && !q.blocked ? totalText(q) : '—';
  $('#bkTotal')!.innerHTML = `<strong>${amount}</strong><span>${esc(bits.join(' · '))}</span>`;

  $('#bkBody')!.innerHTML = [step0, step1, step2, step3, step4, step5][S.step](q);
  wireFields();
}

const head = (n: number, title: string, sub?: string) =>
  `<p class="bk-kicker">Step ${String(n).padStart(2, '0')} of 06</p><h2 class="title" id="bkTitle">${title}</h2>` +
  (sub ? `<p class="bk-sub">${sub}</p>` : '');

/** A photograph from BookingMedia.astro, or nothing if there is none for this key. */
function photo(key?: string): string {
  if (!key) return '';
  const tpl = document.getElementById('bkMedia') as HTMLTemplateElement | null;
  const img = tpl?.content.querySelector(`[data-media="${CSS.escape(key)}"]`);
  if (!img) return '';
  // a stand-in picture (AI-generated or stock) is labelled as one, so nobody books
  // expecting exactly what they saw
  return img.hasAttribute('data-sample')
    ? img.outerHTML + '<span class="vis-sample">Sample image</span>'
    : img.outerHTML;
}

/** The picture at the top of a card: a photograph when we have one, drawn otherwise. */
const visual = (key: string | undefined, art: string, tone: string) =>
  photo(key) || `<span class="vis-art vis-${tone}" aria-hidden="true"><span class="art art-${art}"></span></span>`;

function step0() {
  const isOther = S.exp === OTHER.id;
  return head(1, 'What are you celebrating?',
    'Same private room, set up to match the occasion. You can change this later.') +
    `<div class="bk-grid">${experiences.map((e) => `
      <button class="tile ${S.exp === e.id ? 'is-sel' : ''}" type="button" data-exp-pick="${e.id}">
        <span class="tile-ico" aria-hidden="true">${ICON[e.art]}</span>
        <strong>${e.name}</strong><em>${e.note}</em>
      </button>`).join('')}
      <button class="tile tile-other ${isOther ? 'is-sel' : ''}" type="button"
              data-exp-pick="${OTHER.id}" aria-expanded="${isOther}" aria-controls="bkOther">
        <span class="tile-ico" aria-hidden="true">${ICON.other}</span>
        <strong>${OTHER.name}</strong><em>${OTHER.note}</em>
      </button>
    </div>` +
    (isOther ? `
      <div class="other-box" id="bkOther">
        <label class="field" for="bkCustom">
          <span>${OTHER.prompt}</span>
          <textarea id="bkCustom" rows="3" maxlength="400"
                    placeholder="${esc(OTHER.placeholder)}">${esc(S.customOccasion)}</textarea>
        </label>
        <p class="fine">We read this before we call you, and set the room up around it.
          Anything we cannot do, we will say so plainly.</p>
      </div>` : '') +
    (resumed ? `<p class="fine">Picked up where you left off. <button type="button" data-bk-reset class="linkish">Start over</button></p>` : '');
}

/* The seat picker: you choose the seats themselves, not a number in a box.
   It is drawn as the room is — two bean bags in front, nearer the screen, and
   five recliners behind them. Recliners are square, bean bags round.

   Each seat is its own toggle: tapping one takes that seat and nothing else.
   (It used to fill every seat up to the one you tapped, so tapping a bean bag
   looked like it had taken all five recliners too — Tanishk flagged it, and
   this is the fix.) The seats chosen are what the summary and the email say,
   so a couple who want the bean bags get the bean bags. */

/** The seat just turned on, so only that one plays the pop animation. */
let seatJustOn: number | null = null;

function seatButton(n: number) {
  const kind = seatKind(n);
  const nth = kind === 'recliner' ? n : n - SEATING.recliners;
  const name = kind === 'recliner' ? `Recliner ${nth}` : `Bean bag ${nth}`;
  const row = kind === 'recliner' ? 'back row' : 'front row';
  const on = S.seats.includes(n);
  return `<button type="button" class="seat seat-${kind}${on ? ' is-taken' : ''}${seatJustOn === n ? ' is-new' : ''}"
    data-seat="${n}" data-kind="${kind}" aria-pressed="${on}"
    aria-label="${name}, ${row}${on ? ' — taken, tap to give it back' : ''}"
    title="${name} · ${row}"><span class="seat-tag" aria-hidden="true">${nth}</span></button>`;
}

function seatmap() {
  const beanBags = SEAT_IDS.filter((n) => seatKind(n) === 'beanbag').map(seatButton).join('');
  const recliners = SEAT_IDS.filter((n) => seatKind(n) === 'recliner').map(seatButton).join('');
  const picked = (k: 'recliner' | 'beanbag') => S.seats.filter((n) => seatKind(n) === k).length;
  const r = picked('recliner');
  const b = picked('beanbag');

  return `<div class="seatmap">
    <div class="seat-screen"><span aria-hidden="true"></span><em>Screen</em></div>
    <div class="seat-rows">
      <div class="seat-row seat-row-front"><i>Front</i><span class="seat-group">${beanBags}</span></div>
      <div class="seat-row seat-row-back"><i>Back</i><span class="seat-group">${recliners}</span></div>
    </div>
    <p class="seat-kinds">
      <span><b class="sk-recliner" aria-hidden="true"></b>${SEATING.recliners} Recliners</span>
      <span><b class="sk-beanbag" aria-hidden="true"></b>${SEATING.beanBags} Bean Bags</span>
      <span class="sk-total">Total Capacity: ${MAX_GUESTS} People</span>
    </p>
    <p class="seat-tally" role="status" aria-live="polite">
      <b class="num">${S.guests}</b> ${S.guests === 1 ? 'guest' : 'guests'}
      <em>${r} of ${SEATING.recliners} recliners${b ? ` · ${b} of ${SEATING.beanBags} bean bags` : ''}</em>
    </p>
    <p class="seat-legend">
      <span><b class="k"></b>Yours</span>
      <span><b></b>Free</span>
      <span class="seat-legend-hint">Tap a seat to take it or give it back</span>
    </p></div>`;
}

function step1() {
  const said = notice;
  notice = '';
  return head(2, "When's the night, and who's coming?",
    `Pick the seats you want — one tap each, up to ${MAX_GUESTS}. ${SEATING.recliners} recliners at the back, ${SEATING.beanBags} bean bags in front. The price for your group shows when you choose a setup.`) +
    (said ? `<div class="bk-note" role="status" style="margin-bottom:22px"><i>Note</i><span>${esc(said)}</span></div>` : '') +
    seatmap() +
    '<p class="bk-kicker">Pick a date</p>' +
    `<div class="bk-dates">${nextDays(21).map((d) => `
      <button class="daytile ${S.date === d.iso ? 'is-sel' : ''}" type="button" data-date-pick="${d.iso}">
        <em>${d.dow}</em><strong>${d.day}</strong><em>${d.mon}</em>
      </button>`).join('')}</div>` +
    `<p class="fine">More than ${MAX_GUESTS} of you, or looking further ahead? Call us on ${callLink()}.</p>`;
}

function step2() {
  return head(3, 'Choose your time',
    `${dateLabel(S.date)} · ${S.guests} ${S.guests === 1 ? 'guest' : 'guests'} · sessions are 90 minutes. Karaoke runs 30 minutes from the start of the slot.`) +
    `<div class="slots">${slots.map((s) => {
      const gone = slotPassed(s.start);
      return `
      <button class="slot ${S.slot === s.id ? 'is-sel' : ''}" type="button" data-slot-pick="${s.id}"${gone ? ' disabled' : ''}>
        <strong>${s.start}</strong><span>${gone ? 'Already started' : `to ${s.end}`}</span>
      </button>`;
    }).join('')}</div>` +
    `<div class="bk-note" style="margin-top:22px"><i>Note</i><span>We check the slot is free as soon as your booking reaches us, and call you if it is not. You are never charged for a slot we cannot give you.</span></div>`;
}

const TONE: Record<string, string> = { date: 'rose', movie: 'night', karaoke: 'neon', watch: 'pitch' };

function setupCard(s: Setup) {
  const p = setupPrice(s.id, S.guests);
  const sel = S.setup === s.id;
  const suggested = expOf()?.suggests === s.id;
  const dur = s.minutes ? `${s.minutes} min` : 'Duration on call';
  const price = p.amount !== null
    ? `<span class="sc-price num">${rupee(p.amount)}</span>`
    : `<span class="sc-price sc-price-ask">${p.blocked ? 'Call to book' : 'Price on call'}</span>`;
  return `
    <button class="sc sc-${TONE[s.id]} ${sel ? 'is-sel' : ''} ${p.blocked ? 'is-blocked' : ''}" type="button"
            data-setup-pick="${s.id}" aria-pressed="${sel}"${p.blocked ? ' aria-describedby="sc-why-' + s.id + '"' : ''}>
      <span class="sc-media">${visual(s.photo ?? `setup-${s.id}`, s.art, TONE[s.id])}
        <span class="sc-chip num">${dur}</span>
        ${suggested ? '<span class="sc-chip sc-chip-hint">Suggested</span>' : ''}
      </span>
      <span class="sc-body">
        <strong class="sc-name">${s.name}</strong>
        <span class="sc-tag">${s.tagline}</span>
        <span class="sc-pricing">${price}${p.note ? `<span class="sc-per">${esc(p.note)}</span>` : ''}</span>
        <span class="sc-list">${s.includes.map((i) => `<span>${esc(i)}</span>`).join('')}</span>
        ${p.blocked ? `<span class="sc-why" id="sc-why-${s.id}">${esc(p.blocked)}</span>` : ''}
        ${s.idealFor && S.guests > s.idealFor && !p.blocked ? `<span class="sc-hint">Set up for ${s.idealFor}. Bigger groups are welcome — we will arrange the room on the call.</span>` : ''}
      </span>
    </button>`;
}

function decorStep() {
  return `
    <div class="decor-pick" id="bkDecor">
      <p class="bk-kicker">Now choose your decoration</p>
      <p class="decor-incl"><b>In every package</b>${DECOR_INCLUDED.map((x) => `<span>${esc(x)}</span>`).join('')}</p>
      <div class="dc-grid">${decorations.map((d) => {
        const sel = S.decor === d.id;
        return `
        <button class="dc ${sel ? 'is-sel' : ''}" type="button" data-decor-pick="${d.id}" aria-pressed="${sel}">
          <span class="dc-media">${visual(`decor-${d.id}`, 'heart', 'rose')}
            <span class="dc-price num">${d.price !== null ? `+${rupee(d.price)}` : 'Price on call'}</span>
          </span>
          <span class="dc-body">
            <strong>${esc(d.name)}</strong>
            <span class="dc-tag">${esc(d.tagline)}</span>
            <span class="dc-blurb">${esc(d.blurb)}</span>
            <span class="dc-list">${d.includes.map((i) => `<span${DECOR_INCLUDED.includes(i) ? ' class="is-incl"' : ''}>${esc(i)}</span>`).join('')}</span>
          </span>
        </button>`;
      }).join('')}</div>
      <p class="fine">Decoration is added to the ${rupee(setupPrice('date', S.guests).amount ?? 0)} session. Prices are confirmed with you before anything is charged.</p>
    </div>`;
}

function step3() {
  const s = setupOf(S.setup);
  return head(4, 'Choose your setup',
    `Priced for ${S.guests} ${S.guests === 1 ? 'guest' : 'guests'}. Change the number of guests on step 2.`) +
    `<div class="sc-grid">${setups.map(setupCard).join('')}</div>` +
    (s?.hasDecor && !setupPrice(s.id, S.guests).blocked ? decorStep() : '') +
    `<p class="fine">Something you cannot book here? Call us on ${callLink()}.</p>`;
}

function step4(q: Quote) {
  return head(5, 'Make it yours',
    'Optional — add only what you want. Fog entry and candlelight are already in your decoration.') +
    addonGroups.map((g) => `
      <div class="ad-group">
        <h3>${esc(g.name)}<span>${esc(g.blurb)}</span></h3>
        <div class="ad-grid">${g.options.map((o) => {
          const sel = S.addons.includes(o.id);
          const price = o.price !== null ? rupee(o.price) : (o.priceNote ? `${o.priceNote}, confirmed on call` : 'Price on call');
          return `
          <button class="ad ${sel ? 'is-sel' : ''}" type="button" data-addon-pick="${o.id}" aria-pressed="${sel}">
            <span class="ad-media">${visual(o.photo ?? `addon-${o.id}`, g.art, 'rose')}</span>
            <span class="ad-body"><strong>${esc(o.name)}</strong><span class="ad-price">${esc(price)}</span></span>
          </button>`;
        }).join('')}</div>
        ${g.callFor ? `<p class="fine">${esc(g.callFor)} Call ${callLink()}.</p>` : ''}
      </div>`).join('') +
    summary(q) +
    '<p class="fine">One of each at most. Tap a choice again to remove it.</p>';
}

function step5(q: Quote) {
  const online = canPayOnline(q);
  if (!online && S.pay === 'upi') S.pay = 'later';
  const payBlock = online ? `
    <fieldset class="paypick">
      <legend>How would you like to pay?</legend>
      <label class="payopt ${S.pay === 'upi' ? 'is-sel' : ''}">
        <input type="radio" name="bkPay" value="upi"${S.pay === 'upi' ? ' checked' : ''}>
        <span><strong>Pay now by UPI · ${rupee(q.total)}</strong>
        <em>Any UPI app. We show you a QR code and a pay link as soon as this is sent.</em></span>
      </label>
      <label class="payopt ${S.pay === 'later' ? 'is-sel' : ''}">
        <input type="radio" name="bkPay" value="later"${S.pay === 'later' ? ' checked' : ''}>
        <span><strong>Pay after we call</strong>
        <em>We confirm the slot first, then send you the payment details.</em></span>
      </label>
    </fieldset>`
    : `<div class="bk-note"><i>Payment</i><span>${q.unpriced.length
        ? `<b>${esc(q.unpriced.join(', '))}</b> ${q.unpriced.length > 1 ? 'are' : 'is'} priced on the call, so we will send you the exact amount and how to pay once we have spoken.`
        : 'We will send you the payment details once we have confirmed your slot.'}</span></div>`;

  return head(6, 'Your details, then payment',
    'We send your booking straight to the team, and a copy to you.') +
    `<div class="bookform" style="margin-bottom:24px">
      <div class="field"><label for="bName">Your name</label>
        <input id="bName" type="text" autocomplete="name" placeholder="Who should we ask for?" value="${esc(S.name)}"></div>
      <div class="field"><label for="bPhone">Phone number</label>
        <input id="bPhone" type="tel" inputmode="tel" autocomplete="tel" maxlength="14" placeholder="10-digit mobile number" value="${esc(S.phone)}"></div>
      <div class="field"><label for="bEmail">Email</label>
        <input id="bEmail" type="email" autocomplete="email" placeholder="you@example.com" value="${esc(S.email)}">
        <span class="field-hint">We send your confirmation here.</span></div>
      <div class="field"><label for="bNotes">Anything we should set up? <span class="opt">Optional</span></label>
        <textarea id="bNotes" rows="3" placeholder="A name on the cake, a song to open with…">${esc(S.notes)}</textarea></div>
    </div>` +
    summary(q) + payBlock;
}

/** The booking read back. On the confirmation screen it also says what they asked
 *  for in their own words and, plainly, where payment stands — never "paid". */
function summary(q: Quote, final = false) {
  const rows: [string, string][] = [
    ['Occasion', occasionLabel()],
    ['Date & time', (S.date ? dateLabel(S.date) : '—') + (slotOf() ? ` · ${timeLabel()}` : '')],
    ['Guests', String(S.guests)],
    ['Seating', seatsLabel(S.seats)],
  ];
  q.lines.forEach((l) => rows.push([l.label, l.amount !== null ? rupee(l.amount) : 'On call']));
  return `<div class="bk-sum">${rows.map(([a, b]) =>
    `<div class="bk-sum-row"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('')}
    <div class="bk-sum-row is-total"><span>${q.unpriced.length ? 'Total so far' : 'Total'}</span><span>${esc(totalText(q))}</span></div>${final ? [
      ...(S.notes.trim() ? [['Your notes', S.notes.trim()]] : []),
      ['Payment', S.pay === 'upi' && canPayOnline(q)
        ? (S.utrSend === 'sent' ? 'UPI reference sent — awaiting confirmation' : 'UPI — awaiting payment')
        : 'After we call — nothing paid'],
    ].map(([a, b]) => `<div class="bk-sum-row"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('') : ''}</div>`;
}

/* ---------- interaction ---------- */

function onBodyClick(e: Event) {
  const t = e.target as HTMLElement;
  if (!t.closest('#bkBody')) return;
  let el: HTMLElement | null;

  if ((el = t.closest('[data-exp-pick]'))) {
    S.exp = el.dataset.expPick!;
    save();
    // "Something else" opens a box to describe the night, so stay on this step
    if (S.exp === OTHER.id) {
      render();
      $<HTMLTextAreaElement>('#bkCustom', root!)?.focus();
      return;
    }
    return go(S.step + 1);
  }
  if ((el = t.closest('[data-date-pick]'))) {
    S.date = el.dataset.datePick!;
    if (slotOf() && slotPassed(slotOf()!.start)) S.slot = '';
    save(); return render();
  }
  if ((el = t.closest('[data-slot-pick]'))) {
    if ((el as HTMLButtonElement).disabled) return;
    S.slot = el.dataset.slotPick!; save(); return go(S.step + 1);
  }
  if ((el = t.closest('[data-setup-pick]'))) {
    const id = el.dataset.setupPick!;
    const blocked = setupPrice(id, S.guests).blocked;
    if (blocked) return flash(blocked);
    S.setup = id;
    save();
    // Date Night carries on to the decoration below; the others are done here
    if (setupOf(id)?.hasDecor) {
      render();
      $('#bkDecor', root!)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      $<HTMLElement>(`[data-setup-pick="${id}"]`, root!)?.focus({ preventScroll: true });
      return;
    }
    return go(S.step + 1);
  }
  if ((el = t.closest('[data-decor-pick]'))) { S.decor = el.dataset.decorPick!; save(); return go(S.step + 1); }
  if ((el = t.closest('[data-addon-pick]'))) {
    const id = el.dataset.addonPick!;
    const group = addonOf(id)?.group;
    if (!group) return;
    const had = S.addons.includes(id);
    // one per group: picking another replaces it, picking the same one removes it
    S.addons = S.addons.filter((a) => !group.options.some((o) => o.id === a));
    if (!had) S.addons.push(id);
    save();
    render();
    $<HTMLElement>(`[data-addon-pick="${id}"]`, root!)?.focus();
    return;
  }
  if (t.closest('[data-bk-reset]')) return resetFlow();
  if (t.closest('[data-bk-resend]')) { void sendBooking(); return; }

  // one tap, one seat: take it, or give that same one back
  if ((el = t.closest('[data-seat]'))) {
    const n = Number(el.dataset.seat);
    if (!SEAT_IDS.includes(n)) return;
    const had = S.seats.includes(n);
    if (had && S.seats.length === 1) return flash('Someone has to sit somewhere — tap another seat first.');
    seatJustOn = had ? null : n;
    setSeats(had ? S.seats.filter((x) => x !== n) : [...S.seats, n]);
    save();
    render();
    seatJustOn = null;
    $<HTMLElement>(`[data-seat="${n}"]`, root!)?.focus();
  }
}

function wireFields() {
  const body = $('#bkBody')!;
  ([['bName', 'name'], ['bPhone', 'phone'], ['bNotes', 'notes'],
    ['bEmail', 'email'], ['bkCustom', 'customOccasion']] as const).forEach(([id, key]) => {
    const el = $<HTMLInputElement>(`#${id}`, body);
    el?.addEventListener('input', () => { (S as any)[key] = el.value; save(); });
  });
  $$<HTMLInputElement>('input[name="bkPay"]', body).forEach((r) => r.addEventListener('change', () => {
    $$('.payopt', body).forEach((l) => l.classList.toggle('is-sel', l.contains(r) && r.checked));
  }));
}

function resetState() {
  clearSaved();
  S = structuredClone(BLANK);
  resumed = false;
}

function resetFlow() {
  resetState();
  if (root && (mode === 'inline' || !root.hidden)) render();
}

/* ---------- sending and paying ---------- */

/** Short, unambiguous, and easy to read out over the phone. */
function makeRef(): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return 'YS-' + Array.from(bytes, (b) => abc[b % abc.length]).join('');
}

function bookingPayload(): Record<string, string> {
  const q = totals();
  const online = canPayOnline(q);
  return {
    'Booking ref': S.ref,
    Name: S.name,
    Phone: S.phone,
    Email: S.email,
    Occasion: occasionLabel(),
    'Date & time': `${dateLabel(S.date)}, ${timeLabel()}`,
    Guests: String(S.guests),
    Seating: seatsLabel(S.seats),
    ...Object.fromEntries(q.lines.map((l) => [l.label, l.amount !== null ? rupee(l.amount) : `price on call${l.note ? ` (${l.note})` : ''}`])),
    ...(S.notes.trim() ? { Notes: S.notes.trim() } : {}),
    Total: q.unpriced.length ? `${rupee(q.total)} + ${q.unpriced.join(', ')} (priced on call)` : rupee(q.total),
    Payment: S.pay === 'upi' && online
      ? `Customer chose UPI now (${rupee(q.total)}). NOT VERIFIED — check your bank app before confirming.`
      : 'After the call. Nothing paid.',
    Received: new Date().toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' }),
  };
}

function bookingText() {
  return [`YourSpace ${site.city} — booking ${S.ref}`,
    ...Object.entries(bookingPayload()).filter(([k]) => k !== 'Received' && k !== 'Booking ref' && k !== 'Payment')
      .map(([k, v]) => `${k}: ${v}`)].join('\n');
}

/* ---------- the WhatsApp hand-off ---------- */

/* Tanishk asked for this (Nov 2026): once someone has filled the flow in, they
   land in his chat with the whole booking already typed out, so they can finish
   it in WhatsApp instead of waiting for the call. It is an extra way through,
   not the only one — the booking has already been emailed to the team by the
   time this button appears, so nothing is lost if they never tap it, and a
   WhatsApp message is still not a payment: the UPI panel and the "we will call
   you" line stay exactly as they were. */
function bookingWhatsAppText() {
  const q = totals();
  const upi = S.pay === 'upi' && canPayOnline(q);
  return [
    `Hi YourSpace, I'd like to book. My booking reference is ${S.ref}.`,
    '',
    ...Object.entries(bookingPayload())
      .filter(([k]) => k !== 'Received' && k !== 'Booking ref' && k !== 'Payment' && k !== 'Email')
      .map(([k, v]) => `${k}: ${v}`),
    '',
    upi ? 'I have chosen to pay by UPI.' : 'Please confirm the slot and tell me how to pay.',
  ].join('\n');
}

/** '' when no WhatsApp number is set, and the button then hides. */
function bookingWhatsAppLink() {
  return whatsappIsSet ? whatsappLink(bookingWhatsAppText()) : '';
}

async function submit() {
  if (busy || S.send === 'sent' || S.send === 'sending') return;
  // check every step, not just this one, in case something changed underneath
  for (let i = 0; i <= 5; i++) {
    const err = validate(i);
    if (err) { go(i); return flash(err); }
  }
  if (!canPayOnline(totals())) S.pay = 'later';
  if (!S.ref) S.ref = makeRef();
  stash({ at: new Date().toISOString(), source: 'booking-flow', state: structuredClone(S), total: totals().total });
  S.step = DONE;
  go(DONE);
  await sendBooking();
}

async function sendBooking() {
  if (busy || S.send === 'sent') return;
  busy = true;
  S.send = 'sending'; save(); paintSendState();
  const payload = bookingPayload();
  const first = S.name.split(' ')[0] || 'there';
  const upi = S.pay === 'upi';
  const outcome = await deliver({
    ...payload,
    ...envelope(`Booking ${S.ref} — ${S.name || 'someone'} · ${S.phone}${upi ? ' · UPI pending' : ''}`, S.email),
    _autoresponse:
      `Thanks ${first} — we have your booking for YourSpace, ${site.city}.\n\n` +
      Object.entries(payload)
        .filter(([k]) => k !== 'Email' && k !== 'Received' && k !== 'Payment')
        .map(([k, v]) => `  ${k}: ${v}`).join('\n') +
      `\n\nWe will call you on ${S.phone} to confirm.\n` +
      (upi ? `If you have paid by UPI, we confirm the booking once the payment shows in our account.\n`
           : `Nothing has been charged.\n`) +
      `\n— YourSpace, ${site.city}`,
  });
  busy = false;
  S.send = outcome.ok ? 'sent' : 'failed';
  copySent = outcome.ok && outcome.copied;
  save();
  paintSendState(outcome.ok ? '' : outcome.reason);
}

/** Only say a copy is on its way when one really was sent. */
let copySent = false;

function paintSendState(reason = '') {
  const state = $('#bkSendState');
  if (!state) return;
  state.className = S.send === 'failed' ? 'fine center bk-send-failed' : 'fine center';
  state.innerHTML =
    S.send === 'sending' ? 'Sending your booking…'
    : S.send === 'sent' ? (copySent ? 'Your booking has reached us, and a copy is on its way to you.' : 'Your booking has reached us.')
    : `${reason === 'busy' ? "We're getting a lot of bookings right now, so this one hasn't reached us yet."
        : "That didn't reach us."} <button type="button" class="linkish" data-bk-resend>Try again</button>${
        bookingWhatsAppLink() ? ', send it on WhatsApp below,' : ''} or call ${callLink()} and quote <b>${esc(S.ref)}</b>.`;
}

function upiLink(amount: number) {
  // the UPI ID goes in as written: some apps reject an encoded "@"
  const enc = encodeURIComponent;
  return `upi://pay?pa=${site.upiId}&pn=${enc(site.upiPayee)}&am=${amount.toFixed(2)}&cu=INR&tn=${enc(`YourSpace ${S.ref}`)}`;
}

function qrSvg(text: string) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}

function payPanel(q: Quote) {
  const link = upiLink(q.total);
  const paid = S.utrSend === 'sent';
  return `
    <section class="paybox" aria-labelledby="payTitle">
      <h3 id="payTitle">Pay ${rupee(q.total)} by UPI</h3>
      <div class="paybox-grid">
        <div class="paybox-qr" role="img" aria-label="QR code to pay ${rupee(q.total)} by UPI">${qrSvg(link)}</div>
        <div class="paybox-how">
          <a class="btn btn-key full paybox-app" href="${esc(link)}">Open my UPI app<span aria-hidden="true">→</span></a>
          <p class="fine">On a computer, scan the code with any UPI app on your phone.</p>
          <dl class="paybox-meta">
            <div><dt>UPI ID</dt><dd><code>${esc(site.upiId)}</code> <button type="button" class="linkish" data-copy="${esc(site.upiId)}">Copy</button></dd></div>
            <div><dt>Name</dt><dd>${esc(site.upiPayee)}</dd></div>
            <div><dt>Amount</dt><dd class="num">${rupee(q.total)}</dd></div>
            <div><dt>Note</dt><dd><code>${esc(S.ref)}</code></dd></div>
          </dl>
          <p class="fine">If the link will not open or your app declines it, pay to the UPI ID by hand and put <b>${esc(S.ref)}</b> in the note.</p>
        </div>
      </div>
      ${paid ? `
        <p class="paybox-done" role="status">Thanks — we have your reference <b>${esc(S.utr)}</b>.
          We confirm your booking as soon as the payment shows in our account. Until then it is <b>awaiting confirmation</b>, not paid.</p>`
      : `
        <div class="bookform paybox-utr"><div class="field">
          <label for="bUtr">After paying: your UPI reference</label>
          <input id="bUtr" type="text" inputmode="numeric" autocomplete="off" maxlength="12"
                 placeholder="12-digit UTR / UPI ref. no." value="${esc(S.utr)}">
          <span class="field-hint">In your UPI app under the payment's details. It lets us match your payment to this booking.</span>
        </div></div>
        <button class="btn btn-line" type="button" data-bk-paid>I've paid — send my reference</button>
        <p class="fine" id="bkUtrState" role="status">${S.utrSend === 'failed' ? `That didn't reach us. Try again, or call ${callLink()}.` : ''}</p>`}
    </section>`;
}

async function sendUtr() {
  if (busy || S.utrSend === 'sent') return;
  const input = $<HTMLInputElement>('#bUtr');
  const utr = (input?.value ?? '').replace(/\s/g, '');
  if (!/^\d{12}$/.test(utr)) {
    const st = $('#bkUtrState');
    if (st) st.textContent = 'A UPI reference is 12 digits. You will find it in your UPI app under the payment.';
    input?.focus();
    return;
  }
  busy = true;
  S.utr = utr; S.utrSend = 'sending'; save();
  const btn = $<HTMLButtonElement>('[data-bk-paid]');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  const q = totals();
  const outcome = await deliver({
    'Booking ref': S.ref,
    Name: S.name,
    Phone: S.phone,
    Amount: rupee(q.total),
    'UPI reference (UTR)': utr,
    Status: 'UNVERIFIED — the customer says they paid. Find this UTR in the bank app before confirming.',
    ...envelope(`UPI payment claimed — ${S.ref} · ${rupee(q.total)} · UTR ${utr}`),
  });
  busy = false;
  S.utrSend = outcome.ok ? 'sent' : 'failed';
  save();
  renderDone();
}

function renderDone() {
  const q = totals();
  const first = esc(S.name.split(' ')[0] || 'friend');
  const upi = S.pay === 'upi' && canPayOnline(q);
  const wa = bookingWhatsAppLink();
  $('#bkSteps')!.innerHTML = '';
  ($('#bkBar') as HTMLElement).style.width = '100%';
  ($('#bkFoot') as HTMLElement).style.display = 'none';
  $('#bkBody')!.innerHTML = `
    <div class="bk-done">
      <div class="done-mark" aria-hidden="true"></div>
      <h2 class="title" id="bkTitle">${upi ? 'One step left' : "You're on the list"}, ${first}.</h2>
      <p class="bk-ref">Booking <b class="num">${esc(S.ref)}</b></p>
      <p class="bk-sub" style="margin-inline:auto">We have your ${esc(setupOf(S.setup)?.name ?? 'booking')}
        for <b>${dateLabel(S.date)}, ${timeLabel()}</b>.
        We'll call you on ${esc(S.phone)} to confirm.
        ${upi ? 'Pay below to hold your slot.' : 'Nothing has been charged.'}</p>
      <p class="fine center" id="bkSendState" role="status"></p>
      ${upi ? payPanel(q) : ''}
      ${summary(q, true)}
      ${wa ? `
        <div class="bk-wa">
          <p class="bk-wa-say"><span class="wa-kicker">Finish on WhatsApp</span>
            Your booking is already with us. Want to talk it through, or send it straight to
            ${esc(site.name)} yourself? This opens WhatsApp with every detail of booking
            <b>${esc(S.ref)}</b> already written out.</p>
          <a class="btn btn-key bk-wa-btn" href="${esc(wa)}" target="_blank" rel="noopener" data-whatsapp data-wa-booking>
            ${WA_ICON}Send my booking on WhatsApp<span class="sr-only"> (opens WhatsApp)</span></a>
          <p class="fine">${upi ? 'Sending it on WhatsApp is not a payment — pay above to hold your slot.'
            : 'We will still call you on ' + esc(S.phone) + ' to confirm.'}</p>
        </div>` : ''}
      <div class="bk-actions">
        <button class="btn btn-line" type="button" id="bkCopy">Copy my details</button>
        ${mode === 'modal' ? '<button class="btn btn-line" type="button" data-bk-close>Done</button>'
                           : '<button class="btn btn-line" type="button" data-bk-reset>Start a new booking</button>'}
      </div>
    </div>`;
  paintSendState();

  // The second tap of a double-tap on "Send & pay" lands here, where the pay
  // link has just appeared under the finger. Ignore taps on the panel for a
  // moment so nobody is thrown into their UPI app before they have seen it.
  const pay = $('.paybox', root!);
  if (pay && !armed) {
    pay.classList.add('is-arming');
    setTimeout(() => { pay.classList.remove('is-arming'); armed = true; }, 700);
  }

  const body = $('#bkBody')!;
  $('#bkCopy', body)?.addEventListener('click', () => copy($('#bkCopy', body)!, bookingText()));
  $$<HTMLElement>('[data-copy]', body).forEach((b) => b.addEventListener('click', () => copy(b, b.dataset.copy!)));
  $('[data-bk-paid]', body)?.addEventListener('click', sendUtr);
  $('#bUtr', body)?.addEventListener('input', (e) => { S.utr = (e.target as HTMLInputElement).value; save(); });
}

function copy(btn: HTMLElement, text: string) {
  const was = btn.textContent;
  const done = () => { btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = was; }, 2200); };
  navigator.clipboard?.writeText(text).then(done, done) ?? done();
}
