/**
 * Footer Messages
 *
 * These appear one at a time at the bottom of the week view.
 * Edit content/footer-messages.md for the source of truth and documentation.
 *
 * Messages with an author are displayed with attribution.
 * Messages without an author are product-voice statements.
 */

export interface FooterMessage {
  text: string;
  author?: string;
}

export const FOOTER_MESSAGES: FooterMessage[] = [
  // Product Voice (no attribution)
  { text: "Non-billable time isn't wasted time." },
  { text: "The best ideas rarely happen at a desk." },
  { text: "You don't charge by the hour. Why track like you do?" },
  { text: "A slow afternoon might be the most productive thing you do this week." },
  { text: "Knowing where your time goes isn't about accountability. It's about choices." },
  { text: "The meeting that ran long isn't the problem. Not knowing it ran long is." },
  { text: "Creative work doesn't fit in 15-minute increments. But tracking it helps you protect it." },
  { text: "This isn't a timesheet. It's a mirror." },
  { text: "Rest is not the absence of work. It's part of the work." },
  { text: "If you're hiding hours, the system is broken. Not you." },
  { text: "Nobody does their best work at 100% utilization." },
  { text: "The hour you spent thinking was not an hour wasted." },
  { text: "Time tracked honestly is the only kind worth tracking." },
  { text: "Your afternoon walk might be the most valuable meeting you take today." },
  { text: "Efficiency is not the goal. Clarity is." },
  { text: "The point isn't to fill every hour. It's to know what you filled them with." },
  { text: "A week with white space in it is not a failed week." },
  { text: "You can't improve what you won't look at honestly." },
  { text: "We don't track time to bill more. We track time to understand better." },
  { text: "The work that doesn't show up on a timesheet is often the work that matters most." },
  { text: "Your attention is the most expensive thing you sell. Know where it goes." },
  { text: "An honest 6-hour day beats a fictional 8-hour day every time." },
  { text: "Not everything that counts can be counted. Track it anyway." },
  { text: "Busy is not a strategy." },
  { text: "The gap between meetings is where the real work happens." },
  { text: "Time you gave yourself is still time well spent." },
  { text: "This tool works better when you stop performing for it." },
  { text: "A light week and a lazy week are not the same thing." },
  { text: "We're not measuring productivity. We're building self-awareness." },
  { text: "The client isn't buying your hours. They're buying what you do with them." },
  { text: "Protect your thinking time the way you protect your deadlines." },
  { text: "You don't owe anyone a full grid. You owe yourself an honest one." },
  { text: "What you choose not to work on matters as much as what you do." },
  { text: "If it felt like a slow day, it probably wasn't." },
  { text: "The best agencies know where their time goes. The rest guess." },
  { text: "You're not behind. You're just not done yet." },
  { text: "Track the recharge. It's what makes the output possible." },
  { text: "The point of this tool is to make itself take less than two minutes a day." },
  { text: "Where your time goes is where your life goes." },
  { text: "What are you giving your time to?" },

  // Quotes with attribution
  { text: "There are no rules here — we're trying to accomplish something.", author: "Thomas Edison" },
  { text: "The work you do while you procrastinate is probably the work you should be doing for the rest of your life.", author: "Jessica Hische" },
  { text: "Creativity is the residue of time wasted.", author: "Albert Einstein" },
  { text: "How we spend our days is, of course, how we spend our lives.", author: "Annie Dillard" },
  { text: "The cost of a thing is the amount of life you exchange for it.", author: "Henry David Thoreau" },
  { text: "Almost everything will work again if you unplug it for a few minutes. Including you.", author: "Anne Lamott" },
  { text: "I have made this longer than usual because I have not had time to make it shorter.", author: "Blaise Pascal" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "You can't use up creativity. The more you use, the more you have.", author: "Maya Angelou" },
  { text: "Do not hurry; do not rest.", author: "Goethe" },
];

/**
 * Get a random footer message.
 * Uses a seeded random based on the current date so the message
 * stays consistent throughout the day but changes daily.
 */
export function getDailyMessage(): FooterMessage {
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const index = seed % FOOTER_MESSAGES.length;
  return FOOTER_MESSAGES[index];
}

/**
 * Get a random footer message (changes on each call).
 */
export function getRandomMessage(): FooterMessage {
  return FOOTER_MESSAGES[Math.floor(Math.random() * FOOTER_MESSAGES.length)];
}
