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

export default function TrendsPage() {
  const { supabase } = useAuth();
  const [range, setRange] = useState<RangeKey>("week");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totals, setTotals] = useState({ total: 0, client: 0, internal: 0, exercise: 0 });

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

        const { data, error: queryError } = await supabase
          .from("time_entries")
          .select("rounded_minutes,projects(name,clients(name,kind))")
          .eq("status", "approved")
          .gte("entry_date", startDate);

        if (queryError) throw queryError;

        const next = { total: 0, client: 0, internal: 0, exercise: 0 };

        for (const row of data ?? []) {
          const minutes = row.rounded_minutes ?? 0;
          const project = row.projects as { name?: string; clients?: { name?: string; kind?: string } } | null;
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
        }

        if (mounted) {
          setTotals(next);
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

  return (
    <AppShell
      title="Trends"
      subtitle="Weekly, monthly, quarterly, yearly visibility into where your time goes."
    >
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
        <h2 className="text-base font-semibold">Budget pulse (loose tracking)</h2>
        <p className="mt-1 text-sm text-muted">Burn = rounded hours x user hourly rate against project budget.</p>
        <div className="mt-3 rounded-xl border border-dashed border-black/15 p-3 text-sm text-muted">
          Budget-by-project cards will be populated once project budgets and hourly rate are set in profile.
        </div>
      </section>
    </AppShell>
  );
}
