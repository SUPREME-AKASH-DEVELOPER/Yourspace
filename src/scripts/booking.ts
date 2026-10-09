import { $, $$, rupee, esc, dateLabel, nextDays, stash } from './dom';
import { site, phoneIsSet, waLink } from '../data/site';
import {
  experiences, slots, packages, extras, stepNames, OTHER,
  ROOM_BASE, BASE_GUESTS, EXTRA_GUEST, MAX_GUESTS, SESSION_LABEL,
  type Extra,
} from '../data/booking';

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

interface State {
  step: number; exp: string; date: string; guests: number;
  slot: string; pkg: string; extras: Record<string, number>;
  name: string; phone: string; notes: string;
  /** Filled in when the occasion is "Something else". */
  customOccasion: string;
}
const BLANK: State = {
  step: 0, exp: '', date: '', guests: 2, slot: '', pkg: '', extras: {},
  name: '', phone: '', notes: '', customOccasion: '',
};

const KEY = 'ys-booking-v2';
let S: State = structuredClone(BLANK);
let root: HTMLElement | null = null;
let mode: 'modal' | 'inline' = 'modal';
let lastFocus: HTMLElement | null = null;
let resumed = false;

const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };
const clearSaved = () => { try { localStorage.removeItem(KEY); } catch {} };

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const o = JSON.parse(raw) as Partial<State>;
    if (!o || typeof o !== 'object') return;
    (Object.keys(BLANK) as (keyof State)[]).forEach((k) => {
      if (o[k] !== undefined && o[k] !== null) (S as any)[k] = o[k];
    });
    if (S.date && S.date < new Date().toISOString().slice(0, 10)) { S.date = ''; S.slot = ''; }
    S.step = Math.min(Math.max(0, S.step | 0), 5);
    S.guests = Math.min(MAX_GUESTS, Math.max(1, S.guests | 0 || 2));
    resumed = Boolean(S.exp || S.pkg || S.date);
  } catch {}
}

/** What to call the occasion: their own words when they gave us some. */
function occasionLabel(): string {
  if (S.exp === OTHER.id) return S.customOccasion.trim() || OTHER.name;
  return expOf()?.name ?? '—';
}

const pkgOf = () => packages.find((p) => p.id === S.pkg) ?? null;
const expOf = () => experiences.find((e) => e.id === S.exp) ?? null;
const slotOf = () => slots.find((s) => s.id === S.slot) ?? null;
const extraOf = (id: string): Extra | undefined => extras.find((e) => e.id === id);

function totals() {
  const base = pkgOf()?.price ?? ROOM_BASE;
  const extraHeads = Math.max(0, S.guests - BASE_GUESTS);
  const guestFee = extraHeads * EXTRA_GUEST;
  const addons = Object.entries(S.extras)
    .reduce((sum, [id, qty]) => sum + (extraOf(id)?.price ?? 0) * qty, 0);
  return { base, guestFee, extraHeads, addons, total: base + guestFee + addons };
}

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
      <p class="bk-total" id="bkTotal"></p>
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
    if (hit) { S.exp = hit.id; if (S.step < 1) S.step = 1; save(); }
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

/** Used by the hero ticket: carry what they already chose into the flow. */
export function prefillBooking(opts: { exp?: string; custom?: string; date?: string; guests?: number }) {
  const hit = experiences.find((e) => e.name.toLowerCase() === (opts.exp ?? '').toLowerCase());
  const isOther = opts.exp === OTHER.id;
  if (hit) S.exp = hit.id;
  if (isOther) {
    S.exp = OTHER.id;
    S.customOccasion = (opts.custom ?? '').trim();
  }
  if (opts.date) S.date = opts.date;
  if (opts.guests && opts.guests > 0) S.guests = Math.min(MAX_GUESTS, Math.max(1, opts.guests));
  // with a described occasion we can move on; without one, stay and ask
  const chosen = hit || (isOther && S.customOccasion);
  S.step = chosen ? (opts.date ? 2 : 1) : 0;
  save();
}

export function openBooking(expName = '') {
  if (!root) mountBooking();
  const hit = experiences.find((e) => e.id === expName || e.name.toLowerCase() === expName.toLowerCase());
  if (hit) { S.exp = hit.id; if (S.step < 1) S.step = 1; save(); }
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
  if (S.step === 6) resetFlow();
  document.body.classList.remove('is-locked');
  save();
  lastFocus?.focus();
}

function go(n: number) {
  S.step = Math.max(0, Math.min(6, n));
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

function validate(step: number) {
  if (step === 0 && !S.exp) return 'Pick an occasion to continue.';
  if (step === 0 && S.exp === OTHER.id && !S.customOccasion.trim())
    return 'Tell us what you are planning, in a line or two.';
  if (step === 1 && !S.date) return 'Choose a date to continue.';
  if (step === 2 && !S.slot) return 'Pick a time to continue.';
  if (step === 3 && !S.pkg) return 'Choose a package to continue.';
  if (step === 5) {
    if (!S.name.trim()) return 'Please add your name.';
    if (!/^[6-9]\d{9}$/.test(S.phone.replace(/\D/g, '').slice(-10))) return 'Enter a valid 10-digit mobile number.';
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
  setTimeout(() => p.remove(), 4200);
}

/* ---------- render ---------- */
function render() {
  if (S.step === 6) return renderDone();
  const t = totals();

  $('#bkSteps')!.innerHTML = stepNames.map((n, i) => {
    const cls = i === S.step ? 'is-now' : i < S.step ? 'is-done' : '';
    return `<span class="bk-step ${cls}">${String(i + 1).padStart(2, '0')} ${n}</span>`;
  }).join('');
  ($('#bkBar') as HTMLElement).style.width = `${((S.step + 1) / 6) * 100}%`;

  ($('#bkFoot') as HTMLElement).style.display = '';
  ($('[data-bk-back]') as HTMLElement).style.visibility = S.step === 0 ? 'hidden' : 'visible';
  $('[data-bk-next]')!.innerHTML = (S.step === 5 ? 'Confirm pre-booking' : 'Continue') + '<span aria-hidden="true">→</span>';

  const bits = [occasionLabel(), S.date && dateLabel(S.date), slotOf()?.start,
                `${S.guests} ${S.guests === 1 ? 'guest' : 'guests'}`].filter(Boolean);
  $('#bkTotal')!.innerHTML = `<strong>${rupee(t.total)}</strong><span>${esc(bits.join(' · '))} · ₹0 today</span>`;

  $('#bkBody')!.innerHTML = [step0, step1, step2, step3, step4, step5][S.step](t);
  wireFields();
}

const head = (kick: string, title: string, sub?: string) =>
  `<p class="bk-kicker">${kick}</p><h2 class="title" id="bkTitle">${title}</h2>` +
  (sub ? `<p class="bk-sub">${sub}</p>` : '');

function step0() {
  const isOther = S.exp === OTHER.id;
  return head('Step 01 of 06', 'What are you celebrating?',
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

/* the seat picker: you choose seats, not a number in a box */
function seatmap() {
  let i = 0;
  const rows = [['A', 6], ['B', 6]] as const;
  const html = rows.map(([letter, count]) => {
    let r = `<div class="seat-row"><i>${letter}</i>`;
    for (let c = 0; c < count; c++) {
      i++;
      const cls = i <= S.guests ? (i <= BASE_GUESTS ? 'is-taken' : 'is-extra') : '';
      r += `<button type="button" class="seat ${cls}" data-seat="${i}" aria-pressed="${i <= S.guests}"
              aria-label="Seat ${letter}${c + 1}, ${i <= BASE_GUESTS ? 'included' : `${rupee(EXTRA_GUEST)} extra`}"></button>`;
    }
    return r + '</div>';
  }).join('');

  return `<div class="seatmap">
    <div class="seat-screen"><span aria-hidden="true"></span><em>Screen</em></div>
    <div class="seat-rows">${html}</div>
    <p class="seat-legend">
      <span><b class="k"></b>Included (up to ${BASE_GUESTS})</span>
      <span><b class="e"></b>+${rupee(EXTRA_GUEST)} each</span>
      <span><b></b>Free seat</span>
    </p></div>`;
}

function step1() {
  return head('Step 02 of 06', "When's the night, and who's coming?",
    `Tap a seat for every guest. ${rupee(ROOM_BASE)} covers the room for up to ${BASE_GUESTS}.`) +
    seatmap() +
    '<p class="bk-kicker">Pick a date</p>' +
    `<div class="bk-dates">${nextDays(21).map((d) => `
      <button class="daytile ${S.date === d.iso ? 'is-sel' : ''}" type="button" data-date-pick="${d.iso}">
        <em>${d.dow}</em><strong>${d.day}</strong><em>${d.mon}</em>
      </button>`).join('')}</div>` +
    '<p class="fine">Looking further ahead? Tell us the date in the notes on the last step.</p>';
}

function step2() {
  return head('Step 03 of 06', 'Choose your time',
    `${dateLabel(S.date)} · ${S.guests} guests · every slot is a ${SESSION_LABEL}.`) +
    `<div class="slots">${slots.map((s) => `
      <button class="slot ${S.slot === s.id ? 'is-sel' : ''}" type="button" data-slot-pick="${s.id}">
        <strong>${s.start}</strong><span>to ${s.end}</span>
      </button>`).join('')}</div>` +
    `<div class="bk-note" style="margin-top:22px"><i>Note</i><span>We are <b>opening soon</b>, so times are indicative. We call you to lock the exact slot, and nothing is charged until you confirm with us.</span></div>`;
}

function step3() {
  const heads = Math.max(0, S.guests - BASE_GUESTS);
  return head('Step 04 of 06', 'Choose your setup',
    'Every package includes the private room for your whole session. Extras come next.') +
    `<div class="pkgs">${packages.map((p) => `
      <button class="pkg ${S.pkg === p.id ? 'is-sel' : ''}" type="button" data-pkg-pick="${p.id}">
        ${p.tag ? `<span class="pkg-tag">${p.tag}</span>` : ''}
        <span class="pkg-top"><strong>${p.name}</strong><span class="pkg-price">${rupee(p.price)}</span></span>
        <p>${p.desc}</p>
        <ul>${p.includes.map((i) => `<li>${i}</li>`).join('')}</ul>
        <p class="pkg-fine">Up to ${BASE_GUESTS} guests · ${SESSION_LABEL}${heads ? ` · +${rupee(heads * EXTRA_GUEST)} for ${heads} extra seat${heads > 1 ? 's' : ''}` : ''}</p>
      </button>`).join('')}</div>`;
}

function step4(t: ReturnType<typeof totals>) {
  const groups = [...new Set(extras.map((x) => x.group))];
  return head('Step 05 of 06', 'Make it yours',
    'Optional — add only what you want. Your package already covers its own inclusions.') +
    groups.map((g) => `<div class="xgroup"><h3>${g}</h3>` +
      extras.filter((x) => x.group === g).map((x) => `
        <div class="xrow"><div class="xrow-main"><strong>${x.name}</strong>
          <span>${rupee(x.price)} each</span></div>
          ${stepper(`x:${x.id}`, S.extras[x.id] || 0, 0, x.max)}</div>`).join('') +
      '</div>').join('') +
    summary(t) +
    '<p class="fine">Nothing is added by default, and the total updates as you go.</p>';
}

function step5(t: ReturnType<typeof totals>) {
  return head('Step 06 of 06', 'Where do we reach you?',
    'We call you to confirm the slot. No payment, and no card details.') +
    `<div class="bookform" style="margin-bottom:24px">
      <div class="field"><label for="bName">Your name</label>
        <input id="bName" type="text" autocomplete="name" placeholder="Who should we ask for?" value="${esc(S.name)}"></div>
      <div class="field"><label for="bPhone">Phone number</label>
        <input id="bPhone" type="tel" inputmode="tel" autocomplete="tel" maxlength="14" placeholder="10-digit mobile number" value="${esc(S.phone)}"></div>
      <div class="field"><label for="bNotes">Anything we should set up? <span class="opt">Optional</span></label>
        <textarea id="bNotes" rows="3" placeholder="A name on the cake, a song to open with, a different date…">${esc(S.notes)}</textarea></div>
    </div>` +
    summary(t) +
    `<div class="bk-note"><i>Note</i><span><b>Nothing is charged now.</b> This reserves your interest in the slot. Prices are indicative while we set up, and we confirm the final amount with you on the call before anything is paid.</span></div>`;
}

function summary(t: ReturnType<typeof totals>) {
  const rows: [string, string][] = [
    ['Occasion', occasionLabel()],
    ['Date & time', (S.date ? dateLabel(S.date) : '—') + (slotOf() ? ` · ${slotOf()!.start}` : '')],
    ['Seats', String(S.guests)],
    ['Package', `${pkgOf()?.name ?? '—'} · ${rupee(t.base)}`],
  ];
  if (t.extraHeads) rows.push([`${t.extraHeads} extra seat${t.extraHeads > 1 ? 's' : ''}`, rupee(t.guestFee)]);
  Object.entries(S.extras).forEach(([id, qty]) => {
    const x = extraOf(id);
    if (x && qty) rows.push([`${x.name} × ${qty}`, rupee(x.price * qty)]);
  });
  return `<div class="bk-sum">${rows.map(([a, b]) =>
    `<div class="bk-sum-row"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('')}
    <div class="bk-sum-row is-total"><span>Estimated total</span><span>${rupee(t.total)}</span></div>
    <div class="bk-sum-row"><span>To pay now</span><span>₹0</span></div></div>`;
}

const stepper = (key: string, val: number, min: number, max: number) => `
  <div class="stepper" data-step-key="${key}">
    <button type="button" data-delta="-1" aria-label="Remove one"${val <= min ? ' disabled' : ''}>&minus;</button>
    <output>${val}</output>
    <button type="button" data-delta="1" aria-label="Add one"${val >= max ? ' disabled' : ''}>+</button>
  </div>`;

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
  if ((el = t.closest('[data-date-pick]'))) { S.date = el.dataset.datePick!; save(); return render(); }
  if ((el = t.closest('[data-slot-pick]'))) { S.slot = el.dataset.slotPick!; save(); return go(S.step + 1); }
  if ((el = t.closest('[data-pkg-pick]'))) { S.pkg = el.dataset.pkgPick!; save(); return go(S.step + 1); }
  if (t.closest('[data-bk-reset]')) return resetFlow();

  // seats fill up to the one you tapped; tapping the last one gives it back
  if ((el = t.closest('[data-seat]'))) {
    const n = Number(el.dataset.seat);
    S.guests = n === S.guests ? Math.max(1, n - 1) : n;
    save();
    render();
    $<HTMLElement>(`[data-seat="${Math.min(S.guests || 1, MAX_GUESTS)}"]`, root!)?.focus();
    return;
  }

  const btn = t.closest<HTMLElement>('.stepper button');
  if (!btn) return;
  const key = btn.closest<HTMLElement>('.stepper')!.dataset.stepKey!;
  const id = key.slice(2);
  const x = extraOf(id);
  const next = Math.max(0, Math.min(x?.max ?? 9, (S.extras[id] || 0) + Number(btn.dataset.delta)));
  if (next) S.extras[id] = next; else delete S.extras[id];
  save();
  render();
}

function wireFields() {
  const body = $('#bkBody')!;
  ([['bName', 'name'], ['bPhone', 'phone'], ['bNotes', 'notes'],
    ['bkCustom', 'customOccasion']] as const).forEach(([id, key]) => {
    const el = $<HTMLInputElement>(`#${id}`, body);
    el?.addEventListener('input', () => { (S as any)[key] = el.value; save(); });
  });
}

function resetFlow() {
  clearSaved();
  S = structuredClone(BLANK);
  resumed = false;
  if (root && (mode === 'inline' || !root.hidden)) render();
}

function bookingText() {
  const t = totals();
  const L = [
    `YourSpace ${site.city} — pre-booking request`,
    `Name: ${S.name}`, `Phone: ${S.phone}`,
    `Occasion: ${occasionLabel()}`,
    `Date: ${dateLabel(S.date)}${slotOf() ? ` at ${slotOf()!.start}` : ''}`,
    `Seats: ${S.guests}`,
    `Package: ${pkgOf() ? `${pkgOf()!.name} (${rupee(pkgOf()!.price)})` : '—'}`,
  ];
  Object.entries(S.extras).forEach(([id, qty]) => {
    const x = extraOf(id);
    if (x && qty) L.push(`Extra: ${x.name} x${qty}`);
  });
  if (t.extraHeads) L.push(`Extra seats: ${t.extraHeads} (${rupee(t.guestFee)})`);
  if (S.notes.trim()) L.push(`Notes: ${S.notes.trim()}`);
  L.push(`Estimated total: ${rupee(t.total)} (nothing paid)`);
  return L.join('\n');
}

function submit() {
  stash({ at: new Date().toISOString(), source: 'booking-flow', state: structuredClone(S), total: totals().total });
  go(6);
}

function renderDone() {
  const t = totals();
  const txt = bookingText();
  const first = esc(S.name.split(' ')[0] || 'friend');
  $('#bkSteps')!.innerHTML = '';
  ($('#bkBar') as HTMLElement).style.width = '100%';
  ($('#bkFoot') as HTMLElement).style.display = 'none';
  $('#bkBody')!.innerHTML = `
    <div class="bk-done">
      <div class="done-mark" aria-hidden="true"></div>
      <h2 class="title" id="bkTitle">You're on the list, ${first}.</h2>
      <p class="bk-sub" style="margin-inline:auto">We have your ${esc(
        S.exp === OTHER.id ? 'booking' : (expOf()?.name.toLowerCase() ?? 'booking'))}
        for <b>${dateLabel(S.date)}${slotOf() ? ` at ${slotOf()!.start}` : ''}</b>.
        We'll call you on ${esc(S.phone)} to confirm. Nothing has been charged.</p>
      ${summary(t)}
      <div class="bk-actions">
        ${phoneIsSet ? `<a class="btn btn-key" target="_blank" rel="noopener" href="${waLink(txt)}">Send on WhatsApp<span aria-hidden="true">→</span></a>` : ''}
        ${site.googleForm ? `<a class="btn btn-line" target="_blank" rel="noopener" href="${site.googleForm}">Open the form</a>` : ''}
        <button class="btn ${phoneIsSet ? 'btn-line' : 'btn-key'}" type="button" id="bkCopy">Copy my details</button>
        ${mode === 'modal' ? '<button class="btn btn-line" type="button" data-bk-close>Done</button>'
                           : '<a class="btn btn-line" href="/">Back to home</a>'}
      </div>
      <p class="fine center">${phoneIsSet ? '' : 'For the team: set the phone number in src/data/site.ts so this messages you directly. '}Your details are saved in this browser only.</p>
    </div>`;

  $('#bkCopy')?.addEventListener('click', () => {
    const btn = $('#bkCopy')!;
    const done = () => {
      btn.textContent = 'Copied';
      setTimeout(() => { btn.textContent = 'Copy my details'; }, 2200);
    };
    navigator.clipboard?.writeText(txt).then(done, done) ?? done();
  });
  clearSaved();
}
