import { format } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";

interface UserSummary {
  userId: string;
  email: string;
  timezone: string;
  totalMinutes: number;
  internalMinutes: number;
  clientMinutes: number;
  exerciseMinutes: number;
}

function startOfWeekISO(reference = new Date()): string {
  const date = new Date(reference);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

export async function listUserSummariesForCurrentWeek(
  supabase: SupabaseClient
): Promise<UserSummary[]> {
  const startDate = startOfWeekISO();

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id,email,timezone");

  if (profilesError) throw profilesError;

  const summaries: UserSummary[] = [];

  for (const profile of profiles ?? []) {
    const { data: entries, error: entriesError } = await supabase
      .from("time_entries")
      .select("rounded_minutes,projects(name,clients(name,kind))")
      .eq("owner_id", profile.id)
      .eq("status", "approved")
      .gte("entry_date", startDate);

    if (entriesError) throw entriesError;

    let totalMinutes = 0;
    let internalMinutes = 0;
    let clientMinutes = 0;
    let exerciseMinutes = 0;

    for (const row of entries ?? []) {
      const minutes = row.rounded_minutes ?? 0;
      const project = row.projects as
        | { name?: string; clients?: { name?: string; kind?: string } | { name?: string; kind?: string }[] }
        | null;

      const clients = project?.clients;
      const client = Array.isArray(clients) ? clients[0] : clients;
      const clientName = (client?.name ?? "").toLowerCase();

      totalMinutes += minutes;

      if (client?.kind === "internal") {
        internalMinutes += minutes;
      } else {
        clientMinutes += minutes;
      }

      if (clientName.includes("exercise")) {
        exerciseMinutes += minutes;
      }
    }

    summaries.push({
      userId: profile.id,
      email: profile.email,
      timezone: profile.timezone,
      totalMinutes,
      internalMinutes,
      clientMinutes,
      exerciseMinutes
    });
  }

  return summaries;
}

export function formatHours(minutes: number): string {
  return `${(minutes / 60).toFixed(1)}h`;
}

export function weekLabel(reference = new Date()): string {
  return format(reference, "MMM d, yyyy");
}
