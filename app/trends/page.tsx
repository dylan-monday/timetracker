"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";

type RangeKey = "week" | "month" | "quarter" | "year";

const ranges: Array<{ key: RangeKey; label: string }> = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "quarter", label: "Quarter" },
  { key: "year", label: "Year" }
];

// Get the start date for a period with an offset (0 = current, -1 = previous, etc.)
function getStartDateForPeriod(range: RangeKey, offset: number): string {
  const now = new Date();

  if (range === "week") {
    const d = new Date(now);
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - day + 1 + offset * 7);
    return d.toISOString().slice(0, 10);
  }

  if (range === "month") {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return d.toISOString().slice(0, 10);
  }

  if (range === "quarter") {
    const currentQuarter = Math.floor(now.getMonth() / 3);
    const targetQuarter = currentQuarter + offset;
    const targetYear = now.getFullYear() + Math.floor(targetQuarter / 4);
    const targetMonth = ((targetQuarter % 4) + 4) % 4 * 3;
    return new Date(targetYear, targetMonth, 1).toISOString().slice(0, 10);
  }

  // Year
  return new Date(now.getFullYear() + offset, 0, 1).toISOString().slice(0, 10);
}

function getEndDateForPeriod(range: RangeKey, offset: number): string {
  const startDate = new Date(getStartDateForPeriod(range, offset));

  if (range === "week") {
    const d = new Date(startDate);
    d.setDate(d.getDate() + 6);
    return d.toISOString().slice(0, 10);
  }

  if (range === "month") {
    const d = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
    return d.toISOString().slice(0, 10);
  }

  if (range === "quarter") {
    const d = new Date(startDate.getFullYear(), startDate.getMonth() + 3, 0);
    return d.toISOString().slice(0, 10);
  }

  // Year
  return new Date(startDate.getFullYear(), 11, 31).toISOString().slice(0, 10);
}

function formatPeriodLabel(range: RangeKey, offset: number): string {
  const startDate = new Date(getStartDateForPeriod(range, offset));

  const formatShort = (d: Date) => {
    const month = d.toLocaleDateString("en-US", { month: "short" });
    return `${month} ${d.getDate()}`;
  };

  if (range === "week") {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    return `${formatShort(startDate)}–${formatShort(endDate)}`;
  }

  if (range === "month") {
    return startDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  if (range === "quarter") {
    const q = Math.floor(startDate.getMonth() / 3) + 1;
    return `Q${q} ${startDate.getFullYear()}`;
  }

  return startDate.getFullYear().toString();
}

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42703" || (error.message ?? "").toLowerCase().includes("does not exist");
}

interface PeriodTotals {
  total: number;
  client: number;
  internal: number;
  personal: number;
}

interface ProjectRow {
  projectId: string;
  projectName: string;
  clientName: string;
  clientKind: string | null;
  minutes: number;
  hourlyRateCents: number | null;
  clientHourlyRateCents: number | null;
}

type CategoryType = "client" | "internal" | "personal";

function getCategoryType(clientName: string, clientKind: string | null | undefined): CategoryType {
  if (clientName.toLowerCase() === "personal") return "personal";
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

function getSummaryAccentClass(category: CategoryType | null): string {
  switch (category) {
    case "client":
      return "border-b-2 border-b-[var(--color-client)]/40";
    case "internal":
      return "border-b-2 border-b-[var(--color-internal)]/40";
    case "personal":
      return "border-b-2 border-b-[var(--color-personal)]/40";
    default:
      return "";
  }
}

// Simple sparkline component
function Sparkline({ data, className = "" }: { data: number[]; className?: string }) {
  if (data.length < 2) return null;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const width = 60;
  const height = 20;
  const padding = 2;

  const points = data.map((value, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} className={className}>
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function TrendsPage() {
  const { supabase } = useAuth();
  const [range, setRange] = useState<RangeKey>("week");
  const [periodOffset, setPeriodOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hourlyRateCents, setHourlyRateCents] = useState(0);
  const [totals, setTotals] = useState<PeriodTotals>({ total: 0, client: 0, internal: 0, personal: 0 });
  const [prevTotals, setPrevTotals] = useState<PeriodTotals | null>(null);
  const [historicalTotals, setHistoricalTotals] = useState<PeriodTotals[]>([]);
  const [topClients, setTopClients] = useState<Array<{ name: string; minutes: number }>>([]);
  const [personalProjects, setPersonalProjects] = useState<Array<{ name: string; minutes: number }>>([]);
  const [projectBudgetRows, setProjectBudgetRows] = useState<
    Array<ProjectRow & { budgetCents: number }>
  >([]);
  const [projectValueRows, setProjectValueRows] = useState<ProjectRow[]>([]);

  // Fetch data for a specific period
  const fetchPeriodData = useCallback(async (
    supabaseClient: NonNullable<typeof supabase>,
    rangeKey: RangeKey,
    offset: number
  ): Promise<{ totals: PeriodTotals; projects: ProjectRow[]; topClients: Array<{ name: string; minutes: number }>; personalProjects: Array<{ name: string; minutes: number }> }> => {
    const startDate = getStartDateForPeriod(rangeKey, offset);
    const endDate = getEndDateForPeriod(rangeKey, offset);

    let { data, error: queryError } = await supabaseClient
      .from("time_entries")
      .select(
        "rounded_minutes,project_id,projects(id,name,budget_cents,hourly_rate_cents,clients(name,kind,hourly_rate_cents))"
      )
      .eq("status", "approved")
      .gte("entry_date", startDate)
      .lte("entry_date", endDate);

    if (isMissingColumnError(queryError)) {
      const fallback = await supabaseClient
        .from("time_entries")
        .select("rounded_minutes,project_id,projects(id,name,budget_cents,hourly_rate_cents,clients(name,kind))")
        .eq("status", "approved")
        .gte("entry_date", startDate)
        .lte("entry_date", endDate);
      data = fallback.data;
      queryError = fallback.error;
    }

    if (queryError) throw queryError;

    const periodTotals: PeriodTotals = { total: 0, client: 0, internal: 0, personal: 0 };
    const perProject = new Map<string, ProjectRow>();
    const clientMinutes = new Map<string, number>();
    const personalProjectMinutes = new Map<string, number>();

    for (const row of data ?? []) {
      const minutes = row.rounded_minutes ?? 0;
      const project = row.projects as
        | {
            id?: string;
            name?: string;
            budget_cents?: number | null;
            hourly_rate_cents?: number | null;
            clients?: { name?: string; kind?: string; hourly_rate_cents?: number | null };
          }
        | null;
      const clientKind = project?.clients?.kind;
      const clientName = project?.clients?.name ?? "";
      const clientNameLower = clientName.toLowerCase();
      const projectName = project?.name ?? "Untitled";

      periodTotals.total += minutes;

      if (clientNameLower === "personal") {
        periodTotals.personal += minutes;
        personalProjectMinutes.set(projectName, (personalProjectMinutes.get(projectName) ?? 0) + minutes);
      }

      if (clientKind === "internal") {
        periodTotals.internal += minutes;
      } else {
        periodTotals.client += minutes;
        if (clientName) {
          clientMinutes.set(clientName, (clientMinutes.get(clientName) ?? 0) + minutes);
        }
      }

      if (project?.id) {
        const current = perProject.get(project.id) ?? {
          projectId: project.id,
          projectName,
          clientName,
          clientKind: clientKind ?? null,
          minutes: 0,
          hourlyRateCents: project.hourly_rate_cents ?? null,
          clientHourlyRateCents: project.clients?.hourly_rate_cents ?? null
        };
        current.minutes += minutes;
        perProject.set(project.id, current);
      }
    }

    return {
      totals: periodTotals,
      projects: Array.from(perProject.values()).filter(p => p.minutes > 0).sort((a, b) => b.minutes - a.minutes),
      topClients: Array.from(clientMinutes.entries())
        .map(([name, mins]) => ({ name, minutes: mins }))
        .sort((a, b) => b.minutes - a.minutes)
        .slice(0, 3),
      personalProjects: Array.from(personalProjectMinutes.entries())
        .map(([name, mins]) => ({ name, minutes: mins }))
        .sort((a, b) => b.minutes - a.minutes)
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Get hourly rate
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("hourly_rate_cents")
          .maybeSingle();
        if (profileError && profileError.code !== "PGRST116") throw profileError;
        const rateCents = profile?.hourly_rate_cents ?? 0;

        // Fetch current period
        const current = await fetchPeriodData(supabase, range, periodOffset);

        // Fetch previous period for comparison
        const previous = await fetchPeriodData(supabase, range, periodOffset - 1);

        // Fetch historical data for sparklines (last 8 periods including current)
        const historicalPromises = [];
        for (let i = 0; i < 8; i++) {
          historicalPromises.push(fetchPeriodData(supabase, range, periodOffset - 7 + i));
        }
        const historicalResults = await Promise.all(historicalPromises);

        // Fetch budget data for current period
        const startDate = getStartDateForPeriod(range, periodOffset);
        const endDate = getEndDateForPeriod(range, periodOffset);
        const { data: budgetData } = await supabase
          .from("time_entries")
          .select("rounded_minutes,project_id,projects(id,name,budget_cents,hourly_rate_cents,clients(name,kind,hourly_rate_cents))")
          .eq("status", "approved")
          .gte("entry_date", startDate)
          .lte("entry_date", endDate);

        const budgetProjects = new Map<string, ProjectRow & { budgetCents: number }>();
        for (const row of budgetData ?? []) {
          const project = row.projects as { id?: string; name?: string; budget_cents?: number | null; hourly_rate_cents?: number | null; clients?: { name?: string; kind?: string; hourly_rate_cents?: number | null } } | null;
          if (project?.id && project?.budget_cents && project.budget_cents > 0) {
            const existing = budgetProjects.get(project.id) ?? {
              projectId: project.id,
              projectName: project.name ?? "Untitled",
              clientName: project.clients?.name ?? "Client",
              clientKind: project.clients?.kind ?? null,
              minutes: 0,
              budgetCents: project.budget_cents,
              hourlyRateCents: project.hourly_rate_cents ?? null,
              clientHourlyRateCents: project.clients?.hourly_rate_cents ?? null
            };
            existing.minutes += row.rounded_minutes ?? 0;
            budgetProjects.set(project.id, existing);
          }
        }

        if (mounted) {
          setHourlyRateCents(rateCents);
          setTotals(current.totals);
          setPrevTotals(previous.totals);
          setHistoricalTotals(historicalResults.map(r => r.totals));
          setTopClients(current.topClients);
          setPersonalProjects(current.personalProjects);
          setProjectValueRows(current.projects);
          setProjectBudgetRows(Array.from(budgetProjects.values()).sort((a, b) => b.minutes - a.minutes));
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Could not load trend data.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [range, periodOffset, supabase, fetchPeriodData]);

  // Period navigation
  const canGoForward = periodOffset < 0;
  const periodLabel = useMemo(() => formatPeriodLabel(range, periodOffset), [range, periodOffset]);

  const goToPreviousPeriod = () => setPeriodOffset(o => o - 1);
  const goToNextPeriod = () => {
    if (canGoForward) setPeriodOffset(o => o + 1);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") {
        goToPreviousPeriod();
      } else if (e.key === "ArrowRight" && canGoForward) {
        goToNextPeriod();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canGoForward]);

  // Reset offset when range changes
  useEffect(() => {
    setPeriodOffset(0);
  }, [range]);

  const fmtMoney = (cents: number) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
      cents / 100
    );

  const toHours = (minutes: number) => `${(minutes / 60).toFixed(1)}h`;

  // Comparison helper
  const getComparison = (current: number, previous: number | undefined) => {
    if (previous === undefined) return null;
    const diff = current - previous;
    const diffHours = Math.abs(diff / 60);
    if (diffHours < 0.5) return { type: "same" as const, text: `— same as last ${range}` };
    if (diff > 0) return { type: "up" as const, text: `↑ ${diffHours.toFixed(1)}h vs last ${range}` };
    return { type: "down" as const, text: `↓ ${diffHours.toFixed(1)}h vs last ${range}` };
  };

  // Summary cards with sparklines and comparisons
  const cards = useMemo(() => {
    const sparklineData = (key: keyof PeriodTotals) => historicalTotals.map(t => t[key] / 60);

    return [
      {
        label: "Total",
        value: toHours(totals.total),
        sparkline: sparklineData("total"),
        comparison: getComparison(totals.total, prevTotals?.total),
        category: null as CategoryType | null
      },
      {
        label: "Client delivery",
        value: toHours(totals.client),
        sparkline: sparklineData("client"),
        comparison: getComparison(totals.client, prevTotals?.client),
        category: "client" as CategoryType | null
      },
      {
        label: "Internal investment",
        value: toHours(totals.internal),
        sparkline: sparklineData("internal"),
        comparison: getComparison(totals.internal, prevTotals?.internal),
        category: "internal" as CategoryType | null
      },
      {
        label: "Personal",
        value: toHours(totals.personal),
        sparkline: sparklineData("personal"),
        comparison: getComparison(totals.personal, prevTotals?.personal),
        category: "personal" as CategoryType | null
      }
    ];
  }, [totals, prevTotals, historicalTotals, range]);

  // Enhanced narrative
  const narrative = useMemo(() => {
    if (loading || totals.total === 0) return null;

    const parts: string[] = [];
    const personalValueCents = Math.round((totals.personal / 60) * hourlyRateCents);

    // Main focus with top clients
    if (totals.client > totals.internal && totals.client > totals.personal) {
      const clientNames = topClients.slice(0, 2).map(c => c.name);
      const clientHours = topClients.slice(0, 2).reduce((sum, c) => sum + c.minutes, 0) / 60;
      if (clientNames.length > 0) {
        parts.push(`Most of your ${range} went to client delivery — ${clientNames.join(" and ")} took the biggest share at ${clientHours.toFixed(1)}h combined.`);
      } else {
        parts.push(`Most of your ${range} went to client delivery.`);
      }
    } else if (totals.internal > totals.client && totals.internal > totals.personal) {
      parts.push(`You focused on internal investment this ${range} at ${toHours(totals.internal)}.`);
    }

    // Personal time with dollar value
    if (totals.personal > 0) {
      const personalProjectNames = personalProjects.slice(0, 2).map(p => p.name.toLowerCase());
      const personalDesc = personalProjectNames.length > 0
        ? ` (${personalProjectNames.join(" and ")})`
        : "";
      if (hourlyRateCents > 0) {
        parts.push(`You invested ${toHours(totals.personal)} in yourself${personalDesc} — worth about ${fmtMoney(personalValueCents)} at your rate.`);
      } else {
        parts.push(`You invested ${toHours(totals.personal)} in yourself${personalDesc}.`);
      }
    } else if (totals.total > 0) {
      parts.push("No personal time captured — not a judgment, just a mirror.");
    }

    // Comparison to previous period
    if (prevTotals && prevTotals.total > 0) {
      const clientDiff = totals.client - prevTotals.client;
      const clientDiffPct = prevTotals.client > 0 ? Math.round((clientDiff / prevTotals.client) * 100) : 0;
      if (Math.abs(clientDiffPct) >= 10) {
        if (clientDiff > 0) {
          parts.push(`Client delivery is up ${clientDiffPct}% compared to last ${range}.`);
        } else {
          parts.push(`Client delivery is down ${Math.abs(clientDiffPct)}% from last ${range}.`);
        }
      }
    }

    return parts.join(" ");
  }, [loading, totals, prevTotals, topClients, personalProjects, hourlyRateCents, range]);

  // Value rows with dollar values
  const valueRows = useMemo(() => {
    return projectValueRows.map((row) => {
      const effectiveRateCents =
        row.hourlyRateCents && row.hourlyRateCents > 0
          ? row.hourlyRateCents
          : row.clientHourlyRateCents && row.clientHourlyRateCents > 0
            ? row.clientHourlyRateCents
            : hourlyRateCents;
      const valueCents = Math.round((row.minutes / 60) * effectiveRateCents);
      return { ...row, effectiveRateCents, valueCents };
    });
  }, [hourlyRateCents, projectValueRows]);

  // Budget rows
  const budgetRows = useMemo(() => {
    return projectBudgetRows.map((row) => {
      const effectiveRateCents =
        row.hourlyRateCents && row.hourlyRateCents > 0
          ? row.hourlyRateCents
          : row.clientHourlyRateCents && row.clientHourlyRateCents > 0
            ? row.clientHourlyRateCents
            : hourlyRateCents;
      const burnCents = Math.round((row.minutes / 60) * effectiveRateCents);
      const remainingCents = row.budgetCents - burnCents;
      const burnPct = row.budgetCents > 0 ? Math.min(100, Math.round((burnCents / row.budgetCents) * 100)) : 0;

      return {
        ...row,
        effectiveRateCents,
        burnCents,
        remainingCents,
        burnPct
      };
    });
  }, [hourlyRateCents, projectBudgetRows]);

  return (
    <AppShell title="Trends">
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <section className="rounded-2xl border border-black/5 bg-panel p-4 shadow-soft">
        {/* Range selector */}
        <div className="flex flex-wrap gap-2">
          {ranges.map((item) => (
            <button
              key={item.key}
              className={`rounded-full px-4 py-1.5 text-sm ${
                range === item.key ? "bg-ink text-white" : "border border-black/10 bg-white text-ink"
              }`}
              onClick={() => setRange(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Period navigation */}
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            onClick={goToPreviousPeriod}
            className="rounded-full p-2 text-muted transition hover:bg-black/5 hover:text-ink"
            aria-label="Previous period"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="min-w-[140px] text-center text-sm font-medium text-ink">
            {periodLabel}
          </span>
          <button
            onClick={goToNextPeriod}
            disabled={!canGoForward}
            className={`rounded-full p-2 transition ${
              canGoForward
                ? "text-muted hover:bg-black/5 hover:text-ink"
                : "cursor-not-allowed text-muted/30"
            }`}
            aria-label="Next period"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Summary cards */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <article key={card.label} className={`rounded-xl bg-white p-3 ${getSummaryAccentClass(card.category)}`}>
              <p className="text-xs uppercase tracking-wide text-muted">{card.label}</p>
              <p className="font-numeric mt-1 text-2xl font-medium tracking-tight">
                {loading ? "..." : card.value}
              </p>
              {/* Sparkline */}
              {!loading && card.sparkline.length >= 2 && (
                <Sparkline data={card.sparkline} className="mt-2 text-muted/50" />
              )}
              {/* Comparison */}
              {!loading && card.comparison && (
                <p className={`mt-1 text-xs ${
                  card.comparison.type === "up" ? "text-emerald-600/70" : "text-muted/70"
                }`}>
                  {card.comparison.text}
                </p>
              )}
            </article>
          ))}
        </div>

        </section>

      {/* Narrative */}
      {narrative && (
        <section className="rounded-2xl border border-black/5 bg-panel p-5 shadow-soft sm:p-6">
          <p className="text-base leading-relaxed text-ink sm:text-lg">{narrative}</p>
        </section>
      )}

      {/* Project breakdown */}
      <section className="rounded-2xl border border-black/5 bg-panel p-4 shadow-soft">
        <h2 className="text-base font-medium">Project breakdown</h2>
        <p className="mt-1 text-sm text-muted">Where your hours went this {range}.</p>
        {valueRows.length ? (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {valueRows.map((row) => {
              const category = getCategoryType(row.clientName, row.clientKind);
              return (
              <article key={row.projectId} className={`rounded-xl bg-white p-3 ${getCategoryBorderClass(category)}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink">{row.projectName}</p>
                    <p className="text-xs text-muted">{row.clientName}</p>
                  </div>
                  <p className="font-numeric text-lg font-medium text-ink">
                    {(row.minutes / 60).toFixed(1)}h
                  </p>
                </div>
                {row.valueCents > 0 && (
                  <p className="mt-2 text-xs text-muted/70">
                    ~{fmtMoney(row.valueCents)} value
                  </p>
                )}
              </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-black/15 p-3 text-sm text-muted">
            No time logged this {range} yet.
          </div>
        )}
      </section>

      {/* Budget check */}
      <section className="rounded-2xl border border-black/5 bg-panel p-4 shadow-soft">
        <h2 className="text-base font-medium">Budget check</h2>
        <p className="mt-1 text-sm text-muted">How active projects are tracking against budget.</p>
        {budgetRows.length ? (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {budgetRows.map((row) => {
              const category = getCategoryType(row.clientName, row.clientKind);
              return (
              <article key={row.projectId} className={`rounded-xl bg-white p-3 ${getCategoryBorderClass(category)}`}>
                <p className="text-sm font-medium text-ink">{row.projectName}</p>
                <p className="text-xs text-muted">{row.clientName}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-muted">
                  <span>Budget {fmtMoney(row.budgetCents)}</span>
                  <span>{(row.minutes / 60).toFixed(1)}h logged</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10">
                  <div className="h-full bg-ink" style={{ width: `${Math.max(2, row.burnPct)}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted">
                  <span>{fmtMoney(row.burnCents)} used ({row.burnPct}%)</span>
                  <span>
                    {row.remainingCents >= 0
                      ? `${fmtMoney(row.remainingCents)} left`
                      : `${fmtMoney(Math.abs(row.remainingCents))} over`}
                  </span>
                </div>
              </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-black/15 p-3 text-sm text-muted">
            Set your hourly rate and project budgets in Settings to see budget tracking.
          </div>
        )}
      </section>
    </AppShell>
  );
}
