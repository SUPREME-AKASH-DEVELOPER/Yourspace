export interface NavItem { href: string; label: string; n: string; blurb: string }

export const primaryNav: NavItem[] = [
  { href: '/programme/', label: 'Programme', n: '01', blurb: 'Six ways to use the room' },
  { href: '/room/',      label: 'The room',  n: '02', blurb: "What you're walking into" },
  { href: '/tickets/',   label: 'Tickets',   n: '03', blurb: 'From ₹1,499 a session' },
  { href: '/faq/',       label: 'Questions', n: '04', blurb: 'Answered plainly' },
];

export const menuExtra: NavItem[] = [
  { href: '/about/',   label: 'About',   n: '05', blurb: 'Who we are' },
  { href: '/contact/', label: 'Contact', n: '06', blurb: 'Talk to a human' },
  { href: '/book/',    label: 'Book',    n: '07', blurb: 'No payment today' },
];
