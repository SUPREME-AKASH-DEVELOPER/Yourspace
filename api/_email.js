/**
 * The two emails YourSpace sends, as functions.
 *
 *   ownerEmail()    → the lead, to the team: who, what, and Call / WhatsApp buttons
 *   customerEmail() → the confirmation, to the person who filled the form in
 *
 * The HTML is built the way email has to be built: tables, inline styles, 600px.
 * email/*.html are rendered samples; run `npm run email:preview` after a change.
 *
 * Everything that came from a visitor passes through esc() before it reaches
 * the HTML. Files starting with "_" under api/ are not routes on Vercel.
 */

export const SITE_ORIGIN = 'https://www.yourspacejbp.com';
const PHONE_PRETTY = '+91 79996 56039';
const PHONE_RAW = '+917999656039';

const INK = '#0C0B09';
const CARD = '#131110';
const LINE = '#2A2724';
const CREAM = '#EDE6D8';
const SOFT = '#C8BFB1';
const MUTED = '#8E857A';
const AMBER = '#E0A542';
const SANS = 'Helvetica,Arial,sans-serif';
const MONO = "'Courier New',Courier,monospace";

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Fields that are about the send itself, not the booking. */
const META = new Set(['Name', 'Phone', 'Email', 'Received', 'Came from', 'Payment', 'Status',
  'Message', 'Notes', 'What they are planning']);

/** Written in the visitor's own words, so never repeated to an inbox they name. */
const THEIR_WORDS = ['Message', 'What they are planning', 'Notes'];

export function detailRows(fields) {
  return Object.entries(fields).filter(([key]) => !META.has(key));
}

/** What sort of submission this is, from the fields it carries. */
export function kindOf(fields, subject = '') {
  if (fields['UPI reference (UTR)']) return 'UPI payment claimed';
  if (fields['Booking ref']) return 'Booking';
  const known = ['Pre-booking', 'Enquiry', 'Message', 'Call-back request'];
  return known.find((k) => subject.startsWith(k)) ?? 'Enquiry';
}

/** The last ten digits of an Indian mobile, or '' if it is not one. */
export function mobileDigits(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '').slice(-10);
  return /^[6-9]\d{9}$/.test(digits) ? digits : '';
}

function shell(preview, inner) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>YourSpace Jabalpur</title>
</head>
<body style="margin:0;padding:0;background:${INK};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${INK};padding:20px 8px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${CARD};border:1px solid ${LINE};border-radius:4px;">
${inner}
</table>
</td></tr>
</table>
</body>
</html>`;
}

function masthead(kind) {
  return `<tr><td style="padding:24px 28px 18px;border-bottom:1px solid ${LINE};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td style="font-family:${SANS};font-size:17px;font-weight:bold;letter-spacing:-0.3px;color:${CREAM};">YourSpace
<div style="font-family:${MONO};font-size:10px;font-weight:normal;letter-spacing:3px;text-transform:uppercase;color:${MUTED};padding-top:5px;">Jabalpur</div></td>
<td align="right" style="font-family:${MONO};font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:${AMBER};">${esc(kind)}</td>
</tr></table></td></tr>`;
}

function slip(rows) {
  if (!rows.length) return '';
  const body = rows.map(([label, value], i) => {
    const top = i ? `border-top:1px solid ${LINE};` : '';
    const strong = label === 'Total';
    const bg = strong ? 'background:#17140F;' : '';
    return `<tr>
<td style="font-family:${MONO};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${strong ? AMBER : MUTED};padding:12px 12px 12px 16px;width:36%;${top}${bg}">${esc(label)}</td>
<td style="font-family:${SANS};font-size:15px;color:${CREAM};padding:12px 16px;word-break:break-word;${top}${bg}${strong ? 'font-weight:bold;' : ''}">${esc(value)}</td>
</tr>`;
  }).join('');
  return `<tr><td style="padding:22px 28px 6px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${LINE};border-radius:3px;">${body}</table>
</td></tr>`;
}

function footer(lines) {
  return `<tr><td style="padding:22px 28px 26px;border-top:1px solid ${LINE};font-family:${MONO};font-size:11px;line-height:1.7;letter-spacing:0.3px;color:${MUTED};">${lines.join('<br>')}</td></tr>`;
}

function button(href, label, primary) {
  const style = primary
    ? `background:${AMBER};border-radius:3px;`
    : `border:1px solid #3A3633;border-radius:3px;`;
  return `<td style="${style}"><a href="${esc(href)}" style="display:inline-block;padding:13px 22px;font-family:${MONO};font-size:12px;letter-spacing:1.6px;text-transform:uppercase;font-weight:bold;color:${primary ? INK : CREAM};text-decoration:none;">${esc(label)}</a></td>`;
}

/** The lead, for the team. */
export function ownerEmail(fields, subject) {
  const kind = kindOf(fields, subject);
  const digits = mobileDigits(fields.Phone);
  const name = fields.Name || 'Someone';
  const words = THEIR_WORDS.map((k) => fields[k]).filter(Boolean);
  const warning = fields.Status || fields.Payment || '';
  const rows = [
    ...detailRows(fields),
    ...(fields.Email ? [['Email', fields.Email]] : []),
  ];

  const html = shell(`${name} · ${fields.Phone ?? ''}`, `
${masthead(kind)}
<tr><td style="padding:26px 28px 4px;">
<div style="font-family:${SANS};font-size:26px;font-weight:bold;letter-spacing:-0.6px;line-height:1.15;color:${CREAM};">${esc(name)}</div>
${fields.Phone ? `<div style="padding-top:8px;font-family:${MONO};font-size:15px;color:${AMBER};">${esc(fields.Phone)}</div>` : ''}
</td></tr>
${slip(rows)}
${words.length ? `<tr><td style="padding:14px 28px 4px;">
<div style="border:1px solid #4A3A1C;border-left:3px solid ${AMBER};border-radius:3px;background:#17140F;padding:16px 18px;">
<div style="font-family:${MONO};font-size:10px;letter-spacing:2.2px;text-transform:uppercase;color:${AMBER};padding-bottom:9px;">In their words</div>
<div style="font-family:${SANS};font-size:15px;line-height:1.62;color:${SOFT};white-space:pre-wrap;">${words.map(esc).join('<br><br>')}</div>
</div></td></tr>` : ''}
${warning ? `<tr><td style="padding:14px 28px 4px;font-family:${SANS};font-size:14px;line-height:1.6;color:${SOFT};"><b style="color:${AMBER};">Payment:</b> ${esc(warning)}</td></tr>` : ''}
${digits ? `<tr><td style="padding:22px 28px 22px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
${button(`tel:+91${digits}`, 'Call', true)}
<td style="width:10px;">&nbsp;</td>
${button(`https://wa.me/91${digits}`, 'WhatsApp', false)}
</tr></table></td></tr>` : ''}
${footer([
    ...(fields.Received ? [`Received ${esc(fields.Received)}`] : []),
    ...(fields['Came from'] ? [`From the page ${esc(fields['Came from'])}`] : []),
    'A UPI payment is never confirmed by the website. Find it in the bank app first.',
  ])}`);

  const text = [
    kind, '',
    `Name: ${name}`,
    ...(fields.Phone ? [`Phone: ${fields.Phone}`] : []),
    ...rows.map(([k, v]) => `${k}: ${v}`),
    ...THEIR_WORDS.filter((k) => fields[k]).map((k) => `${k}: ${fields[k]}`),
    ...(warning ? [`Payment: ${warning}`] : []),
    ...(fields.Received ? [`Received: ${fields.Received}`] : []),
  ].join('\n');

  return { html, text };
}

/**
 * The confirmation, for the visitor.
 *
 * Anyone can type anyone's address into a form, so this email must be useless
 * for reaching a stranger: free-text fields are left out, and a value carrying
 * a link makes canEmailCustomer() refuse to send it at all.
 */
export function customerEmail(fields, subject) {
  const kind = kindOf(fields, subject);
  const isBooking = kind === 'Booking';
  const first = String(fields.Name ?? '').trim().split(/\s+/)[0] || 'there';
  const paysByUpi = String(fields.Payment ?? '').startsWith('Customer chose UPI');
  const noun = kind === 'Message' ? 'message' : kind.toLowerCase();
  const rows = detailRows(fields);
  const ref = fields['Booking ref'];

  const payLine = paysByUpi
    ? 'Your booking is <b style="color:' + CREAM + ';">awaiting confirmation</b>, not paid. If you have paid by UPI, we confirm it as soon as the payment shows in our account.'
    : '<b style="color:' + CREAM + ';">Nothing has been charged</b>, and nothing will be until you have confirmed with us.';
  const payText = paysByUpi
    ? 'Your booking is awaiting confirmation, not paid. If you have paid by UPI, we confirm it as soon as the payment shows in our account.'
    : 'Nothing has been charged, and nothing will be until you have confirmed with us.';

  const html = shell(paysByUpi ? 'We have your booking. We will call you to confirm.' : "We'll call you to confirm. Nothing has been charged.", `
${masthead(isBooking && ref ? ref : kind)}
<tr><td align="center" style="padding:30px 34px 4px;font-family:${SANS};font-size:28px;font-weight:bold;letter-spacing:-0.8px;line-height:1.16;color:${CREAM};">Thanks, ${esc(first)}.<br>We have your ${esc(noun)}.</td></tr>
<tr><td align="center" style="padding:14px 38px 2px;font-family:${SANS};font-size:15px;line-height:1.68;color:${SOFT};">We'll call you on <span style="color:${CREAM};">${esc(fields.Phone ?? 'the number you gave us')}</span> to confirm.</td></tr>
${slip(rows)}
<tr><td align="center" style="padding:20px 38px 8px;font-family:${SANS};font-size:14px;line-height:1.68;color:${SOFT};">${payLine} If your plans change, just reply to this email.</td></tr>
<tr><td align="center" style="padding:16px 28px 28px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>
${button(`tel:${PHONE_RAW}`, 'Call us', true)}
<td style="width:10px;">&nbsp;</td>
${button(`${SITE_ORIGIN}/`, 'Visit the site', false)}
</tr></table></td></tr>
${footer([`YourSpace · Jabalpur, Madhya Pradesh · ${PHONE_PRETTY}`, 'You are getting this because this address was entered on our booking form.'])}`);

  const text = [
    `Thanks, ${first}. We have your ${noun}.`, '',
    `We'll call you on ${fields.Phone ?? 'the number you gave us'} to confirm.`, '',
    ...rows.map(([k, v]) => `${k}: ${v}`), '',
    payText,
    'If your plans change, just reply to this email.', '',
    `YourSpace, Jabalpur · ${PHONE_PRETTY}`,
  ].join('\n');

  return {
    html, text,
    subject: isBooking && ref ? `Your YourSpace booking ${ref}` : `We have your ${noun} | YourSpace Jabalpur`,
  };
}

const LINKISH = /https?:|:\/\/|www\.|<|>|\b[\w-]+\.(com|net|org|in|io|co|xyz|ru|top|link|info|me)\b/i;

/** Only send to a visitor when the email reads as ours, with no one's link in it. */
export function canEmailCustomer(fields) {
  if (!/^[^@\s,;<>]+@[^@\s,;<>]+\.[^@\s,;<>]+$/.test(fields.Email ?? '')) return false;
  if (fields['UPI reference (UTR)']) return false;
  if (!mobileDigits(fields.Phone)) return false;
  return [['Name', fields.Name], ...detailRows(fields)]
    .every(([, value]) => !LINKISH.test(String(value ?? '')));
}
