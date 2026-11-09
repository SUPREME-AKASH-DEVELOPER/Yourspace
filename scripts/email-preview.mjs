/**
 * Render both emails with a sample booking, so they can be opened in a browser.
 *   npm run email:preview
 */
import { writeFileSync } from 'node:fs';
import { customerEmail, ownerEmail } from '../api/_email.js';

const fields = {
  'Booking ref': 'YS-7K3M9Q',
  Name: 'Riya Sharma',
  Phone: '9876543210',
  Email: 'riya@example.com',
  Occasion: 'Birthday',
  'Date & time': 'Sat, 14 Nov, 7:30 PM – 9:00 PM',
  Guests: '4',
  Seating: '4 recliners',
  'Movie Space': '₹1,500',
  Notes: 'Please keep a knife for the cake.',
  Total: '₹1,500',
  Payment: 'After the call. Nothing paid.',
  Received: 'Monday, 9 November 2026 at 6:30 pm',
};
const subject = 'Booking YS-7K3M9Q — Riya Sharma · 9876543210';

writeFileSync('email/booking-notification.html', ownerEmail(fields, subject).html + '\n');
writeFileSync('email/customer-confirmation.html', customerEmail(fields, subject).html + '\n');
console.log('Wrote email/booking-notification.html and email/customer-confirmation.html');
