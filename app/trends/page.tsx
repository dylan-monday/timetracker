import { AppShell } from "@/components/app-shell";

const ranges = ["Week", "Month", "Quarter", "Year"];

const cards = [
  { label: "Client work", value: "62h", detail: "56%" },
  { label: "Internal", value: "31h", detail: "28%" },
  { label: "Exercise", value: "4h", detail: "4%" },
  { label: "Open time", value: "14h", detail: "12%" }
];

export default function TrendsPage() {
  return (
    <AppShell
      title="Trends"
      subtitle="Weekly, monthly, quarterly, yearly visibility into where your time goes."
    >
      <section className="rounded-2xl border border-black/5 bg-panel p-4 shadow-soft">
        <div className="flex flex-wrap gap-2">
          {ranges.map((range, index) => (
            <button
              key={range}
              className={`rounded-full px-4 py-1.5 text-sm ${
                index === 0 ? "bg-ink text-white" : "border border-black/10 bg-white text-ink"
              }`}
            >
              {range}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <article key={card.label} className="rounded-xl bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-muted">{card.label}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">{card.value}</p>
              <p className="text-xs text-muted">{card.detail} of total logged time</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-black/5 bg-panel p-4 shadow-soft">
        <h2 className="text-base font-semibold">Budget pulse (loose tracking)</h2>
        <p className="mt-1 text-sm text-muted">Burn = rounded hours x user hourly rate against project budget.</p>
        <div className="mt-3 rounded-xl border border-dashed border-black/15 p-3 text-sm text-muted">
          `Global Campaign Sprint` is at 72% of budget burn with two weeks remaining.
        </div>
      </section>
    </AppShell>
  );
}
