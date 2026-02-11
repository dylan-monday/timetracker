export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export function isAuthorizedCronRequest(request: Request): boolean {
  // Vercel Cron requests include this header.
  if (request.headers.get("x-vercel-cron")) {
    return true;
  }

  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return false;
  }

  const provided = request.headers.get("x-cron-secret");
  return provided === expected;
}
