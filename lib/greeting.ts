type TimeOfDay = "morning" | "afternoon" | "evening";

function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function getDayName(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long" });
}

function getDayOfWeek(): number {
  return new Date().getDay();
}

function getWeekProgress(): "start" | "mid" | "end" {
  const day = getDayOfWeek();
  if (day === 1) return "start";
  if (day >= 4) return "end";
  return "mid";
}

interface GreetingTemplate {
  text: string;
  useName: boolean;
}

const morningGreetings: GreetingTemplate[] = [
  { text: "Good morning, {name}.", useName: true },
  { text: "Morning, {name}.", useName: true },
  { text: "Fresh start.", useName: false },
  { text: "{day}'s yours.", useName: false },
  { text: "Begin well.", useName: false },
  { text: "The day is unclaimed. For now.", useName: false },
  { text: "First entry of the day is the hardest.", useName: false },
];

const afternoonGreetings: GreetingTemplate[] = [
  { text: "Good afternoon, {name}.", useName: true },
  { text: "Afternoon, {name}.", useName: true },
  { text: "Steady on.", useName: false },
  { text: "Keep moving.", useName: false },
  { text: "Halfway there.", useName: false },
  { text: "Your attention is the product.", useName: false },
  { text: "The client bought the output. You still own the hours.", useName: false },
];

const tuesdayAfternoonGreetings: GreetingTemplate[] = [
  { text: "An honest Tuesday is worth more than a padded Friday.", useName: false },
];

const eveningGreetings: GreetingTemplate[] = [
  { text: "Good evening, {name}.", useName: true },
  { text: "Evening, {name}.", useName: true },
  { text: "Wrapping up.", useName: false },
  { text: "Day's end.", useName: false },
  { text: "Almost there.", useName: false },
  { text: "What did today actually look like?", useName: false },
  { text: "Close the loop.", useName: false },
  { text: "Log it before it fades.", useName: false },
];

const generalGreetings: GreetingTemplate[] = [
  { text: "Your hours. Your data.", useName: false },
  { text: "Credit the thinking, not just the doing.", useName: false },
  { text: "The unlogged hour still happened.", useName: false },
  { text: "What you track, you own.", useName: false },
  { text: "Nobody sees this but you.", useName: false },
  { text: "The quiet work counts too.", useName: false },
  { text: "Put it on record.", useName: false },
  { text: "Time spent is currency. Know your balance.", useName: false },
  { text: "The river doesn't wait.", useName: false },
  { text: "Even clocks have a point of view.", useName: false },
  { text: "What did this morning cost?", useName: false },
  { text: "Every hour has an address.", useName: false },
  { text: "The ledger is yours.", useName: false },
  { text: "Somewhere, someone is billing for this exact moment.", useName: false },
];

const weekContextGreetings: Record<"start" | "mid" | "end", GreetingTemplate[]> = {
  start: [
    { text: "New week ahead.", useName: false },
    { text: "Week begins.", useName: false },
    { text: "Make this week count.", useName: false },
  ],
  mid: [
    { text: "Midweek momentum.", useName: false },
    { text: "Keep building.", useName: false },
  ],
  end: [
    { text: "Almost there, {name}.", useName: true },
    { text: "Finish strong.", useName: false },
    { text: "Week's end in sight.", useName: false },
    { text: "Nearly done.", useName: false },
  ],
};

export function getContextualGreeting(firstName?: string): string {
  const timeOfDay = getTimeOfDay();
  const dayName = getDayName();
  const dayOfWeek = getDayOfWeek();
  const weekProgress = getWeekProgress();

  // Use a seed based on date and hour to get consistent-ish rotation
  // but still change throughout the day
  const now = new Date();
  const seed = now.getFullYear() * 10000 +
               (now.getMonth() + 1) * 100 +
               now.getDate() +
               Math.floor(now.getHours() / 3); // Changes every 3 hours

  // Get base greetings for time of day
  let greetings: GreetingTemplate[];
  switch (timeOfDay) {
    case "morning":
      greetings = [...morningGreetings];
      break;
    case "afternoon":
      greetings = [...afternoonGreetings];
      // Add Tuesday-specific greeting on Tuesdays
      if (dayOfWeek === 2) {
        greetings = [...greetings, ...tuesdayAfternoonGreetings];
      }
      break;
    case "evening":
      greetings = [...eveningGreetings];
      break;
  }

  // 40% chance to add week context greetings to the pool
  const useWeekContext = (seed % 10) < 4;
  if (useWeekContext) {
    greetings = [...greetings, ...weekContextGreetings[weekProgress]];
  }

  // 30% chance to add general greetings to the pool
  const useGeneral = (seed % 10) >= 4 && (seed % 10) < 7;
  if (useGeneral) {
    greetings = [...greetings, ...generalGreetings];
  }

  // Filter out name-based greetings if no name available
  const availableGreetings = firstName
    ? greetings
    : greetings.filter(g => !g.useName);

  // Select based on seed
  const index = seed % availableGreetings.length;
  const template = availableGreetings[index];

  // Replace placeholders
  let text = template.text;
  if (firstName) {
    text = text.replace("{name}", firstName);
  }
  text = text.replace("{day}", dayName);

  return text;
}

export function extractFirstName(user: { user_metadata?: Record<string, unknown> } | null): string | undefined {
  if (!user?.user_metadata) return undefined;

  const meta = user.user_metadata;

  // Try given_name first (most reliable for first name)
  if (typeof meta.given_name === "string" && meta.given_name.trim()) {
    return meta.given_name.trim();
  }

  // Try full_name and extract first word
  if (typeof meta.full_name === "string" && meta.full_name.trim()) {
    return meta.full_name.trim().split(/\s+/)[0];
  }

  // Try name and extract first word
  if (typeof meta.name === "string" && meta.name.trim()) {
    return meta.name.trim().split(/\s+/)[0];
  }

  return undefined;
}
