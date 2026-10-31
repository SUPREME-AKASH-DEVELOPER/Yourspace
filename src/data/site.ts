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

  /** Full address, shown once the space is ready. */
  address: '',                      // TODO: add before launch
  mapsUrl: '',                      // TODO: Google Maps link
  hours: 'Opening soon',            // TODO: real opening hours

  /**
   * The line we answer first. Call buttons and the WhatsApp hand-off use it.
   * To make the other number primary, swap the two values.
   */
  phone: '+919429690584',

  /** A second line, shown alongside the first. Leave '' if there is only one. */
  phoneAlt: '+917999656039',

  /** Usually the same digits as `phone`, without the +. */
  whatsapp: '919429690584',

  email: '',                        // TODO: optional box-office email

  /** Optional: a Google Form to send enquiries to instead of WhatsApp. */
  googleForm: '',

  /**
   * Where form submissions are actually delivered.
   *
   * This is FormSubmit, which needs no account: it posts the form to the
   * address in the URL. The FIRST submission sends that address a one-time
   * confirmation email — click the link in it, and every submission after
   * that arrives straight in the inbox.
   *
   * TODO (Akash/Tanishk):
   *   1. Submit the form once and click the confirmation link Google sends to
   *      tanishkofficial27@gmail.com. Nothing is delivered until you do.
   *   2. Then swap this for the hashed URL FormSubmit gives you
   *      (https://formsubmit.co/ajax/<random-string>), so the address is not
   *      sitting in the page source for scrapers to read.
   *   3. If you would rather have the entries in a spreadsheet, put a Google
   *      Form URL in googleForm above and leave this empty.
   *
   * Empty string = no delivery; the site falls back to a WhatsApp draft.
   */
  formEndpoint: 'https://formsubmit.co/ajax/tanishkofficial27@gmail.com',

  /** Shown to visitors when a submission could not be delivered. */
  notifyEmail: 'tanishkofficial27@gmail.com',

  /** Copied in on every submission. Comma-separated for more than one. */
  notifyCc: 'badalakki11@gmail.com',
} as const;

/** A real Indian mobile, and not the placeholder we ship with. */
const isMobile = (n: string) => /^\+91[6-9]\d{9}$/.test(n) && !n.includes('9999999999');

/** Call and WhatsApp buttons stay switched off until a real number is set. */
export const phoneIsSet = isMobile(site.phone);
export const phoneAltIsSet = isMobile(site.phoneAlt);

const pretty = (n: string) => n.replace(/^(\+91)(\d{5})(\d{5})$/, '$1 $2 $3');

export const prettyPhone = pretty(site.phone);
export const prettyPhoneAlt = pretty(site.phoneAlt);

/** Every number we publish, in the order we want people to try them. */
export const phoneNumbers = [
  ...(phoneIsSet ? [{ raw: site.phone, pretty: prettyPhone }] : []),
  ...(phoneAltIsSet ? [{ raw: site.phoneAlt, pretty: prettyPhoneAlt }] : []),
];

export const waLink = (text: string) =>
  `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(text)}`;

/** The origin we post submissions to, so the CSP can allow exactly that one. */
export const formOrigin = site.formEndpoint ? new URL(site.formEndpoint).origin : '';
