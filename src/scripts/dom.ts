export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector<T>(sel);

export const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(sel));

export const rupee = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export const dateLabel = (iso: string) =>
  iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-IN',
    { weekday: 'short', day: 'numeric', month: 'short' }) : '';

export function nextDays(n: number) {
  const out: { iso: string; dow: string; day: number; mon: string }[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getTime() + i * 864e5);
    out.push({
      iso: d.toISOString().slice(0, 10),
      dow: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      day: d.getDate(),
      mon: d.toLocaleDateString('en-IN', { month: 'short' }),
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
  } catch { /* private mode, blocked storage — not worth failing over */ }
}
