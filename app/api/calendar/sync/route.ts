import { addDays, endOfDay, format, startOfDay, startOfWeek } from "date-fns";
import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/server/supabase-admin";

interface CandidateProject {
  id: string;
  name: string;
  client_id: string;
  clients: { id: string; name: string } | { id: string; name: string }[] | null;
}

interface ParsedIcsEvent {
  uid: string;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  roundedMinutes: number;
}

function toErrorDetails(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null) {
    const maybe = error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
    const parts = [
      typeof maybe.message === "string" ? maybe.message : null,
      typeof maybe.code === "string" ? `code ${maybe.code}` : null,
      typeof maybe.details === "string" ? maybe.details : null,
      typeof maybe.hint === "string" ? maybe.hint : null
    ].filter(Boolean);
    if (parts.length) return parts.join(" | ");
    try {
      const json = JSON.stringify(error);
      if (json && json !== "{}") return json;
    } catch {
      // noop
    }
  }
  if (typeof error === "string" && error.trim()) return error;
  return String(error);
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9@\s.-]/g, " ");
}

function roundToNearest15(minutes: number): number {
  if (minutes <= 0) return 0;
  return Math.max(15, Math.round(minutes / 15) * 15);
}

function isPlaceholderEventTitle(title: string): boolean {
  const normalizedTitle = title.trim().toLowerCase();
  return normalizedTitle === "busy" || normalizedTitle === "private event";
}

function includesName(haystack: string, name: string): boolean {
  const cleanedName = normalizeText(name).trim();
  if (!cleanedName) return false;
  return haystack.includes(cleanedName);
}

function chooseProjectForEvent(args: {
  searchableText: string;
  projects: CandidateProject[];
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

  return {
    projectId: null,
    clientId: null,
    confidence: 0.2
  };
}

function unfoldIcsLines(raw: string): string[] {
  const lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const unfolded: string[] = [];

  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && unfolded.length) {
      unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line);
    }
  }

  return unfolded;
}

function parseIcsDate(rawValue: string): { date: Date | null; isAllDay: boolean } {
  const value = rawValue.trim();

  if (/^\d{8}$/.test(value)) {
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(4, 6)) - 1;
    const day = Number(value.slice(6, 8));
    return { date: new Date(Date.UTC(year, month, day)), isAllDay: true };
  }

  const utcMatch = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (utcMatch) {
    const [, y, m, d, hh, mm, ss] = utcMatch;
    return {
      date: new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss))),
      isAllDay: false
    };
  }

  const localMatch = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (localMatch) {
    const [, y, m, d, hh, mm, ss] = localMatch;
    return {
      date: new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss)),
      isAllDay: false
    };
  }

  return { date: null, isAllDay: false };
}

function parseIcsEvents(raw: string, weekStart: Date, weekEnd: Date): ParsedIcsEvent[] {
  const lines = unfoldIcsLines(raw);
  const events: ParsedIcsEvent[] = [];

  let inEvent = false;
  let uid = "";
  let summary = "";
  let description = "";
  let dtStartRaw = "";
  let dtEndRaw = "";

  const reset = () => {
    uid = "";
    summary = "";
    description = "";
    dtStartRaw = "";
    dtEndRaw = "";
  };

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      reset();
      continue;
    }

    if (line === "END:VEVENT") {
      inEvent = false;

      const startParsed = parseIcsDate(dtStartRaw);
      const endParsed = parseIcsDate(dtEndRaw);
      if (!startParsed.date || !endParsed.date || startParsed.isAllDay || endParsed.isAllDay) {
        continue;
      }

      if (endParsed.date <= startParsed.date) continue;
      if (endParsed.date < weekStart || startParsed.date > weekEnd) continue;

      const roundedMinutes = roundToNearest15((endParsed.date.getTime() - startParsed.date.getTime()) / 60000);
      if (roundedMinutes <= 0) continue;

      events.push({
        uid: uid || `${summary}-${startParsed.date.toISOString()}`,
        title: summary || "Untitled meeting",
        description: description || "",
        startsAt: startParsed.date,
        endsAt: endParsed.date,
        roundedMinutes
      });

      continue;
    }

    if (!inEvent) continue;

    const firstColon = line.indexOf(":");
    if (firstColon <= 0) continue;

    const rawKey = line.slice(0, firstColon);
    const rawValue = line.slice(firstColon + 1);
    const key = rawKey.split(";")[0]?.toUpperCase();

    if (key === "UID") uid = rawValue;
    if (key === "SUMMARY") summary = rawValue.replaceAll("\\,", ",").replaceAll("\\n", " ");
    if (key === "DESCRIPTION") description = rawValue.replaceAll("\\n", " ");
    if (key === "DTSTART") dtStartRaw = rawValue;
    if (key === "DTEND") dtEndRaw = rawValue;
  }

  return events;
}

async function resolveUserIdFromAccessToken(accessToken: string): Promise<string | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.auth.getUser(accessToken);
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

    const supabase = createAdminSupabaseClient();

    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 6);
    const timeMin = startOfDay(weekStart);
    const timeMax = endOfDay(weekEnd);
    const weekStartIso = format(weekStart, "yyyy-MM-dd");
    const weekEndIso = format(weekEnd, "yyyy-MM-dd");

    const { data: feedSources, error: feedSourcesError } = await supabase
      .from("calendar_feed_sources")
      .select("id,name,feed_url")
      .eq("owner_id", userId)
      .eq("active", true)
      .order("created_at", { ascending: true });

    if (feedSourcesError) throw feedSourcesError;

    if (!(feedSources ?? []).length) {
      return NextResponse.json({ error: "No active calendar sources configured in Admin Mode." }, { status: 400 });
    }

    const { error: clearError } = await supabase
      .from("time_entries")
      .delete()
      .eq("owner_id", userId)
      .eq("status", "draft")
      .eq("source", "calendar")
      .gte("entry_date", weekStartIso)
      .lte("entry_date", weekEndIso);
    if (clearError) throw clearError;

    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("id,name,client_id,clients(id,name)")
      .eq("owner_id", userId)
      .eq("active", true);
    if (projectsError) throw projectsError;

    let imported = 0;
    let scannedEvents = 0;
    let skippedUnmapped = 0;
    const sourceErrors: Array<{ source: string; error: string }> = [];

    for (const source of feedSources ?? []) {
      try {
        const feedUrl = String(source.feed_url ?? "").trim();
        if (!feedUrl || !feedUrl.startsWith("https://")) {
          sourceErrors.push({ source: source.name, error: "Feed URL must start with https://." });
          continue;
        }

        const response = await fetch(feedUrl, { headers: { "User-Agent": "M+P-Time-Sync/1.0" } });
        if (!response.ok) {
          sourceErrors.push({
            source: source.name,
            error: `Feed fetch failed with status ${response.status}.`
          });
          continue;
        }

        const rawIcs = await response.text();
        const events = parseIcsEvents(rawIcs, timeMin, timeMax);

        for (const event of events) {
          scannedEvents += 1;

          if (isPlaceholderEventTitle(event.title)) {
            continue;
          }

          const searchableText = normalizeText([event.title, event.description].join(" "));
          const guess = chooseProjectForEvent({
            searchableText,
            projects: (projects ?? []) as CandidateProject[]
          });

          const externalEventId = `${source.id}:${event.uid}:${event.startsAt.toISOString()}`;
          const payload = {
            sourceName: source.name,
            sourceUrl: source.feed_url,
            description: event.description
          };

          const { data: calendarEvent, error: calendarEventError } = await supabase
            .from("calendar_events")
            .upsert(
              {
                owner_id: userId,
                external_event_id: externalEventId,
                calendar_id: `feed:${source.id}`,
                title: event.title,
                starts_at: event.startsAt.toISOString(),
                ends_at: event.endsAt.toISOString(),
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

          const { data: categorizedEntry, error: categorizedEntryError } = await supabase
            .from("time_entries")
            .select("id")
            .eq("owner_id", userId)
            .eq("calendar_event_id", calendarEvent.id)
            .neq("status", "draft")
            .limit(1)
            .maybeSingle();
          if (categorizedEntryError) throw categorizedEntryError;
          if (categorizedEntry?.id) {
            continue;
          }

          if (!guess.projectId) {
            skippedUnmapped += 1;
            continue;
          }

          const { error: insertError } = await supabase.from("time_entries").insert({
            owner_id: userId,
            project_id: guess.projectId,
            entry_date: format(event.startsAt, "yyyy-MM-dd"),
            rounded_minutes: event.roundedMinutes,
            status: "draft",
            source: "calendar",
            tags: ["calendar", "feed"],
            notes: event.title,
            calendar_event_id: calendarEvent.id
          });
          if (insertError) throw insertError;

          imported += 1;
        }
      } catch (sourceError) {
        sourceErrors.push({
          source: source.name,
          error: toErrorDetails(sourceError)
        });
      }
    }

    return NextResponse.json({
      ok: true,
      imported,
      updated: 0,
      calendarsScanned: (feedSources ?? []).length,
      eventsScanned: scannedEvents,
      skippedUnmapped,
      sourceErrors,
      range: {
        start: weekStartIso,
        end: weekEndIso
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Calendar sync failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
