/**
 * Site-wide settings.
 * Akash/Tanishk: these are the values to edit. Everything on the site reads
 * from here, so a number or address can never say one thing on one page and
 * something else on another.
 */
export const site = {
  name: 'YourSpace',
  city: 'Jabalpur',
  region: 'Madhya Pradesh',

  /** Full address, from Tanishk (Nov 2026). */
  address: '325, Jai Nagar Rd, near Indore Sweet, above Olympus Cafe, 2nd Floor, Labour Chowk, Yadav Colony, Jabalpur, Madhya Pradesh 482002',
  postalCode: '482002',
  mapsUrl: 'https://maps.app.goo.gl/hzK3Ksn7iNr3ubXH8',
  /** TODO(Tanishk): he wrote "12am to 12pm"; this assumes he meant the slots we sell. */
  hours: '12 PM to 12 AM, all 7 days',

  /**
   * The one number YourSpace publishes. Calls and WhatsApp both come here.
   * (Akash/Tanishk, Nov 2026: one number everywhere, so nobody has to guess
   * which line to use. The old +91 94296 90584 is off the site entirely.)
   */
  phone: '+917999656039',

  /** A second line, shown alongside the first. '' — there is only one. */
  phoneAlt: '',

  email: '',                        // TODO: optional box-office email

  /**
   * WHATSAPP — "For more information, contact us on WhatsApp"
   *
   * Left as '' it follows `phone` above, which is what we want: the same
   * number for calls and for WhatsApp. Set it only if WhatsApp ever moves to
   * a different line from the one we answer calls on.
   *
   * WhatsApp carries two things: questions, and a finished booking handed
   * over from the confirmation screen. Neither is a payment — bookings are
   * still recorded through the booking form, and payment is checked in the
   * bank app before anything is confirmed.
   */
  whatsapp: '',
  /** What the chat opens with. The customer can edit it before sending. */
  whatsappMessage: "Hi YourSpace, I'd like more information about booking a private session.",

  /** Optional: a Google Form to send enquiries to instead of WhatsApp. */
  googleForm: '',

  /**
   * WHO GETS THE FORMS
   *
   * notifyPrimary is the inbox FormSubmit needs confirmed. The very first
   * submission sends that address a one-time link, and nothing is delivered
   * to anyone until it is clicked — so whoever owns this address has to click
   * it once. (A Web3Forms key below skips that step entirely.)
   *
   * notifyCc rides along on every submission and needs no confirmation of
   * its own.
   */
  notifyPrimary: 'tanishkofficial27@gmail.com',

  /** Copied in on every submission. Comma-separated for more than one. */
  notifyCc: 'badalakki11@gmail.com',

  /** Offered to visitors if a submission could not be delivered at all. */
  notifyEmail: 'tanishkofficial27@gmail.com',

  /**
   * HOW THE EMAIL IS SENT
   *
   * Leave this empty and the site uses FormSubmit, which needs no account but
   * rate-limits hard and has to be confirmed by clicking a link first.
   *
   * Paste a Web3Forms access key here and it uses that instead: free, 250
   * submissions a month, no confirmation step, and far steadier.
   * Get one in under a minute at https://web3forms.com — enter the address
   * the forms should reach, and the key is emailed to you.
   */
  web3formsKey: '4943e365-6fd6-49d6-a37a-1b35fd92d625',

  /**
   * HOW PEOPLE PAY
   *
   * After a booking is sent, the last screen offers UPI: a pay link on phones,
   * a QR code on computers, and the ID to copy. The amount is filled in.
   *
   * The site cannot see whether money arrived. It asks for the UPI reference
   * and emails it to you marked UNVERIFIED — check your bank app before
   * confirming the booking. Leave upiId empty to switch UPI off entirely.
   *
   * TODO(owner): this is a personal account. Google Pay and PhonePe can block
   * or warn on pay-links to personal IDs, and UPI caps how much a personal ID
   * receives in a day. A business/merchant UPI ID avoids both.
   */
  upiId: 'tanishksharma062004@okhdfcbank',
  /** The name shown in the payer's UPI app. */
  upiPayee: 'Tanishk Sharma',
} as const;

/** A real Indian mobile, and not the placeholder we ship with. */
const isMobile = (n: string) => /^\+91[6-9]\d{9}$/.test(n) && !n.includes('9999999999');

/** Call and WhatsApp buttons stay switched off until a real number is set. */
export const phoneIsSet = isMobile(site.phone);
export const phoneAltIsSet = isMobile(site.phoneAlt);

const pretty = (n: string) => n.replace(/^(\+91)(\d{5})(\d{5})$/, '$1 $2 $3');

export const prettyPhone = pretty(site.phone);
export const prettyPhoneAlt = pretty(site.phoneAlt);

/** The WhatsApp number in use: its own if set, otherwise the main line. */
const waNumber = site.whatsapp || site.phone;
export const whatsappIsSet = isMobile(waNumber);

/**
 * WhatsApp's official click-to-chat link (https://wa.me/<number>?text=…).
 * Opens the app on phones and WhatsApp Web / Desktop on computers.
 * Empty when no valid number is set, and every WhatsApp button then hides.
 */
export function whatsappLink(message: string = site.whatsappMessage): string {
  if (!whatsappIsSet) return '';
  const digits = waNumber.replace(/\D/g, '');
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}

/** Every number we publish, in the order we want people to try them. */
export const phoneNumbers = [
  ...(phoneIsSet ? [{ raw: site.phone, pretty: prettyPhone }] : []),
  ...(phoneAltIsSet ? [{ raw: site.phoneAlt, pretty: prettyPhoneAlt }] : []),
];


/**
 * The FormSubmit endpoint, used only when no Web3Forms key is set.
 * Built from notifyPrimary so the address and the endpoint cannot disagree.
 */
export const formEndpoint = site.notifyPrimary
  ? `https://formsubmit.co/ajax/${site.notifyPrimary}`
  : '';

/**
 * The one origin submissions are posted to, so the CSP can allow exactly
 * that and nothing else. Follows whichever service is in use.
 */
export const formOrigin = site.web3formsKey
  ? 'https://api.web3forms.com'
  : (formEndpoint ? new URL(formEndpoint).origin : '');
