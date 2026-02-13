interface LayoutArgs {
  preheader: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  contentHtml: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function baseLayout(args: LayoutArgs): string {
  return `
<!doctype html>
<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(args.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#eff2ec;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111318;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(args.preheader)}</div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eff2ec;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#f8faf5;border:1px solid #dde3d5;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="padding:22px 24px 14px;background:linear-gradient(130deg,#f8faf5 0%,#e8f6e4 100%);border-bottom:1px solid #dde3d5;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="left" style="font-size:13px;color:#6d737f;letter-spacing:0.3px;">${escapeHtml(args.eyebrow)}</td>
                    <td align="right">
                      <span style="display:inline-block;width:10px;height:10px;border-radius:999px;background:#63d864;box-shadow:0 0 10px rgba(99,216,100,0.7);"></span>
                    </td>
                  </tr>
                </table>
                <h1 style="margin:14px 0 0;font-size:32px;line-height:1.05;letter-spacing:-0.4px;color:#111318;">${escapeHtml(args.title)}</h1>
                <p style="margin:10px 0 0;font-size:15px;line-height:1.5;color:#4f5561;">${escapeHtml(args.subtitle)}</p>
              </td>
            </tr>

            <tr>
              <td style="padding:18px 24px 8px;">
                ${args.contentHtml}
              </td>
            </tr>

            <tr>
              <td style="padding:8px 24px 24px;">
                <a href="${escapeHtml(args.ctaHref)}" style="display:inline-block;background:#111318;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 18px;border-radius:999px;">
                  ${escapeHtml(args.ctaLabel)}
                </a>
              </td>
            </tr>

            <tr>
              <td style="padding:0 24px 22px;font-size:12px;color:#7f8592;">
                M+P Time
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

export function buildDailyReminderEmail(params: { appUrl: string; dayName?: string }): string {
  const day = params.dayName ?? new Date().toLocaleDateString("en-US", { weekday: "long" });
  const contentHtml = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0 10px;">
      <tr>
        <td style="background:#ffffff;border:1px solid #dde3d5;border-radius:12px;padding:14px 16px;font-size:14px;line-height:1.55;color:#2b3037;">
          Take a minute to capture where your ${day} went while it's still fresh.
        </td>
      </tr>
      <tr>
        <td style="font-size:13px;color:#6d737f;padding:2px 4px;">
          Quick formats: <strong>1.5</strong>, <strong>1h 30m</strong>, or <strong>90m</strong>
        </td>
      </tr>
    </table>
  `;

  return baseLayout({
    preheader: `Quick snapshot of your ${day}`,
    eyebrow: "End of Day",
    title: `How was your ${day}?`,
    subtitle: "A minute now saves you guesswork later.",
    ctaLabel: "Capture your day",
    ctaHref: `${params.appUrl}/week`,
    contentHtml
  });
}

export function buildWeeklyRecapEmail(params: {
  appUrl: string;
  weekEndingLabel: string;
  totalHours: string;
  clientHours: string;
  internalHours: string;
  exerciseHours: string;
}): string {
  const statCell = (label: string, value: string) => `
    <td style="width:50%;padding:6px;vertical-align:top;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #dde3d5;border-radius:12px;">
        <tr>
          <td style="padding:12px 14px 4px;font-size:12px;color:#6d737f;text-transform:uppercase;letter-spacing:0.45px;">${escapeHtml(label)}</td>
        </tr>
        <tr>
          <td style="padding:0 14px 12px;font-size:24px;line-height:1.1;font-weight:700;color:#111318;">${escapeHtml(value)}</td>
        </tr>
      </table>
    </td>
  `;

  const contentHtml = `
    <p style="margin:0 0 10px;font-size:14px;color:#4f5561;">Week ending ${escapeHtml(params.weekEndingLabel)}</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 -6px;border-collapse:separate;">
      <tr>
        ${statCell("Total", params.totalHours)}
        ${statCell("Client delivery", params.clientHours)}
      </tr>
      <tr>
        ${statCell("Internal", params.internalHours)}
        ${statCell("Exercise", params.exerciseHours)}
      </tr>
    </table>
  `;

  return baseLayout({
    preheader: `Your week: ${params.totalHours} captured`,
    eyebrow: "Week in Review",
    title: "Your week, wrapped",
    subtitle: "Here's where your hours went.",
    ctaLabel: "See the details",
    ctaHref: `${params.appUrl}/trends`,
    contentHtml
  });
}
