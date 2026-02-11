const FIFTEEN_MINUTES = 15;

export function roundToQuarterHour(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return 0;
  }

  return Math.round(minutes / FIFTEEN_MINUTES) * FIFTEEN_MINUTES;
}

export function parseTimeInputToMinutes(raw: string): number | null {
  const input = raw.trim().toLowerCase();
  if (!input) {
    return null;
  }

  if (/^\d*\.?\d+$/.test(input)) {
    const numeric = Number.parseFloat(input);
    if (Number.isNaN(numeric)) return null;

    // Heuristic: values <= 24 are likely hours, values > 24 are likely minutes.
    return numeric <= 24 ? numeric * 60 : numeric;
  }

  let total = 0;
  let matched = false;

  const hourMatches = input.matchAll(/(\d*\.?\d+)\s*h(?:ours?)?/g);
  for (const match of hourMatches) {
    matched = true;
    total += Number.parseFloat(match[1]) * 60;
  }

  const minuteMatches = input.matchAll(/(\d*\.?\d+)\s*m(?:in(?:ute)?s?)?/g);
  for (const match of minuteMatches) {
    matched = true;
    total += Number.parseFloat(match[1]);
  }

  if (!matched) {
    return null;
  }

  return total;
}

export function parseAndRoundTimeInput(raw: string): number | null {
  const minutes = parseTimeInputToMinutes(raw);
  if (minutes === null) {
    return null;
  }

  return roundToQuarterHour(minutes);
}

export function minutesToDisplay(minutes: number): string {
  if (!minutes) {
    return "-";
  }

  const hours = minutes / 60;
  if (Number.isInteger(hours)) {
    return `${hours}h`;
  }

  return `${hours.toFixed(2).replace(/\.00$/, "")}h`;
}
