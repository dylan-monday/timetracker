import { requireEnv } from "@/lib/server/env";

interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailArgs): Promise<void> {
  const apiKey = requireEnv("RESEND_API_KEY");
  const from = process.env.EMAIL_FROM ?? "M+P Time <time@mondayandpartners.com>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html
    })
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Resend error (${response.status}): ${payload}`);
  }
}
