export interface FaqItem { q: string; a: string }
export interface FaqSection { n: string; label: string; items: FaqItem[] }

export const faqSections: FaqSection[] = [
  {
    n: '01', label: 'Money',
    items: [
      { q: 'What does it cost?',
        a: 'Movie Space is ₹1,500 for up to 5 guests and ₹1,700 for 6 or 7. Celebration & Date Night is ₹1,500 plus the decoration you choose. Karaoke is ₹150 per person for 30 minutes, with a minimum of 3. Cake, flowers and a photoshoot are optional extras, and taxes and applicable charges are additional.' },
      { q: 'When and how do I pay?',
        a: "By UPI. When you finish a booking you can pay straight away — we show you a QR code and a pay link with the amount filled in — or choose to pay after we call. Either way we confirm the slot with you, and if we can't give it to you, you get a full refund. We never ask for card details." },
      { q: 'I paid — is my booking confirmed?',
        a: "Once the payment shows in our account, yes. Send us the UPI reference when the booking screen asks for it, so we can match your payment quickly. Until we've seen it, your booking shows as awaiting confirmation." },
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
        a: "Up to 7 can book online. Karaoke needs at least 3 — for fewer, call us and we'll see what we can do. Date Night is set up for two." },
      { q: 'How long is a session?',
        a: '90 minutes from the time your slot starts, and 30 minutes for karaoke. If you need longer, ask us — if the slot after yours is free, we can usually work something out.' },
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
        a: "We're at 325, Jai Nagar Rd, near Indore Sweet, above Olympus Cafe, 2nd Floor, Labour Chowk, Jabalpur. Sessions run 12 PM to 12 AM, all 7 days, and we confirm your slot when we call you." },
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
