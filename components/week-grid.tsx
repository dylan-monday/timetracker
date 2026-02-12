"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { makeWeekDays } from "@/lib/mock-data";
import { missingMinutes, missingState } from "@/lib/missing-time";
import {
  approveDraftEntry,
  deleteLineEntriesForWeek,
  ensureClientAndProject,
  fetchClientsAndProjects,
  fetchWeekDraftEntries,
  fetchWeekLines,
  rejectDraftEntry,
  upsertDailyManualEntry
} from "@/lib/supabase/week";
import { minutesToDisplay, parseAndRoundTimeInput } from "@/lib/time";
import type { ClientOption, DraftEntry, ProjectOption, WeekLine } from "@/lib/types";

const BUSINESS_DAY_INDEXES = [1, 2, 3, 4, 5];
const ALL_DAY_INDEXES = [1, 2, 3, 4, 5, 6, 7];
const WEEK_LINE_STORAGE_PREFIX = "mp-time-week-lines";
const QUICK_TAG_STORAGE_KEY = "mp-time-quick-tags";
const REFLECTION_QUOTES = [
  {
    text: "It is not that we have a short time to live, but that we waste a lot of it.",
    author: "Seneca"
  },
  {
    text: "You have power over your mind - not outside events. Realize this, and you will find strength.",
    author: "Marcus Aurelius"
  },
  {
    text: "The impediment to action advances action. What stands in the way becomes the way.",
    author: "Marcus Aurelius"
  },
  {
    text: "No man is free who is not master of himself.",
    author: "Epictetus"
  },
  {
    text: "Waste no more time arguing what a good man should be. Be one.",
    author: "Marcus Aurelius"
  },
  {
    text: "How we spend our days is, of course, how we spend our lives.",
    author: "Annie Dillard"
  },
  {
    text: "Things do not happen. Things are made to happen.",
    author: "John F. Kennedy"
  },
  {
    text: "I am not what happened to me, I am what I choose to become.",
    author: "Carl Jung"
  }
];

function stateClass(state: "ok" | "attention" | "gap"): string {
  if (state === "ok") return "border border-accent/35 bg-accent/25 text-ink";
  if (state === "attention") return "border border-sky-200/80 bg-sky-100/80 text-ink";
  return "border border-sky-300/85 bg-sky-100 text-ink";
}

function isWeekendIsoDate(isoDate: string): boolean {
  const day = new Date(`${isoDate}T00:00:00`).getDay();
  return day === 0 || day === 6;
}

function formatDraftTimeRange(entry: DraftEntry): string | null {
  if (!entry.startsAt || !entry.endsAt) return null;

  const start = new Date(entry.startsAt);
  const end = new Date(entry.endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  const weekday = start.toLocaleDateString(undefined, { weekday: "short" });
  const month = start.toLocaleDateString(undefined, { month: "short" });
  const day = start.toLocaleDateString(undefined, { day: "numeric" });
  const startTime = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const endTime = end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  return `${weekday}, ${month} ${day} • ${startTime} - ${endTime}`;
}

export function WeekGrid() {
  const { session, supabase, user } = useAuth();
  const weekDays = useMemo(() => makeWeekDays(), []);

  const [showWeekends, setShowWeekends] = useState(false);
  const [lines, setLines] = useState<WeekLine[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [draftEntries, setDraftEntries] = useState<DraftEntry[]>([]);

  const [entryInput, setEntryInput] = useState("");
  const [activeCell, setActiveCell] = useState<{ lineId: string; dayIndex: number } | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const [quickClient, setQuickClient] = useState("");
  const [quickProject, setQuickProject] = useState("");
  const [quickTags, setQuickTags] = useState("");
  const [savedQuickTags, setSavedQuickTags] = useState<string[]>([]);
  const [showDraftCreateModal, setShowDraftCreateModal] = useState(false);
  const [draftCreateEntryId, setDraftCreateEntryId] = useState<string | null>(null);
  const [draftCreateClient, setDraftCreateClient] = useState("");
  const [draftCreateProject, setDraftCreateProject] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [draftActionId, setDraftActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pinnedProjectIds, setPinnedProjectIds] = useState<string[]>([]);
  const todayDayIndex = useMemo(() => {
    const day = new Date().getDay();
    return day === 0 ? 7 : day;
  }, []);
  const [mobileDayIndex, setMobileDayIndex] = useState(todayDayIndex);
  const reflectionQuote = useMemo(
    () => REFLECTION_QUOTES[Math.floor(Math.random() * REFLECTION_QUOTES.length)],
    []
  );

  const visibleDayIndexes = showWeekends ? ALL_DAY_INDEXES : BUSINESS_DAY_INDEXES;
  const activeMobileDayIndex = visibleDayIndexes.includes(mobileDayIndex)
    ? mobileDayIndex
    : visibleDayIndexes[0];
  const weekKey = weekDays[0]?.isoDate ?? "week";

  const savePinnedProjectIds = useCallback(
    (next: string[]) => {
      setPinnedProjectIds(next);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          `${WEEK_LINE_STORAGE_PREFIX}:${weekKey}`,
          JSON.stringify(Array.from(new Set(next)))
        );
      }
    },
    [weekKey]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(`${WEEK_LINE_STORAGE_PREFIX}:${weekKey}`);
    if (!raw) {
      setPinnedProjectIds([]);
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setPinnedProjectIds(parsed.filter((item) => typeof item === "string"));
      } else {
        setPinnedProjectIds([]);
      }
    } catch {
      setPinnedProjectIds([]);
    }
  }, [weekKey]);

  useEffect(() => {
    if (!visibleDayIndexes.includes(mobileDayIndex)) {
      setMobileDayIndex(visibleDayIndexes.includes(todayDayIndex) ? todayDayIndex : visibleDayIndexes[0]);
    }
  }, [mobileDayIndex, todayDayIndex, visibleDayIndexes]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(QUICK_TAG_STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;

      setSavedQuickTags(
        parsed
          .filter((tag): tag is string => typeof tag === "string")
          .map((tag) => tag.trim())
          .filter(Boolean)
      );
    } catch {
      setSavedQuickTags([]);
    }
  }, []);

  const refreshWeekData = useCallback(async () => {
    if (!user || !supabase) return;

    setLoading(true);
    setError(null);

    try {
      const { clients: dbClients, projects: dbProjects } = await fetchClientsAndProjects(supabase);
      const [dbLines, dbDrafts] = await Promise.all([
        fetchWeekLines(supabase, dbProjects, pinnedProjectIds),
        fetchWeekDraftEntries(supabase)
      ]);

      setClients(dbClients);
      setProjects(dbProjects);
      setLines(dbLines);
      setDraftEntries(dbDrafts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load data.");
      setLines([]);
      setDraftEntries([]);
    } finally {
      setLoading(false);
    }
  }, [pinnedProjectIds, supabase, user]);

  useEffect(() => {
    void refreshWeekData();
  }, [refreshWeekData]);

  const totalsByDay = visibleDayIndexes.reduce<Record<number, number>>((acc, dayIndex) => {
    acc[dayIndex] = lines.reduce((sum, line) => sum + (line.cells[String(dayIndex)] ?? 0), 0);
    return acc;
  }, {});
  const mobileDay = weekDays[activeMobileDayIndex - 1];
  const mobileMinutes = totalsByDay[activeMobileDayIndex] ?? 0;
  const mobileStatus = missingState(mobileMinutes);

  const shiftMobileDay = (direction: -1 | 1) => {
    const currentPosition = visibleDayIndexes.indexOf(activeMobileDayIndex);
    if (currentPosition < 0) {
      setMobileDayIndex(visibleDayIndexes[0]);
      return;
    }
    const nextPosition =
      (currentPosition + direction + visibleDayIndexes.length) % visibleDayIndexes.length;
    setMobileDayIndex(visibleDayIndexes[nextPosition]);
  };

  const handleCellSubmit = async () => {
    if (!activeCell || !user || !supabase) return;

    const rounded = parseAndRoundTimeInput(entryInput);
    if (rounded === null) {
      setActiveCell(null);
      setEntryInput("");
      return;
    }

    const line = lines.find((item) => item.id === activeCell.lineId);
    if (!line?.projectId) {
      setActiveCell(null);
      setEntryInput("");
      return;
    }

    const isoDate = weekDays[activeCell.dayIndex - 1]?.isoDate;
    if (!isoDate) return;

    setLines((current) =>
      current.map((item) => {
        if (item.id !== activeCell.lineId) return item;
        return {
          ...item,
          cells: {
            ...item.cells,
            [String(activeCell.dayIndex)]: rounded
          }
        };
      })
    );

    setSaving(true);
    setError(null);

    try {
      await upsertDailyManualEntry({
        supabase,
        userId: user.id,
        projectId: line.projectId,
        isoDate,
        roundedMinutes: rounded
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save entry.");
      await refreshWeekData();
    } finally {
      setSaving(false);
      setEntryInput("");
      setActiveCell(null);
    }
  };

  const filteredProjects = useMemo(() => {
    if (!quickClient.trim()) return projects;
    const client = clients.find((item) => item.name.toLowerCase() === quickClient.trim().toLowerCase());
    if (!client) return projects;

    return projects.filter((project) => project.clientId === client.id);
  }, [clients, projects, quickClient]);

  const quickTagSuggestions = useMemo(() => {
    const seen = new Set<string>();
    return savedQuickTags.filter((tag) => {
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [savedQuickTags]);

  const handleQuickAddSave = async () => {
    if (!user || !supabase || !quickClient.trim() || !quickProject.trim()) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const project = await ensureClientAndProject({
        supabase,
        userId: user.id,
        clientName: quickClient,
        projectName: quickProject
      });

      setLines((current) => {
        const exists = current.some((line) => line.projectId === project.id);
        if (exists) {
          if (!pinnedProjectIds.includes(project.id)) {
            savePinnedProjectIds([...pinnedProjectIds, project.id]);
          }
          return current;
        }

        savePinnedProjectIds([...pinnedProjectIds, project.id]);

        return [
          ...current,
          {
            id: `line-${project.id}`,
            projectId: project.id,
            clientId: project.clientId,
            clientName: project.clientName,
            projectName: project.name,
            cells: {},
            isDraft: false
          }
        ];
      });

      setQuickClient("");
      setQuickProject("");
      const parsedTags = quickTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      if (parsedTags.length) {
        const nextSavedTags = [...parsedTags, ...savedQuickTags]
          .filter((tag, index, all) => all.findIndex((item) => item.toLowerCase() === tag.toLowerCase()) === index)
          .slice(0, 40);
        setSavedQuickTags(nextSavedTags);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(QUICK_TAG_STORAGE_KEY, JSON.stringify(nextSavedTags));
        }
      }
      setQuickTags("");
      setShowQuickAdd(false);
      await refreshWeekData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add line.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLine = async (line: WeekLine) => {
    if (!user || !supabase || !line.projectId) return;

    const confirmed = window.confirm(
      `Delete "${line.projectName}" from this week? This removes its time entries for this week only.`
    );
    if (!confirmed) return;

    const weekStartISO = weekDays[0]?.isoDate;
    const weekEndISO = weekDays[6]?.isoDate;
    if (!weekStartISO || !weekEndISO) return;

    setSaving(true);
    setError(null);

    try {
      await deleteLineEntriesForWeek({
        supabase,
        userId: user.id,
        projectId: line.projectId,
        weekStartISO,
        weekEndISO
      });

      const nextPinned = pinnedProjectIds.filter((id) => id !== line.projectId);
      savePinnedProjectIds(nextPinned);
      await refreshWeekData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete line.");
    } finally {
      setSaving(false);
    }
  };

  const handleDraftApprove = async (entryId: string, projectId?: string) => {
    if (!supabase) return;
    setDraftActionId(entryId);
    setError(null);

    try {
      await approveDraftEntry({ supabase, entryId, projectId });
      await refreshWeekData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve draft entry.");
    } finally {
      setDraftActionId(null);
    }
  };

  const handleDraftReject = async (entryId: string) => {
    if (!supabase) return;
    setDraftActionId(entryId);
    setError(null);

    try {
      await rejectDraftEntry({ supabase, entryId });
      await refreshWeekData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reject draft entry.");
    } finally {
      setDraftActionId(null);
    }
  };

  const handleDraftReassign = async (entryId: string, selectedProjectId: string) => {
    if (!supabase || !user) return;

    if (selectedProjectId === "__new__") {
      const draft = draftEntries.find((item) => item.id === entryId);
      setDraftCreateEntryId(entryId);
      setDraftCreateClient(draft?.clientName && draft.clientName !== "Unassigned client" ? draft.clientName : "");
      setDraftCreateProject("");
      setShowDraftCreateModal(true);
      return;
    }

    await handleDraftApprove(entryId, selectedProjectId);
  };

  const handleDraftCreateSave = async () => {
    if (!supabase || !user || !draftCreateEntryId) return;
    if (!draftCreateClient.trim() || !draftCreateProject.trim()) {
      setError("Client and project are required.");
      return;
    }

    setDraftActionId(draftCreateEntryId);
    setError(null);

    try {
      const created = await ensureClientAndProject({
        supabase,
        userId: user.id,
        clientName: draftCreateClient.trim(),
        projectName: draftCreateProject.trim()
      });

      setClients((current) => {
        if (current.some((client) => client.id === created.clientId)) return current;
        return [...current, { id: created.clientId, name: created.clientName, kind: "external" as const }].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
      });
      setProjects((current) => {
        if (current.some((project) => project.id === created.id)) return current;
        return [
          ...current,
          {
            id: created.id,
            name: created.name,
            clientId: created.clientId,
            clientName: created.clientName
          }
        ].sort((a, b) => `${a.clientName} ${a.name}`.localeCompare(`${b.clientName} ${b.name}`));
      });

      await approveDraftEntry({
        supabase,
        entryId: draftCreateEntryId,
        projectId: created.id
      });

      setShowDraftCreateModal(false);
      setDraftCreateEntryId(null);
      setDraftCreateClient("");
      setDraftCreateProject("");
      await refreshWeekData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project for draft.");
    } finally {
      setDraftActionId(null);
    }
  };

  const handleCalendarSync = async () => {
    if (!supabase) {
      setError("Sign in again and retry sync.");
      setSyncMessage(null);
      return;
    }

    setSyncingCalendar(true);
    setError(null);
    setSyncMessage(null);

    try {
      const { data: refreshedAuth, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) throw refreshError;

      const accessToken = refreshedAuth.session?.access_token ?? session?.access_token;
      if (!accessToken) {
        throw new Error("Sign in again and retry sync.");
      }

      const response = await fetch("/api/calendar/sync", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            error?: string;
            imported?: number;
            updated?: number;
            calendarsScanned?: number;
          }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Calendar sync failed.");
      }

      const imported = payload?.imported ?? 0;
      const updated = payload?.updated ?? 0;
      const calendarsScanned = payload?.calendarsScanned ?? 0;
      setSyncMessage(
        imported || updated
          ? `Calendar sync complete: ${imported} imported, ${updated} updated across ${calendarsScanned} calendars.`
          : `Calendar sync complete: no events imported. Scanned ${calendarsScanned} calendars for this week.`
      );

      await refreshWeekData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Calendar sync failed.");
    } finally {
      setSyncingCalendar(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-black/5 bg-panel p-4 shadow-soft">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm font-medium"
              onClick={() => {
                void refreshWeekData();
              }}
              disabled={loading || saving}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Sync
            </button>
            <button
              type="button"
              className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm font-medium"
              onClick={() => setShowWeekends((value) => !value)}
            >
              {showWeekends ? "Hide weekends" : "Show weekends"}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              onClick={() => {
                void handleCalendarSync();
              }}
              disabled={syncingCalendar}
            >
              <RefreshCw className={`h-4 w-4 ${syncingCalendar ? "animate-spin" : ""}`} />
              {syncingCalendar ? "Syncing calendars..." : "Sync calendars"}
            </button>
          </div>
        </div>

        {error ? <p className="mb-3 text-xs text-danger">{error}</p> : null}
        {syncMessage ? <p className="mb-3 text-xs text-muted">{syncMessage}</p> : null}

        <div className="sm:hidden">
          <div className="mb-3 rounded-xl border border-black/10 bg-white p-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="rounded-full border border-black/10 bg-white p-2"
                onClick={() => shiftMobileDay(-1)}
                aria-label="Previous day"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium"
                onClick={() => {
                  setMobileDayIndex(visibleDayIndexes.includes(todayDayIndex) ? todayDayIndex : visibleDayIndexes[0]);
                }}
              >
                Today
              </button>
              <button
                type="button"
                className="rounded-full border border-black/10 bg-white p-2"
                onClick={() => shiftMobileDay(1)}
                aria-label="Next day"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <p className="text-sm font-medium">
                {mobileDay?.label} {mobileDay?.day}
              </p>
              <p className="font-numeric text-xs text-muted">{minutesToDisplay(mobileMinutes)}</p>
            </div>
            <div className={`mt-2 font-numeric rounded-2xl px-3 py-2 text-[11px] leading-tight ${stateClass(mobileStatus)}`}>
              {mobileStatus === "ok" ? (
                <span className="font-medium">Full Day</span>
              ) : (
                <span className="font-semibold">{Math.round(missingMinutes(mobileMinutes) / 60)}h open</span>
              )}
            </div>
          </div>

          <table className="w-full border-separate border-spacing-y-2 text-sm">
            <tbody>
              {lines.map((line) => {
                const isActive =
                  activeCell?.lineId === line.id && activeCell?.dayIndex === activeMobileDayIndex;
                const value = line.cells[String(activeMobileDayIndex)] ?? 0;
                return (
                  <tr key={`mobile-${line.id}`} className="rounded-xl bg-white/90 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
                    <td className="rounded-l-xl px-3 py-3 align-middle">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-ink">{line.projectName}</p>
                        <button
                          type="button"
                          className="rounded-full border border-black/10 bg-white p-1.5 text-muted transition hover:border-black/20 hover:text-ink"
                          onClick={() => {
                            void handleDeleteLine(line);
                          }}
                          title="Delete this line from week"
                          disabled={saving}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-muted">
                        {line.clientName}
                        {line.isDraft ? " • draft approval" : ""}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      {isActive ? (
                        <input
                          autoFocus
                          value={entryInput}
                          onChange={(event) => setEntryInput(event.target.value)}
                          onBlur={() => {
                            void handleCellSubmit();
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              void handleCellSubmit();
                            }
                          }}
                          className="w-full rounded-lg border border-black/15 bg-canvas px-2 py-1.5 text-sm focus:border-black/30 focus:outline-none"
                          placeholder="1h 30m"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveCell({ lineId: line.id, dayIndex: activeMobileDayIndex });
                            setEntryInput(value ? String(value / 60) : "");
                          }}
                          className="w-full rounded-lg border border-transparent px-2 py-1.5 text-left text-sm transition hover:border-black/10 hover:bg-canvas"
                        >
                          <span className="font-numeric">{minutesToDisplay(value)}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!lines.length && !loading ? (
            <div className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-muted">
              No lines yet. Add your first client/project line to start tracking.
            </div>
          ) : null}
        </div>

        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-xs tracking-wide text-muted">
                <th className="px-3 py-2 uppercase text-transparent">line</th>
                {visibleDayIndexes.map((dayIndex, dayPosition) => {
                  const day = weekDays[dayIndex - 1];
                  const minutes = totalsByDay[dayIndex] ?? 0;
                  const status = missingState(minutes);
                  const isWeekend = isWeekendIsoDate(day.isoDate);

                  return (
                    <th
                      key={day.isoDate}
                      className={`px-3 py-2 ${isWeekend ? "rounded-xl bg-black/[0.03]" : ""} ${
                        dayPosition > 0 ? "border-l border-black/10" : ""
                      }`}
                    >
                      <div className="mb-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                          {day.label} {day.day}
                        </p>
                        <p className="mt-0.5 font-numeric text-[13px] text-muted">
                          {minutesToDisplay(minutes)}
                        </p>
                      </div>
                      <div
                        className={`font-numeric rounded-2xl px-3 py-2 text-[11px] leading-tight ${stateClass(status)}`}
                      >
                        {status === "ok" ? (
                          <span className="font-medium">Full Day</span>
                        ) : (
                          <span className="font-semibold">{Math.round(missingMinutes(minutes) / 60)}h open</span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="rounded-xl bg-white/90 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
                  <td className="rounded-l-xl px-3 py-3 align-middle">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-ink">{line.projectName}</p>
                      <button
                        type="button"
                        className="rounded-full border border-black/10 bg-white p-1.5 text-muted transition hover:border-black/20 hover:text-ink"
                        onClick={() => {
                          void handleDeleteLine(line);
                        }}
                        title="Delete this line from week"
                        disabled={saving}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-muted">
                      {line.clientName}
                      {line.isDraft ? " • draft approval" : ""}
                    </p>
                  </td>
                  {visibleDayIndexes.map((dayIndex, dayPosition) => {
                    const day = weekDays[dayIndex - 1];
                    const isWeekend = isWeekendIsoDate(day.isoDate);
                    const isActive =
                      activeCell?.lineId === line.id && activeCell?.dayIndex === dayIndex;
                    const value = line.cells[String(dayIndex)] ?? 0;

                    return (
                      <td
                        key={`${line.id}-${dayIndex}`}
                        className={`px-3 py-2 ${isWeekend ? "bg-black/[0.03]" : ""} ${
                          dayPosition > 0 ? "border-l border-black/10" : ""
                        }`}
                      >
                        {isActive ? (
                          <input
                            autoFocus
                            value={entryInput}
                            onChange={(event) => setEntryInput(event.target.value)}
                            onBlur={() => {
                              void handleCellSubmit();
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                void handleCellSubmit();
                              }
                            }}
                            className="w-full rounded-lg border border-black/15 bg-canvas px-2 py-1.5 text-sm focus:border-black/30 focus:outline-none"
                            placeholder="1h 30m"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveCell({ lineId: line.id, dayIndex });
                              setEntryInput(value ? String(value / 60) : "");
                            }}
                            className="w-full rounded-lg border border-transparent px-2 py-1.5 text-left text-sm transition hover:border-black/10 hover:bg-canvas"
                          >
                            <span className="font-numeric">{minutesToDisplay(value)}</span>
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {!lines.length && !loading ? (
            <div className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-muted">
              No lines yet. Add your first client/project line to start tracking.
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium"
            onClick={() => setShowQuickAdd(true)}
          >
            <Plus className="h-4 w-4" />
            Add line
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium"
          >
            <Sparkles className="h-4 w-4" />
            Copy last week
          </button>
        </div>
      </div>

      {showQuickAdd ? (
        <div
          className="fixed inset-0 z-20 bg-black/18 backdrop-blur-[1px]"
          onClick={() => setShowQuickAdd(false)}
        >
          <aside
            className="fixed inset-x-0 bottom-0 z-30 rounded-t-3xl border border-black/10 bg-panel p-4 shadow-[0_-20px_50px_rgba(0,0,0,0.14)] sm:inset-x-auto sm:left-1/2 sm:mx-auto sm:mb-6 sm:w-full sm:max-w-xl sm:-translate-x-1/2 sm:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-base font-semibold">Quick add line</h2>
            <p className="mt-1 text-sm text-muted">Client and project can be selected or created in place.</p>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">Client</span>
                <input
                  list="client-options"
                  type="text"
                  value={quickClient}
                  onChange={(event) => setQuickClient(event.target.value)}
                  placeholder="Pick existing or create new"
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/30"
                />
                <datalist id="client-options">
                  {clients.map((client) => (
                    <option key={client.id} value={client.name} />
                  ))}
                </datalist>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">Project</span>
                <input
                  list="project-options"
                  type="text"
                  value={quickProject}
                  onChange={(event) => setQuickProject(event.target.value)}
                  placeholder="Pick existing or create new"
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/30"
                />
                <datalist id="project-options">
                  {filteredProjects.map((project) => (
                    <option key={project.id} value={project.name} />
                  ))}
                </datalist>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
                  Tags (optional)
                </span>
                <input
                  list="tag-options"
                  type="text"
                  value={quickTags}
                  onChange={(event) => setQuickTags(event.target.value)}
                  placeholder="strategy, social, production"
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/30"
                />
                <datalist id="tag-options">
                  {quickTagSuggestions.map((tag) => (
                    <option key={tag} value={tag} />
                  ))}
                </datalist>
              </label>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium"
                onClick={() => setShowQuickAdd(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="flex-1 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                onClick={() => {
                  void handleQuickAddSave();
                }}
                disabled={saving || !quickClient.trim() || !quickProject.trim()}
              >
                Save line
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      {showDraftCreateModal ? (
        <div
          className="fixed inset-0 z-20 bg-black/18 backdrop-blur-[1px]"
          onClick={() => {
            setShowDraftCreateModal(false);
            setDraftCreateEntryId(null);
          }}
        >
          <aside
            className="fixed inset-x-0 bottom-0 z-30 rounded-t-3xl border border-black/10 bg-panel p-4 shadow-[0_-20px_50px_rgba(0,0,0,0.14)] sm:inset-x-auto sm:left-1/2 sm:mx-auto sm:mb-6 sm:w-full sm:max-w-xl sm:-translate-x-1/2 sm:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-base font-semibold">Create project for draft</h2>
            <p className="mt-1 text-sm text-muted">
              Choose an existing client or type a new one, then add the project.
            </p>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">Client</span>
                <input
                  list="draft-client-options"
                  type="text"
                  value={draftCreateClient}
                  onChange={(event) => setDraftCreateClient(event.target.value)}
                  placeholder="Select existing or create new"
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/30"
                />
                <datalist id="draft-client-options">
                  {clients.map((client) => (
                    <option key={client.id} value={client.name} />
                  ))}
                </datalist>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">Project</span>
                <input
                  type="text"
                  value={draftCreateProject}
                  onChange={(event) => setDraftCreateProject(event.target.value)}
                  placeholder="New project name"
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/30"
                />
              </label>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium"
                onClick={() => {
                  setShowDraftCreateModal(false);
                  setDraftCreateEntryId(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                onClick={() => {
                  void handleDraftCreateSave();
                }}
                disabled={saving || !draftCreateClient.trim() || !draftCreateProject.trim()}
              >
                Create + approve
              </button>
            </div>
          </aside>
        </div>
      ) : null}

      <div className="rounded-2xl border border-black/5 bg-panel p-4 shadow-soft">
        <h2 className="text-base font-semibold">Calendar drafts</h2>
        <p className="mt-1 text-sm text-muted">
          Meeting imports create immediate drafts in this week. Approve, reassign, or reject in-line.
        </p>

        {draftEntries.length ? (
          <ul className="mt-3 space-y-2">
            {draftEntries.map((entry) => (
              <li key={entry.id} className="rounded-xl border border-black/10 bg-white p-3">
                <p className="text-sm font-medium text-ink">{entry.eventTitle}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {formatDraftTimeRange(entry) ?? entry.isoDate} • {minutesToDisplay(entry.roundedMinutes)} •{" "}
                  {entry.clientName} / {entry.projectName}
                </p>

                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                    onClick={() => {
                      void handleDraftApprove(entry.id);
                    }}
                    disabled={draftActionId === entry.id || !entry.projectId}
                    title={!entry.projectId ? "Assign a project before approving." : undefined}
                  >
                    Approve
                  </button>

                  <select
                    className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs"
                    defaultValue=""
                    onChange={(event) => {
                      const nextProjectId = event.target.value;
                      if (!nextProjectId) return;
                      void handleDraftReassign(entry.id, nextProjectId);
                      event.currentTarget.value = "";
                    }}
                    disabled={draftActionId === entry.id}
                  >
                    <option value="">Approve + reassign...</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.clientName} / {project.name}
                      </option>
                    ))}
                    <option value="__new__">+ New client/project...</option>
                  </select>

                  <button
                    type="button"
                    className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-ink disabled:opacity-50"
                    onClick={() => {
                      void handleDraftReject(entry.id);
                    }}
                    disabled={draftActionId === entry.id}
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-black/15 p-3 text-sm text-muted">
            No calendar drafts pending approval this week.
          </div>
        )}
      </div>

      <div className="py-2 text-center">
        <p className="font-display text-xl leading-tight text-[#8f959b]/45 italic sm:text-2xl">
          “{reflectionQuote.text}”
        </p>
        <p className="font-display mt-1 text-sm text-[#8f959b]/45 sm:text-base">- {reflectionQuote.author}</p>
      </div>
    </section>
  );
}
