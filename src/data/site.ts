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
   * The line we answer first. The Call buttons use it.
   * To make the other number primary, swap the two values.
   */
  phone: '+919429690584',

  /** A second line, shown alongside the first. Leave '' if there is only one. */
  phoneAlt: '+917999656039',

  email: '',                        // TODO: optional box-office email

  /** Optional: a Google Form to send enquiries to instead of WhatsApp. */
  googleForm: '',

  /**
   * WHO GETS THE FORMS
   *
   * notifyPrimary is the inbox FormSubmit needs confirmed. The very first
   * submission sends that address a one-time link; until someone clicks it,
   * nothing is delivered to anyone. Make it an inbox YOU can open, so you are
   * not waiting on someone else to switch the site on.
   *
   * notifyCc rides along on every submission and needs no confirmation of
   * its own — so Tanishk and Badal start receiving the moment you click.
   */
  notifyPrimary: 'akash@ethixweb.com',          // ← the inbox you will confirm from

  /** Copied in on every submission. Comma-separated for more than one. */
  notifyCc: 'tanishkofficial27@gmail.com, badalakki11@gmail.com',

  /** Offered to visitors if a submission could not be delivered at all. */
  notifyEmail: 'tanishkofficial27@gmail.com',
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


/**
 * Where submissions are posted. Built from notifyPrimary so the address and
 * the endpoint can never disagree.
 *
 * TODO (Akash): once FormSubmit is confirmed it offers a hashed URL
 * (https://formsubmit.co/ajax/<random-string>). Put that here instead and
 * delete the line below — the repo is public, and this leaves the address
 * in the page source for scrapers to read.
 */
export const formEndpoint = site.notifyPrimary
  ? `https://formsubmit.co/ajax/${site.notifyPrimary}`
  : '';

/** The origin we post submissions to, so the CSP can allow exactly that one. */
export const formOrigin = formEndpoint ? new URL(formEndpoint).origin : '';
