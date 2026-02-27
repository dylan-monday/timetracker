"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { makeWeekDays } from "@/lib/mock-data";
import { addWeeks, subWeeks, startOfWeek, format, isSameWeek } from "date-fns";
import { ComboBox, type ComboBoxOption } from "@/components/combobox";
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
import { playSound } from "@/lib/sounds";
import type { ClientOption, DraftEntry, ProjectOption, WeekLine } from "@/lib/types";

const BUSINESS_DAY_INDEXES = [1, 2, 3, 4, 5];
const ALL_DAY_INDEXES = [1, 2, 3, 4, 5, 6, 7];
const WEEK_LINE_STORAGE_PREFIX = "mp-time-week-lines";
const LINE_ORDER_STORAGE_KEY = "mp-time-line-order";

// Pill styling for daily totals with subtle color gradation based on hours logged
// No words, no judgments — just a gentle visual shift
function dailyTotalPillClass(minutes: number): string {
  const hours = minutes / 60;
  if (hours >= 8) return "border border-accentStrong/50 bg-accent/25 text-[#2d7a3d]";
  if (hours >= 6) return "border border-accent/40 bg-accent/15 text-[#3d8a4d]";
  if (hours >= 4) return "border border-black/10 bg-black/[0.04] text-ink/70";
  if (hours > 0) return "border border-black/8 bg-black/[0.025] text-ink/60";
  return "border border-black/5 bg-transparent text-muted/60";
}

function isWeekendIsoDate(isoDate: string): boolean {
  const day = new Date(`${isoDate}T00:00:00`).getDay();
  return day === 0 || day === 6;
}

type TemporalState = "past" | "today" | "future";

function getTemporalState(isoDate: string): TemporalState {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cellDate = new Date(`${isoDate}T00:00:00`);
  cellDate.setHours(0, 0, 0, 0);

  if (cellDate.getTime() < today.getTime()) return "past";
  if (cellDate.getTime() > today.getTime()) return "future";
  return "today";
}

function temporalColumnClass(temporal: TemporalState, isWeekend: boolean): string {
  // Base weekend styling takes precedence for background
  if (isWeekend) {
    if (temporal === "today") return "rounded-xl bg-amber-50/60";
    if (temporal === "past") return "rounded-xl bg-black/[0.04]";
    return "rounded-xl bg-black/[0.02]";
  }

  // Non-weekend temporal styling
  // Today: warmer, more present
  if (temporal === "today") return "bg-amber-50/40";
  // Past: slightly muted/settled
  if (temporal === "past") return "bg-black/[0.015]";
  // Future: lighter/open
  return "";
}

function temporalCellClass(temporal: TemporalState, isWeekend: boolean): string {
  if (isWeekend) {
    if (temporal === "today") return "bg-amber-50/40";
    if (temporal === "past") return "bg-black/[0.03]";
    return "bg-black/[0.015]";
  }

  if (temporal === "today") return "bg-amber-50/30";
  if (temporal === "past") return "bg-black/[0.01]";
  return "";
}

function mobileDayLabel(dayIndex: number, todayIndex: number, fallback: string): string {
  const diff = dayIndex - todayIndex;
  if (diff === 0) return "Today";
  if (diff === -1) return "Yesterday";
  if (diff === 1) return "Tomorrow";
  return fallback;
}

type CategoryType = "client" | "internal" | "personal";

function getCategoryType(clientName: string, clientKind: string | undefined): CategoryType {
  // Personal client gets personal color
  if (clientName.toLowerCase() === "personal") return "personal";
  // External clients get client color, internal gets internal color
  if (clientKind === "external") return "client";
  return "internal";
}

function getCategoryBorderClass(category: CategoryType): string {
  switch (category) {
    case "client":
      return "border-l-[3px] border-l-[var(--color-client)]";
    case "internal":
      return "border-l-[3px] border-l-[var(--color-internal)]";
    case "personal":
      return "border-l-[3px] border-l-[var(--color-personal)]";
  }
}

function getCategoryAnimationClass(category: CategoryType): string {
  switch (category) {
    case "client":
      return "animate-row-fade-in-client";
    case "internal":
      return "animate-row-fade-in-internal";
    case "personal":
      return "animate-row-fade-in-personal";
  }
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

interface WeekGridProps {
  weekStart?: Date;
  onWeekChange?: (newWeekStart: Date) => void;
}

export function WeekGrid({ weekStart, onWeekChange }: WeekGridProps) {
  const { session, supabase, user } = useAuth();
  const weekDays = useMemo(() => makeWeekDays(weekStart), [weekStart]);

  // Week navigation helpers
  const currentWeekStart = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), []);
  const effectiveWeekStart = useMemo(
    () => weekStart ?? currentWeekStart,
    [weekStart, currentWeekStart]
  );
  const isCurrentWeek = useMemo(
    () => isSameWeek(effectiveWeekStart, new Date(), { weekStartsOn: 1 }),
    [effectiveWeekStart]
  );
  const weekDateRange = useMemo(() => {
    const firstDay = weekDays[0];
    const lastDay = weekDays[6];
    if (!firstDay || !lastDay) return "";
    const startDate = new Date(`${firstDay.isoDate}T00:00:00`);
    const endDate = new Date(`${lastDay.isoDate}T00:00:00`);
    const startMonth = format(startDate, "MMM d");
    const endMonth = format(endDate, "MMM d, yyyy");
    return `${startMonth} – ${endMonth}`;
  }, [weekDays]);

  const goToPrevWeek = useCallback(() => {
    if (onWeekChange) {
      onWeekChange(subWeeks(effectiveWeekStart, 1));
    }
  }, [effectiveWeekStart, onWeekChange]);

  const goToNextWeek = useCallback(() => {
    if (onWeekChange) {
      onWeekChange(addWeeks(effectiveWeekStart, 1));
    }
  }, [effectiveWeekStart, onWeekChange]);

  const goToCurrentWeek = useCallback(() => {
    if (onWeekChange) {
      onWeekChange(currentWeekStart);
    }
  }, [currentWeekStart, onWeekChange]);

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
  const pinnedProjectIdsRef = useRef<string[]>([]);
  const [savedCell, setSavedCell] = useState<{ lineId: string; dayIndex: number } | null>(null);
  const [newLineIds, setNewLineIds] = useState<Set<string>>(new Set());
  const [lineOrder, setLineOrder] = useState<string[]>([]);
  const [lineOrderLoaded, setLineOrderLoaded] = useState(false);
  const [draggedLineId, setDraggedLineId] = useState<string | null>(null);
  const [dragOverLineId, setDragOverLineId] = useState<string | null>(null);
  const activeInputRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(false);
  const todayDayIndex = useMemo(() => {
    const day = new Date().getDay();
    return day === 0 ? 7 : day;
  }, []);
  const [mobileDayIndex, setMobileDayIndex] = useState(todayDayIndex);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const visibleDayIndexes = showWeekends ? ALL_DAY_INDEXES : BUSINESS_DAY_INDEXES;
  const activeMobileDayIndex = visibleDayIndexes.includes(mobileDayIndex)
    ? mobileDayIndex
    : visibleDayIndexes[0];
  const weekKey = weekDays[0]?.isoDate ?? "week";

  const savePinnedProjectIds = useCallback(
    (next: string[]) => {
      setPinnedProjectIds(next);
      pinnedProjectIdsRef.current = next;
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
      pinnedProjectIdsRef.current = [];
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((item) => typeof item === "string");
        setPinnedProjectIds(filtered);
        pinnedProjectIdsRef.current = filtered;
      } else {
        setPinnedProjectIds([]);
        pinnedProjectIdsRef.current = [];
      }
    } catch {
      setPinnedProjectIds([]);
      pinnedProjectIdsRef.current = [];
    }
  }, [weekKey]);

  useEffect(() => {
    if (!visibleDayIndexes.includes(mobileDayIndex)) {
      setMobileDayIndex(visibleDayIndexes.includes(todayDayIndex) ? todayDayIndex : visibleDayIndexes[0]);
    }
  }, [mobileDayIndex, todayDayIndex, visibleDayIndexes]);

  // Load line order from localStorage synchronously before paint
  // Using useLayoutEffect ensures order is applied before user sees content
  useLayoutEffect(() => {
    try {
      const raw = window.localStorage.getItem(LINE_ORDER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setLineOrder(parsed.filter((item): item is string => typeof item === "string"));
        }
      }
    } catch {
      // Ignore errors
    }
    setLineOrderLoaded(true);
  }, []);

  // Load line order from Supabase (for cross-device sync)
  useEffect(() => {
    if (!supabase || !user) return;

    const loadFromSupabase = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("line_order")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("[LineOrder] Failed to load from Supabase:", error.message);
        return;
      }

      if (data?.line_order && Array.isArray(data.line_order) && data.line_order.length > 0) {
        const supabaseOrder = data.line_order.filter((item): item is string => typeof item === "string");
        setLineOrder(supabaseOrder);
        window.localStorage.setItem(LINE_ORDER_STORAGE_KEY, JSON.stringify(supabaseOrder));
      }
    };

    void loadFromSupabase();
  }, [supabase, user]);

  // Save line order to localStorage and Supabase
  const saveLineOrder = useCallback(async (order: string[]) => {
    console.log("[LineOrder] Saving order:", order.length, "items");
    setLineOrder(order);
    // Save to localStorage immediately
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LINE_ORDER_STORAGE_KEY, JSON.stringify(order));
      console.log("[LineOrder] Saved to localStorage");
    }
    // Save to Supabase
    if (supabase && user) {
      console.log("[LineOrder] Saving to Supabase for user:", user.id);
      const { error } = await supabase
        .from("profiles")
        .update({ line_order: order })
        .eq("id", user.id);

      if (error) {
        console.error("[LineOrder] Failed to save to Supabase:", error.message);
      } else {
        console.log("[LineOrder] Saved to Supabase successfully");
      }
    } else {
      console.warn("[LineOrder] No supabase or user available", { supabase: !!supabase, user: !!user });
    }
  }, [supabase, user]);

  // Sort lines based on saved order
  const sortedLines = useMemo(() => {
    // If order not loaded yet or no saved order, return lines as-is
    if (!lineOrderLoaded || lineOrder.length === 0) return lines;

    const orderMap = new Map(lineOrder.map((id, index) => [id, index]));
    return [...lines].sort((a, b) => {
      const aIndex = orderMap.get(a.id) ?? Infinity;
      const bIndex = orderMap.get(b.id) ?? Infinity;
      return aIndex - bIndex;
    });
  }, [lines, lineOrder, lineOrderLoaded]);

  // Handle drag start
  const handleDragStart = useCallback((e: React.DragEvent, lineId: string) => {
    setDraggedLineId(lineId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", lineId);
    // Add a slight delay to allow the drag image to be captured
    setTimeout(() => {
      const target = e.target as HTMLElement;
      target.style.opacity = "0.5";
    }, 0);
  }, []);

  // Handle drag end
  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const target = e.target as HTMLElement;
    target.style.opacity = "1";
    setDraggedLineId(null);
    setDragOverLineId(null);
  }, []);

  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent, lineId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (lineId !== draggedLineId) {
      setDragOverLineId(lineId);
    }
  }, [draggedLineId]);

  // Handle drop - reorder lines
  const handleDrop = useCallback((e: React.DragEvent, targetLineId: string) => {
    e.preventDefault();
    const sourceLineId = e.dataTransfer.getData("text/plain");

    if (!sourceLineId || sourceLineId === targetLineId) {
      setDragOverLineId(null);
      return;
    }

    // Get current order (using sortedLines to respect existing order)
    const currentOrder = sortedLines.map((line) => line.id);
    const sourceIndex = currentOrder.indexOf(sourceLineId);
    const targetIndex = currentOrder.indexOf(targetLineId);

    if (sourceIndex === -1 || targetIndex === -1) {
      setDragOverLineId(null);
      return;
    }

    // Remove source and insert at target position
    const newOrder = [...currentOrder];
    newOrder.splice(sourceIndex, 1);
    newOrder.splice(targetIndex, 0, sourceLineId);

    saveLineOrder(newOrder);
    setDragOverLineId(null);
  }, [sortedLines, saveLineOrder]);

  const refreshWeekData = useCallback(async () => {
    if (!user || !supabase) return;

    setLoading(true);
    setError(null);

    try {
      const { clients: dbClients, projects: dbProjects } = await fetchClientsAndProjects(supabase);
      const [dbLines, dbDrafts] = await Promise.all([
        fetchWeekLines(supabase, dbProjects, pinnedProjectIdsRef.current, effectiveWeekStart),
        fetchWeekDraftEntries(supabase, effectiveWeekStart)
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
  }, [supabase, user, effectiveWeekStart]);

  useEffect(() => {
    void refreshWeekData();
  }, [refreshWeekData]);

  const totalsByDay = useMemo(() => {
    return visibleDayIndexes.reduce<Record<number, number>>((acc, dayIndex) => {
      acc[dayIndex] = lines.reduce((sum, line) => sum + (line.cells[String(dayIndex)] ?? 0), 0);
      return acc;
    }, {});
  }, [lines, visibleDayIndexes]);
  const mobileDay = weekDays[activeMobileDayIndex - 1];
  const mobileMinutes = totalsByDay[activeMobileDayIndex] ?? 0;
  const mobilePrimaryLabel = mobileDayLabel(activeMobileDayIndex, todayDayIndex, mobileDay?.label ?? "");

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

  const handleMobileSwipeStart = (x: number) => {
    setTouchStartX(x);
  };

  const handleMobileSwipeEnd = (x: number) => {
    if (touchStartX === null) return;
    const delta = x - touchStartX;
    if (Math.abs(delta) < 38) {
      setTouchStartX(null);
      return;
    }
    if (delta < 0) {
      shiftMobileDay(1);
    } else {
      shiftMobileDay(-1);
    }
    setTouchStartX(null);
  };

  const handleCellSubmit = async () => {
    // Prevent double submission from both onKeyDown and onBlur firing
    if (isSubmittingRef.current) {
      return;
    }

    if (!activeCell || !user || !supabase) {
      setActiveCell(null);
      setEntryInput("");
      return;
    }

    // Mark submission in progress BEFORE blur to prevent race condition
    isSubmittingRef.current = true;

    // Explicitly blur the input first to dismiss mobile keyboard immediately
    activeInputRef.current?.blur();

    const cellToSave = { lineId: activeCell.lineId, dayIndex: activeCell.dayIndex };

    const rounded = parseAndRoundTimeInput(entryInput);
    if (rounded === null) {
      setActiveCell(null);
      setEntryInput("");
      isSubmittingRef.current = false;
      return;
    }

    const line = lines.find((item) => item.id === activeCell.lineId);
    if (!line?.projectId) {
      setActiveCell(null);
      setEntryInput("");
      isSubmittingRef.current = false;
      return;
    }

    const isoDate = weekDays[activeCell.dayIndex - 1]?.isoDate;
    if (!isoDate) {
      setActiveCell(null);
      setEntryInput("");
      isSubmittingRef.current = false;
      return;
    }

    // Clear active state immediately for responsive feel
    setActiveCell(null);
    setEntryInput("");

    setLines((current) =>
      current.map((item) => {
        if (item.id !== cellToSave.lineId) return item;
        return {
          ...item,
          cells: {
            ...item.cells,
            [String(cellToSave.dayIndex)]: rounded
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

      // Show saved confirmation briefly
      setSavedCell(cellToSave);
      playSound("save");
      setTimeout(() => {
        setSavedCell((current) =>
          current?.lineId === cellToSave.lineId && current?.dayIndex === cellToSave.dayIndex
            ? null
            : current
        );
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save entry.");
      await refreshWeekData();
    } finally {
      setSaving(false);
      isSubmittingRef.current = false;
    }
  };

  const filteredProjects = useMemo(() => {
    if (!quickClient.trim()) return projects;
    const client = clients.find((item) => item.name.toLowerCase() === quickClient.trim().toLowerCase());
    if (!client) return projects;

    return projects.filter((project) => project.clientId === client.id);
  }, [clients, projects, quickClient]);

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

      // Add new client to local state if it doesn't exist
      setClients((current) => {
        if (current.some((c) => c.id === project.clientId)) return current;
        return [...current, { id: project.clientId, name: project.clientName, kind: "external" as const }]
          .sort((a, b) => a.name.localeCompare(b.name));
      });

      // Add new project to local state if it doesn't exist
      setProjects((current) => {
        if (current.some((p) => p.id === project.id)) return current;
        return [...current, {
          id: project.id,
          name: project.name,
          clientId: project.clientId,
          clientName: project.clientName
        }].sort((a, b) => `${a.clientName} ${a.name}`.localeCompare(`${b.clientName} ${b.name}`));
      });

      // Check if line already exists before state update
      const existingLineForProject = lines.some((line) => line.projectId === project.id);
      const newLineId = `line-${project.id}`;

      // Update lines state (pure function, no side effects)
      setLines((current) => {
        // Double-check in case state changed
        const exists = current.some((line) => line.projectId === project.id);
        if (exists) {
          return current;
        }

        return [
          ...current,
          {
            id: newLineId,
            projectId: project.id,
            clientId: project.clientId,
            clientName: project.clientName,
            projectName: project.name,
            cells: {},
            isDraft: false
          }
        ];
      });

      // Handle side effects OUTSIDE the setLines callback
      if (!existingLineForProject) {
        // Update pinned IDs
        savePinnedProjectIds([...pinnedProjectIds, project.id]);

        // Mark this line as new for animation
        setNewLineIds((prev) => new Set(prev).add(newLineId));
        playSound("add");
        // Remove from new lines set after animation completes
        setTimeout(() => {
          setNewLineIds((prev) => {
            const next = new Set(prev);
            next.delete(newLineId);
            return next;
          });
        }, 800);
      } else if (!pinnedProjectIds.includes(project.id)) {
        // Line exists but not pinned - just pin it
        savePinnedProjectIds([...pinnedProjectIds, project.id]);
      }

      setQuickClient("");
      setQuickProject("");
      setShowQuickAdd(false);
      // Note: We don't call refreshWeekData() here because:
      // 1. The optimistic update already added the line to state
      // 2. refreshWeekData uses stale pinnedProjectIds from closure
      // 3. The new project is already in clients/projects from ensureClientAndProject
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
      playSound("complete");
      await refreshWeekData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve draft entry.");
      playSound("error");
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
      playSound("close");
      await refreshWeekData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reject draft entry.");
      playSound("error");
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
            sourceErrors?: Array<{ source?: string; error?: string }>;
          }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Calendar sync failed.");
      }

      const imported = payload?.imported ?? 0;
      const updated = payload?.updated ?? 0;
      const calendarsScanned = payload?.calendarsScanned ?? 0;
      const baseMessage =
        imported || updated
          ? `Calendar sync complete: ${imported} imported, ${updated} updated across ${calendarsScanned} calendars.`
          : `Calendar sync complete: no events imported. Scanned ${calendarsScanned} calendars for this week.`;
      const sourceErrors = (payload?.sourceErrors ?? []).filter(
        (item) => (item?.source ?? "").trim() && (item?.error ?? "").trim()
      );
      setSyncMessage(
        `${baseMessage}${
          sourceErrors.length
            ? ` Issues: ${sourceErrors
                .slice(0, 2)
                .map((item) => `${item.source}: ${item.error}`)
                .join(" | ")}`
            : ""
        }`
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
      <div className={`rounded-2xl border bg-panel p-4 shadow-soft ${
        isCurrentWeek
          ? "border-black/5"
          : "border-amber-400/40 ring-1 ring-amber-400/20"
      }`}>
        {/* Week navigation header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-black/10 bg-white p-2 transition hover:bg-black/5"
              onClick={goToPrevWeek}
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded-full border border-black/10 bg-white p-2 transition hover:bg-black/5"
              onClick={goToNextWeek}
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="ml-1 text-sm font-medium text-ink">{weekDateRange}</span>
            {!isCurrentWeek && (
              <button
                type="button"
                className="ml-2 rounded-full border border-amber-500/30 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-100"
                onClick={goToCurrentWeek}
              >
                Back to today
              </button>
            )}
          </div>
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
          <div
            className="mb-3 rounded-xl border border-black/10 bg-white p-3"
            onTouchStart={(event) => handleMobileSwipeStart(event.changedTouches[0]?.clientX ?? 0)}
            onTouchEnd={(event) => handleMobileSwipeEnd(event.changedTouches[0]?.clientX ?? 0)}
          >
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
                {mobilePrimaryLabel}
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
              <span className={`font-numeric rounded-full px-3 py-1 text-sm font-medium ${dailyTotalPillClass(mobileMinutes)}`}>
                {minutesToDisplay(mobileMinutes)}
              </span>
            </div>
          </div>

          <table className="w-full border-separate border-spacing-y-2 text-sm">
            <tbody>
              {sortedLines.map((line) => {
                const isActive =
                  activeCell?.lineId === line.id && activeCell?.dayIndex === activeMobileDayIndex;
                const value = line.cells[String(activeMobileDayIndex)] ?? 0;
                const clientKind = clients.find((c) => c.id === line.clientId)?.kind;
                const category = getCategoryType(line.clientName, clientKind);
                const isNew = newLineIds.has(line.id);
                return (
                  <tr key={`mobile-${line.id}`} className={`rounded-xl bg-white/90 shadow-[0_1px_0_rgba(0,0,0,0.05)] ${isNew ? getCategoryAnimationClass(category) : ""}`}>
                    <td className={`rounded-l-xl px-3 py-3 align-middle ${getCategoryBorderClass(category)}`}>
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
                          ref={activeInputRef}
                          autoFocus
                          enterKeyHint="done"
                          value={entryInput}
                          onChange={(event) => setEntryInput(event.target.value)}
                          onBlur={() => {
                            void handleCellSubmit();
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
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
                          className={`w-full rounded-lg border px-2 py-1.5 text-left text-sm transition ${
                            savedCell?.lineId === line.id && savedCell?.dayIndex === activeMobileDayIndex
                              ? "border-emerald-400 bg-emerald-50"
                              : "border-transparent hover:border-black/10 hover:bg-canvas"
                          }`}
                        >
                          {savedCell?.lineId === line.id && savedCell?.dayIndex === activeMobileDayIndex ? (
                            <span className="flex items-center gap-1.5 text-emerald-600">
                              <Check className="h-3.5 w-3.5" />
                              <span className="font-numeric">{minutesToDisplay(value)}</span>
                            </span>
                          ) : (
                            <span className="font-numeric">{minutesToDisplay(value)}</span>
                          )}
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
              Clean slate. Add a project line to start capturing your day.
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
                  const isWeekend = isWeekendIsoDate(day.isoDate);
                  const temporal = getTemporalState(day.isoDate);

                  return (
                    <th
                      key={day.isoDate}
                      className={`px-3 py-2 ${temporalColumnClass(temporal, isWeekend)} ${
                        dayPosition > 0 ? "border-l border-black/10" : ""
                      }`}
                    >
                      <div className="mb-2">
                        <p className={`text-xs font-medium uppercase tracking-wide ${
                          temporal === "today" ? "text-amber-700/70" : "text-muted"
                        }`}>
                          {day.label} {day.day}
                          {temporal === "today" && <span className="ml-1.5 text-[10px] font-medium normal-case tracking-normal">today</span>}
                        </p>
                      </div>
                      <div className={`font-numeric rounded-full px-3 py-1.5 text-[13px] font-medium ${dailyTotalPillClass(minutes)}`}>
                        {minutesToDisplay(minutes)}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedLines.map((line) => {
                const clientKind = clients.find((c) => c.id === line.clientId)?.kind;
                const category = getCategoryType(line.clientName, clientKind);
                const isNew = newLineIds.has(line.id);
                const isDragOver = dragOverLineId === line.id;
                return (
                <tr
                  key={line.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, line.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, line.id)}
                  onDrop={(e) => handleDrop(e, line.id)}
                  className={`cursor-move rounded-xl bg-white/90 shadow-[0_1px_0_rgba(0,0,0,0.05)] transition-all ${isNew ? getCategoryAnimationClass(category) : ""} ${isDragOver ? "ring-2 ring-accent/50" : ""}`}
                >
                  <td className={`rounded-l-xl px-3 py-3 align-middle ${getCategoryBorderClass(category)}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="select-none text-sm font-medium text-ink">
                        {line.projectName}
                      </p>
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
                    const temporal = getTemporalState(day.isoDate);
                    const isActive =
                      activeCell?.lineId === line.id && activeCell?.dayIndex === dayIndex;
                    const value = line.cells[String(dayIndex)] ?? 0;

                    return (
                      <td
                        key={`${line.id}-${dayIndex}`}
                        className={`px-3 py-2 ${temporalCellClass(temporal, isWeekend)} ${
                          dayPosition > 0 ? "border-l border-black/10" : ""
                        }`}
                      >
                        {isActive ? (
                          <input
                            ref={activeInputRef}
                            autoFocus
                            enterKeyHint="done"
                            value={entryInput}
                            onChange={(event) => setEntryInput(event.target.value)}
                            onBlur={() => {
                              void handleCellSubmit();
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
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
                            className={`w-full rounded-lg border px-2 py-1.5 text-left text-sm transition ${
                              savedCell?.lineId === line.id && savedCell?.dayIndex === dayIndex
                                ? "border-emerald-400 bg-emerald-50"
                                : "border-transparent hover:border-black/10 hover:bg-canvas"
                            }`}
                          >
                            {savedCell?.lineId === line.id && savedCell?.dayIndex === dayIndex ? (
                              <span className="flex items-center gap-1.5 text-emerald-600">
                                <Check className="h-3.5 w-3.5" />
                                <span className="font-numeric">{minutesToDisplay(value)}</span>
                              </span>
                            ) : (
                              <span className="font-numeric">{minutesToDisplay(value)}</span>
                            )}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
                );
              })}
            </tbody>
          </table>

          {!lines.length && !loading ? (
            <div className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-muted">
              Clean slate. Add a project line to start capturing your day.
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium transition-all duration-200 hover:scale-[1.02] hover:shadow-md active:scale-[0.98]"
            onClick={() => { playSound("navigate"); setShowQuickAdd(true); }}
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
          onClick={() => { playSound("close"); setShowQuickAdd(false); }}
        >
          <aside
            className="fixed inset-x-0 bottom-0 z-30 rounded-t-3xl border border-black/10 bg-panel p-4 shadow-[0_-20px_50px_rgba(0,0,0,0.14)] sm:inset-x-auto sm:left-1/2 sm:mx-auto sm:mb-6 sm:w-full sm:max-w-xl sm:-translate-x-1/2 sm:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-base font-medium">Add a project line</h2>
            <p className="mt-1 text-sm text-muted">Pick an existing project or create one on the fly.</p>

            <div className="mt-4 space-y-3">
              <div className="block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">Client</span>
                <ComboBox
                  options={clients.map((client): ComboBoxOption => ({
                    id: client.id,
                    label: client.name
                  }))}
                  value={quickClient}
                  onChange={setQuickClient}
                  placeholder="Type to search or create..."
                  allowCreate
                  createLabel="Add new client"
                  autoFocus
                  dropUp
                />
              </div>
              <div className="block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">Project</span>
                <ComboBox
                  options={filteredProjects.map((project): ComboBoxOption => ({
                    id: project.id,
                    label: project.name
                  }))}
                  value={quickProject}
                  onChange={setQuickProject}
                  placeholder="Type to search or create..."
                  allowCreate
                  createLabel="Add new project"
                  dropUp
                />
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                onClick={() => { playSound("close"); setShowQuickAdd(false); }}
              >
                Close
              </button>
              <button
                type="button"
                className="flex-1 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
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
            <h2 className="text-base font-medium">Create project for draft</h2>
            <p className="mt-1 text-sm text-muted">
              Choose an existing client or type a new one, then add the project.
            </p>

            <div className="mt-4 space-y-3">
              <div className="block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">Client</span>
                <ComboBox
                  options={clients.map((client): ComboBoxOption => ({
                    id: client.id,
                    label: client.name
                  }))}
                  value={draftCreateClient}
                  onChange={setDraftCreateClient}
                  placeholder="Type to search or create..."
                  allowCreate
                  createLabel="Add new client"
                  autoFocus
                  dropUp
                />
              </div>

              <div className="block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">Project</span>
                <ComboBox
                  options={projects
                    .filter((p) => {
                      if (!draftCreateClient.trim()) return true;
                      const client = clients.find((c) => c.name.toLowerCase() === draftCreateClient.trim().toLowerCase());
                      return client ? p.clientId === client.id : true;
                    })
                    .map((project): ComboBoxOption => ({
                      id: project.id,
                      label: project.name
                    }))}
                  value={draftCreateProject}
                  onChange={setDraftCreateProject}
                  placeholder="Type to search or create..."
                  allowCreate
                  createLabel="Add new project"
                  dropUp
                />
              </div>
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
        <h2 className="text-base font-medium">Calendar imports</h2>
        <p className="mt-1 text-sm text-muted">
          Meetings from your calendar show up here as drafts. Approve them, move to a different project, or skip.
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
            No calendar imports to review this week.
          </div>
        )}
      </div>

    </section>
  );
}
