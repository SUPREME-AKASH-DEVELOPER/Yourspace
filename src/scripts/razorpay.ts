/**
 * Online payment, through Razorpay Checkout.
 *
 *   1. /api/pay prices the booking on the server and opens a Razorpay order.
 *   2. Razorpay's own checkout takes the payment (UPI, card, netbanking) in its
 *      window, so no card or bank detail ever touches this site.
 *   3. /api/pay checks Razorpay's signature and emails the team that it is paid.
 *
 * Only step 3 makes anything "paid". A payment the browser reports but the
 * server cannot verify is said plainly, with a number to call.
 */

const CHECKOUT_JS = 'https://checkout.razorpay.com/v1/checkout.js';

export interface PayRequest {
  ref: string;
  name: string; phone: string; email: string;
  setup: string; guests: number; slot: string; decor: string; addons: string[];
  summary: string;
  /** What the page showed. The server's own price is what is charged. */
  expected: number;
}

export type Paid =
  | { ok: true; paymentId: string; amount: number }
  | { ok: false; reason: 'dismissed' | 'failed' | 'unverified' | 'unavailable' | 'offline' };

interface RazorpayResponse { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }
interface RazorpayInstance { open(): void; on(event: string, cb: (r: unknown) => void): void }
declare global { interface Window { Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance } }

let loading: Promise<boolean> | null = null;

function loadCheckout(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  loading ??= new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = CHECKOUT_JS;
    s.async = true;
    s.onload = () => resolve(Boolean(window.Razorpay));
    s.onerror = () => { loading = null; resolve(false); };
    document.head.appendChild(s);
  });
  return loading;
}

async function post(body: Record<string, unknown>): Promise<{ status: number; data: Record<string, any> }> {
  const res = await fetch('/api/pay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

export async function openCheckout(req: PayRequest): Promise<Paid> {
  const [ready, order] = await Promise.all([
    loadCheckout(),
    post({ step: 'order', ...req }).catch(() => null),
  ]);
  if (!order) return { ok: false, reason: 'offline' };
  if (order.status === 503 || order.status === 404) return { ok: false, reason: 'unavailable' };
  if (!order.data.success || !order.data.order_id) return { ok: false, reason: order.status >= 500 ? 'offline' : 'unavailable' };
  if (!ready || !window.Razorpay) return { ok: false, reason: 'offline' };

  const amount = Number(order.data.amount);
  if (amount !== req.expected) console.warn(`Server priced ${req.ref} at ₹${amount}, the page showed ₹${req.expected}.`);

  return new Promise<Paid>((resolve) => {
    let settled = false;
    const done = (p: Paid) => { if (!settled) { settled = true; resolve(p); } };

    const rzp = new window.Razorpay!({
      key: order.data.key,
      order_id: order.data.order_id,
      amount: amount * 100,
      currency: 'INR',
      name: 'YourSpace Jabalpur',
      description: `Booking ${req.ref}`,
      prefill: { name: req.name, email: req.email, contact: req.phone.replace(/\D/g, '').slice(-10) },
      notes: { booking_ref: req.ref },
      theme: { color: '#E0A542' },
      modal: { ondismiss: () => done({ ok: false, reason: 'dismissed' }), confirm_close: true },
      handler: async (r: RazorpayResponse) => {
        // Razorpay says it is paid; our server has to agree before we do.
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const v = await post({
              step: 'verify',
              order_id: r.razorpay_order_id,
              payment_id: r.razorpay_payment_id,
              signature: r.razorpay_signature,
            });
            if (v.data.success) return done({ ok: true, paymentId: r.razorpay_payment_id, amount: Number(v.data.amount) });
            if (v.status < 500) break;
          } catch {}
          await new Promise((w) => setTimeout(w, 1500 * (attempt + 1)));
        }
        done({ ok: false, reason: 'unverified' });
      },
    });
    // a declined card or failed UPI: Razorpay lets them retry inside its own
    // window, so this only settles the promise if they then close it
    rzp.on('payment.failed', () => { /* the checkout shows the error and offers a retry */ });
    rzp.open();
  });
}
