import { createClient } from "@supabase/supabase-js";
import { addDays, endOfDay, format, startOfDay, startOfWeek } from "date-fns";
import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/server/supabase-admin";
import { requireEnv } from "@/lib/server/env";

interface SyncRequestBody {
  providerAccessToken?: string;
}

interface GoogleCalendarList {
  items?: Array<{
    id: string;
    summary?: string;
    primary?: boolean;
    accessRole?: string;
  }>;
}

interface GoogleEventsList {
  items?: GoogleEventItem[];
}

interface GoogleEventItem {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  htmlLink?: string;
  organizer?: { email?: string };
  attendees?: Array<{ email?: string }>;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

interface CandidateProject {
  id: string;
  name: string;
  client_id: string;
  clients: { id: string; name: string } | { id: string; name: string }[] | null;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9@\s.-]/g, " ");
}

function roundToNearest15(minutes: number): number {
  if (minutes <= 0) return 0;
  return Math.max(15, Math.round(minutes / 15) * 15);
}

function parseGoogleDateTime(value?: { dateTime?: string; date?: string }): Date | null {
  if (!value) return null;
  if (value.dateTime) return new Date(value.dateTime);
  if (value.date) return new Date(`${value.date}T00:00:00`);
  return null;
}

function parseGoogleEvent(event: GoogleEventItem) {
  if (!event?.id) return null;

  const startsAt = parseGoogleDateTime(event.start);
  const endsAt = parseGoogleDateTime(event.end);
  if (!startsAt || !endsAt || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return null;
  }
  if (endsAt <= startsAt) return null;

  const durationMinutes = roundToNearest15((endsAt.getTime() - startsAt.getTime()) / 60000);
  if (durationMinutes <= 0) return null;

  return {
    externalEventId: event.id,
    title: event.summary ?? "Untitled meeting",
    description: event.description ?? "",
    startsAt,
    endsAt,
    roundedMinutes: durationMinutes,
    htmlLink: event.htmlLink ?? null,
    organizerEmail: event.organizer?.email ?? "",
    attendeeEmails: (event.attendees ?? []).map((item: { email?: string }) => item.email ?? "").filter(Boolean)
  };
}

function includesName(haystack: string, name: string): boolean {
  const cleanedName = normalizeText(name).trim();
  if (!cleanedName) return false;
  return haystack.includes(cleanedName);
}

async function fetchGoogleCalendarList(accessToken: string): Promise<NonNullable<GoogleCalendarList["items"]>> {
  const response = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`Google Calendar list request failed (${response.status}): ${raw.slice(0, 280)}`);
  }
  const payload = (await response.json()) as GoogleCalendarList;
  return payload.items ?? [];
}

async function fetchGoogleEventsForCalendar(args: {
  accessToken: string;
  calendarId: string;
  timeMin: string;
  timeMax: string;
}): Promise<NonNullable<GoogleEventsList["items"]>> {
  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
    timeMin: args.timeMin,
    timeMax: args.timeMax
  });

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(args.calendarId)}/events?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${args.accessToken}` }
    }
  );

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(
      `Google events request failed for calendar ${args.calendarId} (${response.status}): ${raw.slice(0, 280)}`
    );
  }

  const payload = (await response.json()) as GoogleEventsList;
  return payload.items ?? [];
}

function chooseProjectForEvent(args: {
  searchableText: string;
  projects: CandidateProject[];
  fallbackProjectId: string;
}) {
  const normalizedProjects = args.projects.map((project) => {
    const client = Array.isArray(project.clients) ? project.clients[0] : project.clients;
    return {
      projectId: project.id,
      projectName: project.name,
      clientId: project.client_id,
      clientName: client?.name ?? ""
    };
  });

  const directProjectMatch = normalizedProjects.find((project) =>
    includesName(args.searchableText, project.projectName)
  );
  if (directProjectMatch) {
    return {
      projectId: directProjectMatch.projectId,
      clientId: directProjectMatch.clientId,
      confidence: 0.92
    };
  }

  const clientMatch = normalizedProjects.find((project) => includesName(args.searchableText, project.clientName));
  if (clientMatch) {
    return {
      projectId: clientMatch.projectId,
      clientId: clientMatch.clientId,
      confidence: 0.72
    };
  }

  if (args.searchableText.includes("@mondayandpartners.com") || args.searchableText.includes("@natrx.io")) {
    return {
      projectId: args.fallbackProjectId,
      clientId: null,
      confidence: 0.45
    };
  }

  return {
    projectId: args.fallbackProjectId,
    clientId: null,
    confidence: 0.2
  };
}

async function resolveUserIdFromAccessToken(accessToken: string): Promise<string | null> {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const supabase = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return null;
  }
  return data.user.id;
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");
    const userAccessToken = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : null;

    if (!userAccessToken) {
      return NextResponse.json({ error: "Missing user authorization." }, { status: 401 });
    }

    const userId = await resolveUserIdFromAccessToken(userAccessToken);
    if (!userId) {
      return NextResponse.json({ error: "Invalid user session." }, { status: 401 });
    }

    const body = (await request.json()) as SyncRequestBody;
    const providerAccessToken = body.providerAccessToken?.trim();
    if (!providerAccessToken) {
      return NextResponse.json(
        { error: "Missing Google provider access token. Sign out and sign in again, then retry sync." },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();

    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 6);
    const timeMin = startOfDay(weekStart).toISOString();
    const timeMax = endOfDay(weekEnd).toISOString();

    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("id,name,client_id,clients(id,name)")
      .eq("owner_id", userId)
      .eq("active", true);
    if (projectsError) throw projectsError;

    const { data: inboxClient } = await supabase
      .from("clients")
      .select("id,name")
      .eq("owner_id", userId)
      .ilike("name", "Admin")
      .maybeSingle();

    let fallbackClientId = inboxClient?.id ?? null;
    if (!fallbackClientId) {
      const { data: insertedClient, error: clientError } = await supabase
        .from("clients")
        .insert({
          owner_id: userId,
          name: "Admin",
          kind: "internal",
          active: true
        })
        .select("id")
        .single();
      if (clientError) throw clientError;
      fallbackClientId = insertedClient.id;
    }

    const { data: inboxProject } = await supabase
      .from("projects")
      .select("id")
      .eq("owner_id", userId)
      .eq("client_id", fallbackClientId)
      .ilike("name", "Calendar Inbox")
      .maybeSingle();

    let fallbackProjectId = inboxProject?.id ?? null;
    if (!fallbackProjectId) {
      const { data: insertedProject, error: projectError } = await supabase
        .from("projects")
        .insert({
          owner_id: userId,
          client_id: fallbackClientId,
          name: "Calendar Inbox",
          active: true
        })
        .select("id")
        .single();
      if (projectError) throw projectError;
      fallbackProjectId = insertedProject.id;
    }

    const calendars = await fetchGoogleCalendarList(providerAccessToken);
    const allowedCalendars = calendars.filter((calendar) => {
      if (!calendar.id) return false;
      if (calendar.primary) return true;
      const normalizedId = calendar.id.toLowerCase();
      const normalizedSummary = (calendar.summary ?? "").toLowerCase();
      return (
        normalizedId.endsWith("@mondayandpartners.com") ||
        normalizedId.endsWith("@natrx.io") ||
        normalizedSummary.includes("monday") ||
        normalizedSummary.includes("natrx")
      );
    });

    let imported = 0;
    let updated = 0;

    for (const calendar of allowedCalendars) {
      const events = await fetchGoogleEventsForCalendar({
        accessToken: providerAccessToken,
        calendarId: calendar.id,
        timeMin,
        timeMax
      });

      for (const event of events) {
        if (event.status === "cancelled") continue;
        const parsed = parseGoogleEvent(event);
        if (!parsed) continue;

        const searchableText = normalizeText(
          [
            parsed.title,
            parsed.description,
            parsed.organizerEmail,
            ...parsed.attendeeEmails,
            calendar.id
          ].join(" ")
        );

        const guess = chooseProjectForEvent({
          searchableText,
          projects: (projects ?? []) as CandidateProject[],
          fallbackProjectId
        });

        const payload = {
          title: parsed.title,
          description: parsed.description,
          htmlLink: parsed.htmlLink,
          organizerEmail: parsed.organizerEmail,
          attendeeEmails: parsed.attendeeEmails
        };

        const { data: calendarEvent, error: calendarEventError } = await supabase
          .from("calendar_events")
          .upsert(
            {
              owner_id: userId,
              external_event_id: parsed.externalEventId,
              calendar_id: calendar.id,
              title: parsed.title,
              starts_at: parsed.startsAt.toISOString(),
              ends_at: parsed.endsAt.toISOString(),
              guessed_client_id: guess.clientId,
              guessed_project_id: guess.projectId,
              confidence: guess.confidence,
              payload
            },
            {
              onConflict: "owner_id,calendar_id,external_event_id"
            }
          )
          .select("id")
          .single();

        if (calendarEventError) throw calendarEventError;

        const isoDate = format(parsed.startsAt, "yyyy-MM-dd");

        const { data: existingEntry, error: existingEntryError } = await supabase
          .from("time_entries")
          .select("id,status")
          .eq("owner_id", userId)
          .eq("calendar_event_id", calendarEvent.id)
          .maybeSingle();
        if (existingEntryError) throw existingEntryError;

        if (existingEntry?.id) {
          if (existingEntry.status !== "draft") {
            continue;
          }

          const { error: updateError } = await supabase
            .from("time_entries")
            .update({
              project_id: guess.projectId,
              entry_date: isoDate,
              rounded_minutes: parsed.roundedMinutes,
              status: "draft",
              source: "calendar"
            })
            .eq("id", existingEntry.id);
          if (updateError) throw updateError;
          updated += 1;
          continue;
        }

        const { error: insertError } = await supabase.from("time_entries").insert({
          owner_id: userId,
          project_id: guess.projectId,
          entry_date: isoDate,
          rounded_minutes: parsed.roundedMinutes,
          status: "draft",
          source: "calendar",
          tags: ["calendar"],
          notes: parsed.title,
          calendar_event_id: calendarEvent.id
        });
        if (insertError) throw insertError;
        imported += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      imported,
      updated,
      calendarsScanned: allowedCalendars.length,
      range: {
        start: format(weekStart, "yyyy-MM-dd"),
        end: format(weekEnd, "yyyy-MM-dd")
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Calendar sync failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
