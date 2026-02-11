import { AppShell } from "@/components/app-shell";

const clients = [
  "Nike",
  "Google",
  "Monday + Partners • Business Dev",
  "Monday + Partners • Exercise"
];

const projects = [
  "Global Campaign Sprint",
  "Holiday Launch",
  "New Biz Pipeline",
  "Founder Fitness"
];

export default function AdminPage() {
  return (
    <AppShell
      title="Admin Mode"
      subtitle="Role-gated controls for clients, projects, and forward-only merge events."
    >
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-black/5 bg-panel p-4 shadow-soft">
          <h2 className="text-base font-semibold">Clients</h2>
          <p className="mt-1 text-sm text-muted">Add, archive, and organize client buckets.</p>
          <ul className="mt-3 space-y-2">
            {clients.map((client) => (
              <li key={client} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm">
                <span>{client}</span>
                <button className="rounded-full border border-black/10 px-2 py-0.5 text-xs">Delete</button>
              </li>
            ))}
          </ul>
          <button className="mt-4 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white">Add client</button>
        </div>

        <div className="rounded-2xl border border-black/5 bg-panel p-4 shadow-soft">
          <h2 className="text-base font-semibold">Projects</h2>
          <p className="mt-1 text-sm text-muted">Each project belongs to one client.</p>
          <ul className="mt-3 space-y-2">
            {projects.map((project) => (
              <li key={project} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm">
                <span>{project}</span>
                <button className="rounded-full border border-black/10 px-2 py-0.5 text-xs">Delete</button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white">Add project</button>
            <button className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium">
              Merge projects
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-black/5 bg-panel p-4 shadow-soft">
        <h2 className="text-base font-semibold">Merge preview (forward-only)</h2>
        <p className="mt-1 text-sm text-muted">
          Merges apply from an effective date onward and preserve history before that date.
        </p>
        <div className="mt-3 rounded-xl border border-dashed border-black/15 p-3 text-sm text-muted">
          Example: Merge `Holiday Launch` into `Global Campaign Sprint` effective 2026-02-17.
        </div>
      </section>
    </AppShell>
  );
}
