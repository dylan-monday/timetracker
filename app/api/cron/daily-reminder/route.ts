import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/server/supabase-admin";
import { isAuthorizedCronRequest } from "@/lib/server/env";
import { sendEmail } from "@/lib/server/email";

export async function POST(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminSupabaseClient();
    const appUrl = process.env.APP_URL ?? "https://time.mondayandpartners.com";
    const scheduledFor = new Date();
    scheduledFor.setMinutes(0, 0, 0);

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id,email")
      .order("created_at", { ascending: true });

    if (error) throw error;

    let sent = 0;

    for (const profile of profiles ?? []) {
      await sendEmail({
        to: profile.email,
        subject: "Do your time",
        html: `<p>Friendly 4pm nudge to log your day.</p><p><a href="${appUrl}/week">Open Time Tracker</a></p>`
      });

      await supabase.from("email_jobs").upsert(
        {
          owner_id: profile.id,
          job_kind: "daily_reminder",
          scheduled_for: scheduledFor.toISOString(),
          status: "sent",
          sent_at: new Date().toISOString(),
          payload: { source: "api/cron/daily-reminder" }
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
