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
