import { site, formEndpoint } from '../data/site';

/**
 * Every submission on this site leaves by one route: email.
 * Nothing is handed off to WhatsApp or any other channel.
 */

async function postOnce(payload: Record<string, string>): Promise<boolean> {
  const ctl = new AbortController();
  const bail = setTimeout(() => ctl.abort(), 12_000);
  try {
    const res = await fetch(formEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: ctl.signal,
    });
    if (!res.ok) return false;
    const body = await res.json().catch(() => ({}));
    // FormSubmit answers { success: "true" }; anything else is a refusal
    return String((body as Record<string, unknown>).success ?? 'true') === 'true';
  } catch {
    return false;
  } finally {
    clearTimeout(bail);
  }
}

/** Email is the only route, so a flaky line gets one more try. */
export async function deliver(payload: Record<string, string>): Promise<boolean> {
  if (!formEndpoint) return false;
  if (await postOnce(payload)) return true;
  await new Promise((r) => setTimeout(r, 1200));
  return postOnce(payload);
}

/** The fields every email carries, whoever it is addressed to. */
export function envelope(subject: string, replyTo?: string): Record<string, string> {
  return {
    _subject: subject,
    _template: 'table',
    _captcha: 'false',
    ...(site.notifyCc ? { _cc: site.notifyCc } : {}),
    ...(replyTo ? { _replyto: replyTo } : {}),
  };
}
