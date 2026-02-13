import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/server/supabase-admin";
import { isAuthorizedCronRequest } from "@/lib/server/env";
import { sendEmail } from "@/lib/server/email";
import { formatHours, listUserSummariesForCurrentWeek, weekLabel } from "@/lib/server/time-report";
import { buildWeeklyRecapEmail } from "@/lib/server/email-templates";

export async function POST(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminSupabaseClient();
    const summaries = await listUserSummariesForCurrentWeek(supabase);
    const scheduledFor = new Date();
    scheduledFor.setMinutes(0, 0, 0);

    let sent = 0;

    for (const summary of summaries) {
      await sendEmail({
        to: summary.email,
        subject: "Your week, wrapped",
        html: buildWeeklyRecapEmail({
          appUrl: process.env.APP_URL ?? "https://time.mondayandpartners.com",
          weekEndingLabel: weekLabel(),
          totalHours: formatHours(summary.totalMinutes),
          clientHours: formatHours(summary.clientMinutes),
          internalHours: formatHours(summary.internalMinutes),
          exerciseHours: formatHours(summary.exerciseMinutes)
        })
      });

      await supabase.from("email_jobs").upsert(
        {
          owner_id: summary.userId,
          job_kind: "weekly_recap",
          scheduled_for: scheduledFor.toISOString(),
          status: "sent",
          sent_at: new Date().toISOString(),
          payload: { source: "api/cron/weekly-recap" }
        },
        {
          onConflict: "owner_id,job_kind,scheduled_for"
        }
      );

      sent += 1;
    }

    return NextResponse.json({ ok: true, sent });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
