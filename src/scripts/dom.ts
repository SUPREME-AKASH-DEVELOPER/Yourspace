export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector<T>(sel);

export const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(sel));

export const rupee = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/**
 * The room is in Jabalpur, so "today" and "has this slot started yet" are
 * Jabalpur's, not the visitor's device's. A UTC date would offer yesterday
 * between midnight and 5:30 AM in India; a device clock abroad would show
 * the wrong slots as gone.
 */
export const VENUE_TZ = 'Asia/Kolkata';

export function venueNow(at = new Date()): { iso: string; minutes: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: VENUE_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(at).map((x) => [x.type, x.value]),
  );
  return { iso: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

export const venueToday = () => venueNow().iso;

/** A calendar date ("2026-11-03"), read and printed as a date, no time zone can shift it. */
const asDay = (iso: string) => new Date(iso + 'T00:00:00Z');
export const isIsoDate = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(asDay(s).getTime());

export const dateLabel = (iso: string) =>
  isIsoDate(iso) ? asDay(iso).toLocaleDateString('en-IN',
    { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) : '';

/** The next n days, starting with today in Jabalpur. */
export function nextDays(n: number) {
  const out: { iso: string; dow: string; day: number; mon: string }[] = [];
  const [y, m, d] = venueToday().split('-').map(Number);
  for (let i = 0; i < n; i++) {
    const day = new Date(Date.UTC(y, m - 1, d + i));
    out.push({
      iso: day.toISOString().slice(0, 10),
      dow: day.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' }),
      day: day.getUTCDate(),
      mon: day.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' }),
    });
  }
  return out;
}

/** Everything a visitor submits is kept in their own browser, nowhere else. */
export function stash(record: Record<string, unknown>) {
  try {
    const all = JSON.parse(localStorage.getItem('ys-requests') || '[]');
    all.push(record);
    localStorage.setItem('ys-requests', JSON.stringify(all));
  } catch { /* private mode, blocked storage, not worth failing over */ }
}
