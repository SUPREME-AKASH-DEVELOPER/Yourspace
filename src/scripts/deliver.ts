import { site, formEndpoint } from '../data/site';

/** Web3Forms when a key is set, FormSubmit otherwise. */
const useWeb3Forms = Boolean(site.web3formsKey);
const ENDPOINT = useWeb3Forms ? 'https://api.web3forms.com/submit' : formEndpoint;

/**
 * Every submission on this site leaves by one route: email.
 * Nothing is handed off to WhatsApp or any other channel.
 */

function toFormData(payload: Record<string, string>): FormData {
  const fd = new FormData();
  Object.entries(payload).forEach(([k, v]) => fd.append(k, v));
  return fd;
}

/** Why a send did not go through, so we can say something true about it. */
export type Outcome =
  | { ok: true }
  | { ok: false; reason: 'offline' | 'busy' | 'refused'; retryAfter?: number };

async function postOnce(payload: Record<string, string>): Promise<Outcome> {
  const ctl = new AbortController();
  const bail = setTimeout(() => ctl.abort(), 12_000);
  try {
    // Web3Forms refuses the CORS preflight that a JSON content-type sets off,
    // so it gets FormData — a "simple" request the browser sends straight out.
    // FormSubmit's ajax endpoint wants JSON.
    const init: RequestInit = useWeb3Forms
      ? { method: 'POST', body: toFormData(payload), signal: ctl.signal }
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
          signal: ctl.signal,
        };
    const res = await fetch(ENDPOINT, init);

    // Too many requests: the send is fine, the service just wants a pause.
    if (res.status === 429) {
      const after = Number(res.headers.get('retry-after')) || 0;
      return { ok: false, reason: 'busy', retryAfter: after };
    }
    if (!res.ok) return { ok: false, reason: res.status >= 500 ? 'offline' : 'refused' };

    const body = await res.json().catch(() => ({}));
    const success = String((body as Record<string, unknown>).success ?? 'true') === 'true';
    if (success) return { ok: true };

    const msg = String((body as Record<string, unknown>).message ?? '').toLowerCase();
    return { ok: false, reason: msg.includes('rate limit') ? 'busy' : 'refused' };
  } catch {
    return { ok: false, reason: 'offline' };
  } finally {
    clearTimeout(bail);
  }
}

/**
 * Deliver one submission by email.
 *
 * Email is the only route, so a dropped connection is worth one more try.
 * A refusal or a rate limit is not: repeating those makes it worse, and the
 * visitor is better served by a message that says what actually happened.
 */
export async function deliver(payload: Record<string, string>): Promise<Outcome> {
  if (!ENDPOINT) return { ok: false, reason: 'refused' };
  const first = await postOnce(payload);
  if (first.ok || first.reason !== 'offline') return first;
  await new Promise((r) => setTimeout(r, 1500));
  return postOnce(payload);
}

/**
 * The fields every email carries. The two services name these differently,
 * so the rest of the site never has to know which one is in use.
 */
export function envelope(subject: string, replyTo?: string): Record<string, string> {
  if (useWeb3Forms) {
    // Web3Forms delivers to the address the key was created with, so both
    // of our people go on the copy line rather than one being "primary".
    const copies = [site.notifyPrimary, site.notifyCc].filter(Boolean).join(', ');
    return {
      access_key: site.web3formsKey,
      subject,
      from_name: `${site.name} ${site.city}`,
      ...(copies ? { ccemail: copies } : {}),
      ...(replyTo ? { replyto: replyTo } : {}),
    };
  }
  return {
    _subject: subject,
    _template: 'table',
    _captcha: 'false',
    ...(site.notifyCc ? { _cc: site.notifyCc } : {}),
    ...(replyTo ? { _replyto: replyTo } : {}),
  };
}

/** Which service is carrying the mail, for the CSP and for tests. */
export const mailOrigin = useWeb3Forms
  ? 'https://api.web3forms.com'
  : (formEndpoint ? new URL(formEndpoint).origin : '');
