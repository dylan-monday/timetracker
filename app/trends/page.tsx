"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";

type RangeKey = "week" | "month" | "quarter" | "year";

const ranges: Array<{ key: RangeKey; label: string }> = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "quarter", label: "Quarter" },
  { key: "year", label: "Year" }
];

function startForRange(range: RangeKey): string {
  const now = new Date();

  if (range === "week") {
    const d = new Date(now);
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - day + 1);
    return d.toISOString().slice(0, 10);
  }

  if (range === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  }

  if (range === "quarter") {
    const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
    return new Date(now.getFullYear(), quarterMonth, 1).toISOString().slice(0, 10);
  }

  return new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
}

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42703" || (error.message ?? "").toLowerCase().includes("does not exist");
}

export default function TrendsPage() {
  const { supabase } = useAuth();
  const [range, setRange] = useState<RangeKey>("week");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hourlyRateCents, setHourlyRateCents] = useState(0);
  const [totals, setTotals] = useState({ total: 0, client: 0, internal: 0, exercise: 0 });
  const [projectBudgetRows, setProjectBudgetRows] = useState<
    Array<{
      projectId: string;
      projectName: string;
      clientName: string;
      minutes: number;
      budgetCents: number;
      hourlyRateCents: number | null;
      clientHourlyRateCents: number | null;
    }>
  >([]);
  const [projectValueRows, setProjectValueRows] = useState<
    Array<{
      projectId: string;
      projectName: string;
      clientName: string;
      minutes: number;
      hourlyRateCents: number | null;
      clientHourlyRateCents: number | null;
    }>
  >([]);

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
        const startDate = startForRange(range);
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("hourly_rate_cents")
          .maybeSingle();
        if (profileError && profileError.code !== "PGRST116") throw profileError;
        setHourlyRateCents(profile?.hourly_rate_cents ?? 0);

        let { data, error: queryError } = await supabase
          .from("time_entries")
          .select(
            "rounded_minutes,project_id,projects(id,name,budget_cents,hourly_rate_cents,clients(name,kind,hourly_rate_cents))"
          )
          .eq("status", "approved")
          .gte("entry_date", startDate);

        if (isMissingColumnError(queryError)) {
          const fallback = await supabase
            .from("time_entries")
            .select("rounded_minutes,project_id,projects(id,name,budget_cents,hourly_rate_cents,clients(name,kind))")
            .eq("status", "approved")
            .gte("entry_date", startDate);
          data = fallback.data;
          queryError = fallback.error;
        }

        if (queryError) throw queryError;

        const next = { total: 0, client: 0, internal: 0, exercise: 0 };
        const perProject = new Map<
          string,
          {
            projectId: string;
            projectName: string;
            clientName: string;
            minutes: number;
            budgetCents: number;
            hourlyRateCents: number | null;
            clientHourlyRateCents: number | null;
          }
        >();
        const perProjectValue = new Map<
          string,
          {
            projectId: string;
            projectName: string;
            clientName: string;
            minutes: number;
            hourlyRateCents: number | null;
            clientHourlyRateCents: number | null;
          }
        >();

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
          const clientName = (project?.clients?.name ?? "").toLowerCase();

          next.total += minutes;

          if (clientName.includes("exercise")) {
            next.exercise += minutes;
          }

          if (clientKind === "internal") {
            next.internal += minutes;
          } else {
            next.client += minutes;
          }

          if (project?.id && project?.budget_cents && project.budget_cents > 0) {
            const current = perProject.get(project.id) ?? {
              projectId: project.id,
              projectName: project.name ?? "Untitled project",
              clientName: project.clients?.name ?? "Client",
              minutes: 0,
              budgetCents: project.budget_cents,
              hourlyRateCents: project.hourly_rate_cents ?? null,
              clientHourlyRateCents: project.clients?.hourly_rate_cents ?? null
            };
            current.minutes += minutes;
            perProject.set(project.id, current);
          }

          if (project?.id) {
            const current = perProjectValue.get(project.id) ?? {
              projectId: project.id,
              projectName: project.name ?? "Untitled project",
              clientName: project.clients?.name ?? "Client",
              minutes: 0,
              hourlyRateCents: project.hourly_rate_cents ?? null,
              clientHourlyRateCents: project.clients?.hourly_rate_cents ?? null
            };
            current.minutes += minutes;
            perProjectValue.set(project.id, current);
          }
        }

        if (mounted) {
          setTotals(next);
          setProjectBudgetRows(
            Array.from(perProject.values()).sort((a, b) => b.minutes - a.minutes)
          );
          setProjectValueRows(
            Array.from(perProjectValue.values())
              .filter((row) => row.minutes > 0)
              .sort((a, b) => b.minutes - a.minutes)
          );
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
  }, [range, supabase]);

  const cards = useMemo(() => {
    const toHours = (minutes: number) => `${(minutes / 60).toFixed(1)}h`;
    const pct = (minutes: number) =>
      totals.total > 0 ? `${Math.round((minutes / totals.total) * 100)}%` : "0%";

    return [
      { label: "Total", value: toHours(totals.total), detail: "All approved time" },
      { label: "Client work", value: toHours(totals.client), detail: pct(totals.client) },
      { label: "Internal", value: toHours(totals.internal), detail: pct(totals.internal) },
      { label: "Exercise", value: toHours(totals.exercise), detail: pct(totals.exercise) }
    ];
  }, [totals]);

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

  const fmtMoney = (cents: number) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
      cents / 100
    );

  return (
    <AppShell title="Trends">
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <section className="rounded-2xl border border-black/5 bg-panel p-4 shadow-soft">
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

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <article key={card.label} className="rounded-xl bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-muted">{card.label}</p>
              <p className="font-numeric mt-1 text-2xl font-semibold tracking-tight">
                {loading ? "..." : card.value}
              </p>
              <p className="text-xs text-muted">{card.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-black/5 bg-panel p-4 shadow-soft">
        <h2 className="text-base font-semibold">Project value pulse</h2>
        <p className="mt-1 text-sm text-muted">
          A personal signal: hours by project and rough value at {hourlyRateCents ? fmtMoney(hourlyRateCents) : "$0"}/hr.
        </p>
        {valueRows.length ? (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {valueRows.map((row) => (
              <article key={row.projectId} className="rounded-xl bg-white p-3">
                <p className="text-sm font-medium text-ink">{row.projectName}</p>
                <p className="text-xs text-muted">{row.clientName}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-muted">
                  <span>{(row.minutes / 60).toFixed(1)}h logged</span>
                  <span>Rate {fmtMoney(row.effectiveRateCents)}/hr</span>
                </div>
                <div className="mt-1 flex justify-end text-xs text-muted">
                  <span>Value {fmtMoney(row.valueCents)}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-black/15 p-3 text-sm text-muted">
            Add hourly rate in Admin Mode to unlock project value signal.
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-black/5 bg-panel p-4 shadow-soft">
        <h2 className="text-base font-semibold">Budget pulse (loose tracking)</h2>
        <p className="mt-1 text-sm text-muted">
          Burn = approved rounded hours x hourly rate ({hourlyRateCents ? fmtMoney(hourlyRateCents) : "$0"}/hr).
        </p>
        {budgetRows.length ? (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {budgetRows.map((row) => (
              <article key={row.projectId} className="rounded-xl bg-white p-3">
                <p className="text-sm font-medium text-ink">{row.projectName}</p>
                <p className="text-xs text-muted">{row.clientName}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-muted">
                  <span>Budget {fmtMoney(row.budgetCents)}</span>
                  <span>Rate {fmtMoney(row.effectiveRateCents)}/hr</span>
                </div>
                <div className="mt-1 flex justify-end text-xs text-muted">
                  <span>Burn {fmtMoney(row.burnCents)} ({row.burnPct}%)</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10">
                  <div className="h-full bg-ink" style={{ width: `${Math.max(2, row.burnPct)}%` }} />
                </div>
                <p className="mt-2 text-xs text-muted">
                  Remaining {row.remainingCents >= 0 ? fmtMoney(row.remainingCents) : `-${fmtMoney(Math.abs(row.remainingCents))}`}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-black/15 p-3 text-sm text-muted">
            Add hourly rate and project budgets in Admin Mode to see budget pulse.
          </div>
        )}
      </section>
    </AppShell>
  );
}
