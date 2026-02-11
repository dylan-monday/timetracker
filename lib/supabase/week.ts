import { addDays, format, parseISO, startOfWeek } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClientOption, DraftEntry, ProjectOption, WeekLine } from "@/lib/types";

interface WeekWindow {
  start: string;
  end: string;
}

function getWeekWindow(reference = new Date()): WeekWindow {
  const weekStart = startOfWeek(reference, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 6);

  return {
    start: format(weekStart, "yyyy-MM-dd"),
    end: format(weekEnd, "yyyy-MM-dd")
  };
}

function dayIndexFromISO(isoDate: string): number {
  const isoDay = parseISO(isoDate).getDay();
  // JS getDay: Sunday 0 -> map to 7
  return isoDay === 0 ? 7 : isoDay;
}

export async function fetchClientsAndProjects(supabase: SupabaseClient): Promise<{
  clients: ClientOption[];
  projects: ProjectOption[];
}> {
  const [{ data: clients, error: clientError }, { data: projects, error: projectError }] = await Promise.all([
    supabase.from("clients").select("id,name,kind").eq("active", true).order("name", { ascending: true }),
    supabase
      .from("projects")
      .select("id,name,client_id,clients(name)")
      .eq("active", true)
      .order("name", { ascending: true })
  ]);

  if (clientError) throw clientError;
  if (projectError) throw projectError;

  return {
    clients: (clients ?? []) as ClientOption[],
    projects: (projects ?? []).map((project) => ({
      id: project.id,
      name: project.name,
      clientId: project.client_id,
      clientName: Array.isArray(project.clients)
        ? project.clients[0]?.name ?? "Unknown"
        : ((project.clients as { name: string } | null)?.name ?? "Unknown")
    }))
  };
}

export async function fetchWeekLines(
  supabase: SupabaseClient,
  projects: ProjectOption[],
  reference = new Date()
): Promise<WeekLine[]> {
  const window = getWeekWindow(reference);

  const { data: entries, error } = await supabase
    .from("time_entries")
    .select("id,project_id,entry_date,rounded_minutes,status")
    .gte("entry_date", window.start)
    .lte("entry_date", window.end);

  if (error) throw error;

  const projectById = new Map(projects.map((project) => [project.id, project]));
  const lineByProject = new Map<string, WeekLine>();

  // Show active projects as rows even before they have any entries.
  for (const project of projects) {
    lineByProject.set(project.id, {
      id: `line-${project.id}`,
      projectId: project.id,
      clientId: project.clientId,
      clientName: project.clientName,
      projectName: project.name,
      isDraft: false,
      cells: {}
    });
  }

  for (const entry of entries ?? []) {
    const project = projectById.get(entry.project_id);
    if (!project) continue;

    const line = lineByProject.get(project.id);
    if (!line) continue;

    const dayIndex = dayIndexFromISO(entry.entry_date);
    line.cells[String(dayIndex)] = (line.cells[String(dayIndex)] ?? 0) + entry.rounded_minutes;
    if (entry.status === "draft") {
      line.isDraft = true;
    }
  }

  return Array.from(lineByProject.values()).sort((a, b) =>
    `${a.clientName} ${a.projectName}`.localeCompare(`${b.clientName} ${b.projectName}`)
  );
}

export async function upsertDailyManualEntry(params: {
  supabase: SupabaseClient;
  userId: string;
  projectId: string;
  isoDate: string;
  roundedMinutes: number;
}): Promise<void> {
  const { supabase, userId, projectId, isoDate, roundedMinutes } = params;

  const { error: deleteError } = await supabase
    .from("time_entries")
    .delete()
    .eq("owner_id", userId)
    .eq("project_id", projectId)
    .eq("entry_date", isoDate)
    .eq("source", "manual");

  if (deleteError) throw deleteError;

  if (roundedMinutes <= 0) {
    return;
  }

  const { error: insertError } = await supabase.from("time_entries").insert({
    owner_id: userId,
    project_id: projectId,
    entry_date: isoDate,
    rounded_minutes: roundedMinutes,
    status: "approved",
    source: "manual",
    tags: []
  });

  if (insertError) throw insertError;
}

export async function fetchWeekDraftEntries(
  supabase: SupabaseClient,
  reference = new Date()
): Promise<DraftEntry[]> {
  const window = getWeekWindow(reference);

  const { data, error } = await supabase
    .from("time_entries")
    .select("id,entry_date,rounded_minutes,project_id,projects(name,clients(name)),calendar_events(title)")
    .eq("status", "draft")
    .eq("source", "calendar")
    .gte("entry_date", window.start)
    .lte("entry_date", window.end)
    .order("entry_date", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => {
    const project = Array.isArray(row.projects) ? row.projects[0] : row.projects;
    const client = Array.isArray(project?.clients) ? project?.clients[0] : project?.clients;
    const event = Array.isArray(row.calendar_events) ? row.calendar_events[0] : row.calendar_events;

    return {
      id: row.id,
      isoDate: row.entry_date,
      roundedMinutes: row.rounded_minutes,
      projectId: row.project_id,
      projectName: project?.name ?? "Unassigned project",
      clientName: client?.name ?? "Unassigned client",
      eventTitle: event?.title ?? "Untitled meeting"
    };
  });
}

export async function approveDraftEntry(params: {
  supabase: SupabaseClient;
  entryId: string;
  projectId?: string;
}): Promise<void> {
  const { supabase, entryId, projectId } = params;

  const payload: { status: "approved"; project_id?: string } = { status: "approved" };
  if (projectId) {
    payload.project_id = projectId;
  }

  const { error } = await supabase.from("time_entries").update(payload).eq("id", entryId);
  if (error) throw error;
}

export async function rejectDraftEntry(params: {
  supabase: SupabaseClient;
  entryId: string;
}): Promise<void> {
  const { supabase, entryId } = params;

  const { error } = await supabase
    .from("time_entries")
    .update({ status: "rejected" })
    .eq("id", entryId);

  if (error) throw error;
}

export async function ensureClientAndProject(params: {
  supabase: SupabaseClient;
  userId: string;
  clientName: string;
  projectName: string;
}): Promise<ProjectOption> {
  const { supabase, userId, clientName, projectName } = params;

  const normalizedClient = clientName.trim();
  const normalizedProject = projectName.trim();

  if (!normalizedClient || !normalizedProject) {
    throw new Error("Client and project are required.");
  }

  const { data: existingClient } = await supabase
    .from("clients")
    .select("id,name,kind")
    .ilike("name", normalizedClient)
    .maybeSingle();

  let clientId = existingClient?.id;

  if (!clientId) {
    const { data: insertedClient, error: clientInsertError } = await supabase
      .from("clients")
      .insert({ owner_id: userId, name: normalizedClient, kind: "external", active: true })
      .select("id,name,kind")
      .single();

    if (clientInsertError) throw clientInsertError;
    clientId = insertedClient.id;
  }

  const { data: existingProject } = await supabase
    .from("projects")
    .select("id,name,client_id")
    .eq("client_id", clientId)
    .ilike("name", normalizedProject)
    .maybeSingle();

  let projectId = existingProject?.id;

  if (!projectId) {
    const { data: insertedProject, error: projectInsertError } = await supabase
      .from("projects")
      .insert({ owner_id: userId, client_id: clientId, name: normalizedProject, active: true })
      .select("id,name,client_id")
      .single();

    if (projectInsertError) throw projectInsertError;
    projectId = insertedProject.id;
  }

  return {
    id: projectId,
    name: normalizedProject,
    clientId,
    clientName: normalizedClient
  };
}
