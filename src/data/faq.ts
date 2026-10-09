export interface FaqItem { q: string; a: string }
export interface FaqSection { n: string; label: string; items: FaqItem[] }

export const faqSections: FaqSection[] = [
  {
    n: '01', label: 'Money',
    items: [
      { q: 'What does the ₹1,499 include?',
        a: 'A private session in the room for up to 4 guests, with the screen, sound and seating. Additional guests are ₹300 each within room capacity. Decor, food, flowers and other extras are priced separately, and taxes and applicable charges are additional.' },
      { q: 'Does pre-booking cost anything?',
        a: "No. Pre-booking is free and takes no payment — it tells us which dates and experiences people want. We call you to confirm availability, and nothing is charged until you've confirmed your booking with us directly." },
      { q: 'When and how do I actually pay?',
        a: "After we've spoken and confirmed your slot. We'll tell you the exact amount on that call, including taxes and anything you've added. Nothing is taken through this website." },
      { q: 'Will the price change after I book?',
        a: "Not unless you change the booking. If you add guests, decor or food later, we'll tell you what it costs before we add it." },
    ],
  },
  {
    n: '02', label: 'The room',
    items: [
      { q: 'Is the room really private?',
        a: 'Yes. For the length of your session the room is reserved for your group only — no shared seating and no other bookings running alongside yours.' },
      { q: 'How many people can come?',
        a: "The base price covers up to 4 guests, and you can add more at ₹300 each up to the room's capacity of 12. Tell us your group size when you pre-book and we'll confirm it fits." },
      { q: 'How long is a session?',
        a: '2 hours 30 minutes, from the time your slot starts. If you need longer, ask us — if the slot after yours is free, we can usually work something out.' },
      { q: 'Can we choose what to watch?',
        a: "Yes — bring whatever you want to play, and we'll help you get it on the screen. Please make sure you have the right to play it." },
    ],
  },
  {
    n: '03', label: 'Bringing things',
    items: [
      { q: 'Can we bring our own cake, food or decor?',
        a: "Tell us what you're planning when you pre-book and we'll confirm what's allowed. We also offer cake, food and decor as add-ons if you'd rather we set it up." },
      { q: 'Can we decorate the room ourselves?',
        a: "Usually yes, within reason and within your session time. Check with us first so we can tell you what won't work with the room or the equipment." },
      { q: 'Can we take photos and video?',
        a: 'Of your own group, as much as you like. We also offer a 15-minute photo shoot as an add-on.' },
    ],
  },
  {
    n: '04', label: 'Plans changing',
    items: [
      { q: 'Can I reschedule or cancel?',
        a: "Yes. Tell us as early as you can and we'll move your slot if one is free. The full terms are on our <a href=\"/refunds/\">cancellations page</a>." },
      { q: "What if I'm running late?",
        a: "Call us. Your slot has a fixed end time because of the booking after yours, but we'll do what we can." },
    ],
  },
  {
    n: '05', label: 'Finding us',
    items: [
      { q: 'Where are you, and when are you open?',
        a: "We're in Jabalpur and opening soon. Pre-book now and we'll share the exact address and your confirmed slot when we call you." },
      { q: 'Can I see the room before I book?',
        a: "Once we're open, yes — just ask on the call. Before that there isn't much to see, so we'd rather not waste your trip." },
    ],
  },
];

/** The six most useful questions, for the home page. */
export const homeFaq: FaqItem[] = [
  faqSections[0].items[0], faqSections[1].items[0], faqSections[1].items[1],
  faqSections[2].items[0], faqSections[4].items[0], faqSections[0].items[1],
];
