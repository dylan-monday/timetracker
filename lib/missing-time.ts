const DAY_START = 8;
const DAY_END = 17;

export function targetWorkingMinutes(): number {
  return (DAY_END - DAY_START) * 60;
}

export function missingMinutes(loggedMinutes: number): number {
  return Math.max(0, targetWorkingMinutes() - loggedMinutes);
}

export function missingState(loggedMinutes: number): "ok" | "attention" | "gap" {
  const missing = missingMinutes(loggedMinutes);

  if (missing === 0) return "ok";
  if (missing <= 90) return "attention";
  return "gap";
}
