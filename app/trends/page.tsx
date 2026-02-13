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

function formatDateRange(range: RangeKey): string {
  const now = new Date();
  const startDate = new Date(startForRange(range));
  const endDate = new Date(now);

  const formatShort = (d: Date) => {
    const month = d.toLocaleDateString("en-US", { month: "short" });
    return `${month} ${d.getDate()}`;
  };

  if (range === "week") {
    // Show Mon-Fri or Mon-Sun range
    const endOfWeek = new Date(startDate);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    const effectiveEnd = endOfWeek < now ? endOfWeek : now;
    return `${formatShort(startDate)}–${formatShort(effectiveEnd)}`;
  }

  if (range === "month") {
    return now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  if (range === "quarter") {
    const q = Math.floor(now.getMonth() / 3) + 1;
    return `Q${q} ${now.getFullYear()}`;
  }

  return now.getFullYear().toString();
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
  const [totals, setTotals] = useState({ total: 0, client: 0, internal: 0, personal: 0 });
  const [topClients, setTopClients] = useState<Array<{ name: string; minutes: number }>>([]);
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

        const next = { total: 0, client: 0, internal: 0, personal: 0 };
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
        const clientMinutes = new Map<string, number>();

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

          next.total += minutes;

          // Track personal time (Personal client and all its projects)
          if (clientNameLower === "personal") {
            next.personal += minutes;
          }

          if (clientKind === "internal") {
            next.internal += minutes;
          } else {
            next.client += minutes;
            // Track per-client totals for narrative (only external clients)
            if (clientName) {
              clientMinutes.set(clientName, (clientMinutes.get(clientName) ?? 0) + minutes);
            }
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
          // Top clients by hours for narrative
          setTopClients(
            Array.from(clientMinutes.entries())
              .map(([name, mins]) => ({ name, minutes: mins }))
              .sort((a, b) => b.minutes - a.minutes)
              .slice(0, 3)
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

  const dateRangeLabel = useMemo(() => formatDateRange(range), [range]);

  const cards = useMemo(() => {
    const toHours = (minutes: number) => `${(minutes / 60).toFixed(1)}h`;

    return [
      { label: "Total", value: toHours(totals.total), detail: dateRangeLabel },
      { label: "Client delivery", value: toHours(totals.client) },
      { label: "Internal investment", value: toHours(totals.internal) },
      { label: "Personal", value: toHours(totals.personal) }
    ];
  }, [totals, dateRangeLabel]);

  // Weekly narrative
  const narrative = useMemo(() => {
    if (loading || totals.total === 0) return null;

    const toHours = (minutes: number) => `${(minutes / 60).toFixed(1)}h`;
    const parts: string[] = [];

    // Main focus
    if (totals.client > totals.internal && totals.client > totals.personal) {
      const clientNames = topClients.slice(0, 2).map((c) => c.name);
      if (clientNames.length > 0) {
        parts.push(`Most of your ${range} went to client delivery — ${clientNames.join(" and ")} took the biggest share.`);
      } else {
        parts.push(`Most of your ${range} went to client delivery.`);
      }
    } else if (totals.internal > totals.client) {
      parts.push(`You focused on internal investment this ${range}.`);
    }

    // Internal + personal summary
    const secondaryParts: string[] = [];
    if (totals.internal > 0) {
      secondaryParts.push(`${toHours(totals.internal)} of internal work`);
    }
    if (totals.personal > 0) {
      secondaryParts.push(`${toHours(totals.personal)} for yourself`);
    }

    if (secondaryParts.length > 0) {
      parts.push(`You logged ${secondaryParts.join(" and ")}.`);
    } else if (totals.personal === 0 && totals.total > 0) {
      parts.push("No personal time captured this " + range + ".");
    }

    return parts.join(" ");
  }, [loading, totals, topClients, range]);

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
              {"detail" in card && card.detail && (
                <p className="text-xs text-muted">{card.detail}</p>
              )}
            </article>
          ))}
        </div>

        {narrative && (
          <p className="mt-4 text-sm text-ink/70">{narrative}</p>
        )}
      </section>

      <section className="rounded-2xl border border-black/5 bg-panel p-4 shadow-soft">
        <h2 className="text-base font-semibold">Project breakdown</h2>
        <p className="mt-1 text-sm text-muted">Where your hours went this {range}.</p>
        {valueRows.length ? (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {valueRows.map((row) => (
              <article key={row.projectId} className="rounded-xl bg-white p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-ink">{row.projectName}</p>
                    <p className="text-xs text-muted">{row.clientName}</p>
                  </div>
                  <p className="font-numeric text-lg font-semibold text-ink">
                    {(row.minutes / 60).toFixed(1)}h
                  </p>
                </div>
                {row.valueCents > 0 && (
                  <p className="mt-2 text-xs text-muted/70">
                    ~{fmtMoney(row.valueCents)} value
                  </p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-black/15 p-3 text-sm text-muted">
            No time logged this {range} yet.
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-black/5 bg-panel p-4 shadow-soft">
        <h2 className="text-base font-semibold">Budget check</h2>
        <p className="mt-1 text-sm text-muted">How active projects are tracking against budget.</p>
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
            Set your hourly rate and project budgets in Settings to see budget tracking.
          </div>
        )}
      </section>
    </AppShell>
  );
}
