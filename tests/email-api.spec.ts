import { test, expect } from '@playwright/test';
import { POST } from '../api/send.js';
import { canEmailCustomer, customerEmail, ownerEmail } from '../api/_email.js';

/* These call the function directly. Resend is stubbed, so nobody is ever emailed. */

const booking = {
  'Booking ref': 'YS-ABC234',
  Name: 'Riya Sharma',
  Phone: '9876543210',
  Email: 'riya@example.com',
  Occasion: 'Birthday',
  'Date & time': 'Sat, 14 Nov, 7:30 PM – 9:00 PM',
  Guests: '4',
  Total: '₹1,500',
  Payment: 'After the call. Nothing paid.',
  Notes: 'Knife for the cake',
  subject: 'Booking YS-ABC234, Riya Sharma · 9876543210',
};

function call(body: unknown, origin = 'https://www.yourspacejbp.com', ip: string = crypto.randomUUID()) {
  return POST(new Request('https://www.yourspacejbp.com/api/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin, 'x-forwarded-for': ip },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }));
}

type Sent = { to: string[]; cc?: string[]; subject: string; html: string; text: string; reply_to?: string };

test.describe('the email function', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'no browser involved');

  const realFetch = globalThis.fetch;
  let sent: Sent[] = [];
  let refuse: (m: Sent) => boolean = () => false;

  test.beforeEach(() => {
    sent = [];
    refuse = () => false;
    process.env.RESEND_API_KEY = 'test-key';
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      const message = JSON.parse(String(init.body)) as Sent;
      if (refuse(message)) return new Response('{"message":"no"}', { status: 422 });
      sent.push(message);
      return Response.json({ id: 'x' });
    }) as typeof fetch;
  });
  test.afterEach(() => {
    globalThis.fetch = realFetch;
    delete process.env.RESEND_API_KEY;
  });

  test('a booking emails the team and the customer', async () => {
    const res = await call(booking);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, customer: 'sent' });
    expect(sent).toHaveLength(2);

    expect(sent[0].to).toEqual(['tanishkofficial27@gmail.com']);
    expect(sent[0].cc).toEqual(['badalakki11@gmail.com']);
    expect(sent[0].reply_to, 'replying reaches the customer').toBe('riya@example.com');
    expect(sent[0].subject).toContain('YS-ABC234');
    expect(sent[0].html).toContain('Knife for the cake');
    expect(sent[0].html).toContain('tel:+919876543210');
    expect(sent[0].html).toContain('https://wa.me/919876543210');

    expect(sent[1].to).toEqual(['riya@example.com']);
    expect(sent[1].reply_to, 'replying reaches Tanishk').toBe('tanishkofficial27@gmail.com');
    expect(sent[1].subject).toContain('YS-ABC234');
    expect(sent[1].html).toContain('Nothing has been charged');
    expect(sent[1].html).not.toContain('Knife for the cake');
  });

  test('the browser cannot choose who receives the lead', async () => {
    await call({ ...booking, ccemail: 'evil@example.net', replyto: 'evil@example.net', to: 'evil@example.net', _cc: 'evil@example.net' });
    const everyone = sent.flatMap((m) => [...m.to, ...(m.cc ?? [])]);
    expect(everyone).not.toContain('evil@example.net');
  });

  test('the browser cannot write the customer email', async () => {
    await call({ ...booking, _autoresponse: 'Send money to this account', subject: 'x' });
    expect(sent[1].html).not.toContain('Send money');
    expect(sent[1].text).not.toContain('Send money');
  });

  test('a stranger with a link in the form gets no customer email, but the lead arrives', async () => {
    const res = await call({ ...booking, Name: 'Win a prize http://evil.example' });
    expect(await res.json()).toEqual({ success: true, customer: 'none' });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toEqual(['tanishkofficial27@gmail.com']);
  });

  test('anything typed in is escaped', () => {
    const { html } = ownerEmail({ Name: '<script>alert(1)</script>', Phone: '9876543210', Notes: '"<b>hi</b>"' }, 'Enquiry');
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<b>hi</b>');
    expect(html).toContain('&lt;script&gt;');
  });

  test('a booking paying online is never told it was not charged', () => {
    const { html, text } = customerEmail({ ...booking, Payment: 'Customer chose to pay online now (₹1,500). Not paid yet: a separate "Payment received" email follows once Razorpay confirms it.' }, booking.subject);
    expect(html).toContain('awaiting payment');
    expect(text).not.toContain('Nothing has been charged');
  });

  test('a browser cannot send an email that says paid', async () => {
    const res = await call({ ...booking, 'Razorpay payment': 'pay_FAKE', 'Amount paid': '₹1', Status: 'PAID, ₹1 verified with Razorpay' });
    expect(res.status).toBe(200);
    for (const m of sent) {
      expect(m.subject).not.toMatch(/payment received/i);
      expect(m.html).not.toContain('pay_FAKE');
      expect(m.html).not.toMatch(/verified with Razorpay \(/);
    }
  });

  test('the team email failing is reported, so the site can use the backup', async () => {
    refuse = (m) => m.to.includes('tanishkofficial27@gmail.com');
    const res = await call(booking);
    expect(res.status).toBe(502);
    expect(sent, 'no confirmation for a lead that never arrived').toHaveLength(0);
  });

  test('the customer email failing does not fail the booking', async () => {
    refuse = (m) => m.to.includes('riya@example.com');
    const res = await call(booking);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, customer: 'failed' });
  });

  test('without a key it says so, and sends nothing', async () => {
    delete process.env.RESEND_API_KEY;
    expect((await call(booking)).status).toBe(503);
    expect(sent).toHaveLength(0);
  });

  test('other websites are refused', async () => {
    expect((await call(booking, 'https://evil.example')).status).toBe(403);
    expect((await call(booking, '')).status).toBe(403);
    expect(sent).toHaveLength(0);
  });

  test('rubbish is refused', async () => {
    expect((await call('not json')).status).toBe(400);
    expect((await call([])).status).toBe(400);
    expect((await call({ Name: 'No phone' })).status).toBe(400);
    expect((await call({ ...booking, Notes: 'x'.repeat(20_000) })).status).toBe(413);
  });

  test('one address hammering the form is slowed down', async () => {
    const ip = 'hammer-' + crypto.randomUUID();
    let last = 200;
    for (let i = 0; i < 13; i++) last = (await call(booking, undefined, ip)).status;
    expect(last).toBe(429);
  });

  test('a bad email address means no customer email', () => {
    expect(canEmailCustomer({ ...booking, Email: 'not-an-address' })).toBe(false);
    expect(canEmailCustomer({ ...booking, Email: 'a@b.com, c@d.com' })).toBe(false);
    expect(canEmailCustomer(booking)).toBe(true);
  });
});
