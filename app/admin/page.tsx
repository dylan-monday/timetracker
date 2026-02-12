"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import type { CalendarFeedSource, ClientOption, ProjectOption } from "@/lib/types";

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42703" || (error.message ?? "").toLowerCase().includes("does not exist");
}

export default function AdminPage() {
  const { supabase, user } = useAuth();

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [feedSources, setFeedSources] = useState<CalendarFeedSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [newClient, setNewClient] = useState("");
  const [newProjectClientId, setNewProjectClientId] = useState("");
  const [newProjectName, setNewProjectName] = useState("");

  const [mergeSourceProjectId, setMergeSourceProjectId] = useState("");
  const [mergeTargetProjectId, setMergeTargetProjectId] = useState("");
  const [mergeEffectiveDate, setMergeEffectiveDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [newFeedName, setNewFeedName] = useState("");
  const [newFeedUrl, setNewFeedUrl] = useState("");
  const [hourlyRateDollars, setHourlyRateDollars] = useState("");
  const [clientRateDrafts, setClientRateDrafts] = useState<Record<string, string>>({});
  const [projectBudgetDrafts, setProjectBudgetDrafts] = useState<Record<string, string>>({});
  const [projectRateDrafts, setProjectRateDrafts] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    if (!user || !supabase) return;

    setLoading(true);
    setError(null);
    setSuccess(null);
    const isEmailAdmin = user.email?.toLowerCase() === "dylan@mondayandpartners.com";
    setIsAdmin(isEmailAdmin);

    try {
      const [
        { data: profile, error: profileError },
        clientsResult,
        { data: dbProjects, error: projectsError },
        { data: dbFeedSources, error: feedSourcesError }
      ] = await Promise.all([
          supabase.from("profiles").select("role,hourly_rate_cents").eq("id", user.id).maybeSingle(),
          supabase.from("clients").select("id,name,kind,hourly_rate_cents").eq("active", true).order("name"),
          supabase
            .from("projects")
            .select("id,name,client_id,budget_cents,hourly_rate_cents,clients(name)")
            .eq("active", true)
            .order("name"),
          supabase
            .from("calendar_feed_sources")
            .select("id,name,feed_url,active")
            .order("created_at", { ascending: true })
        ]);

      if (profileError && profileError.code !== "PGRST116") throw profileError;
      if (projectsError) throw projectsError;
      if (feedSourcesError) throw feedSourcesError;

      let dbClients: Array<{ id: string; name: string; kind: string; hourly_rate_cents?: number | null }> | null =
        (clientsResult.data as Array<{ id: string; name: string; kind: string; hourly_rate_cents?: number | null }> | null);
      let clientsError = clientsResult.error;
      if (isMissingColumnError(clientsError)) {
        const fallbackClients = await supabase
          .from("clients")
          .select("id,name,kind")
          .eq("active", true)
          .order("name");
        dbClients = fallbackClients.data as Array<{ id: string; name: string; kind: string }> | null;
        clientsError = fallbackClients.error;
      }
      if (clientsError) throw clientsError;

      setIsAdmin(profile?.role === "admin" || isEmailAdmin);

      const mappedClients = (dbClients ?? []).map((client) => ({
        id: client.id,
        name: client.name,
        kind: client.kind,
        hourlyRateCents: "hourly_rate_cents" in client ? client.hourly_rate_cents ?? null : null
      })) as ClientOption[];
      const mappedProjects = (dbProjects ?? []).map((project) => ({
        id: project.id,
        name: project.name,
        clientId: project.client_id,
        budgetCents: project.budget_cents,
        hourlyRateCents: project.hourly_rate_cents,
        clientName: Array.isArray(project.clients)
          ? project.clients[0]?.name ?? "Unknown"
          : ((project.clients as { name: string } | null)?.name ?? "Unknown")
      }));

      setClients(mappedClients);
      setProjects(mappedProjects);
      setHourlyRateDollars(
        profile?.hourly_rate_cents && profile.hourly_rate_cents > 0
          ? (profile.hourly_rate_cents / 100).toFixed(0)
          : ""
      );
      setClientRateDrafts(
        mappedClients.reduce<Record<string, string>>((acc, client) => {
          if (client.hourlyRateCents && client.hourlyRateCents > 0) {
            acc[client.id] = (client.hourlyRateCents / 100).toFixed(0);
          } else {
            acc[client.id] = "";
          }
          return acc;
        }, {})
      );
      setProjectBudgetDrafts(
        mappedProjects.reduce<Record<string, string>>((acc, project) => {
          if (project.budgetCents && project.budgetCents > 0) {
            acc[project.id] = (project.budgetCents / 100).toFixed(0);
          } else {
            acc[project.id] = "";
          }
          return acc;
        }, {})
      );
      setProjectRateDrafts(
        mappedProjects.reduce<Record<string, string>>((acc, project) => {
          if (project.hourlyRateCents && project.hourlyRateCents > 0) {
            acc[project.id] = (project.hourlyRateCents / 100).toFixed(0);
          } else {
            acc[project.id] = "";
          }
          return acc;
        }, {})
      );
      setFeedSources(
        (dbFeedSources ?? []).map((source) => ({
          id: source.id,
          name: source.name,
          feedUrl: source.feed_url,
          active: source.active
        }))
      );

      if (!newProjectClientId && mappedClients[0]) {
        setNewProjectClientId(mappedClients[0].id);
      }
    } catch (err) {
      setError(toErrorMessage(err, "Could not load admin data."));
    } finally {
      setLoading(false);
    }
  }, [newProjectClientId, supabase, user]);

  useEffect(() => {
    if (!user) return;
    void refresh();
  }, [refresh, user]);

  const clientNameById = useMemo(() => {
    return new Map(clients.map((client) => [client.id, client.name]));
  }, [clients]);

  const addClient = async () => {
    if (!user || !supabase || !newClient.trim()) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: insertError } = await supabase.from("clients").insert({
        owner_id: user.id,
        name: newClient.trim(),
        kind: "external",
        active: true
      });

      if (insertError) throw insertError;

      setNewClient("");
      await refresh();
    } catch (err) {
      setError(toErrorMessage(err, "Could not add client."));
    } finally {
      setSaving(false);
    }
  };

  const archiveClient = async (id: string) => {
    if (!supabase) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: updateError } = await supabase.from("clients").update({ active: false }).eq("id", id);
      if (updateError) throw updateError;
      await refresh();
    } catch (err) {
      setError(toErrorMessage(err, "Could not archive client."));
    } finally {
      setSaving(false);
    }
  };

  const addProject = async () => {
    if (!user || !supabase || !newProjectClientId || !newProjectName.trim()) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: insertError } = await supabase.from("projects").insert({
        owner_id: user.id,
        client_id: newProjectClientId,
        name: newProjectName.trim(),
        active: true
      });

      if (insertError) throw insertError;

      setNewProjectName("");
      await refresh();
    } catch (err) {
      setError(toErrorMessage(err, "Could not add project."));
    } finally {
      setSaving(false);
    }
  };

  const archiveProject = async (id: string) => {
    if (!supabase) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: updateError } = await supabase.from("projects").update({ active: false }).eq("id", id);
      if (updateError) throw updateError;
      await refresh();
    } catch (err) {
      setError(toErrorMessage(err, "Could not archive project."));
    } finally {
      setSaving(false);
    }
  };

  const mergeProjects = async () => {
    if (!user || !supabase || !mergeSourceProjectId || !mergeTargetProjectId || !mergeEffectiveDate) return;
    if (mergeSourceProjectId === mergeTargetProjectId) {
      setError("Source and target projects must differ.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: rpcError } = await supabase.rpc("apply_project_merge", {
        p_owner_id: user.id,
        p_source_project_id: mergeSourceProjectId,
        p_target_project_id: mergeTargetProjectId,
        p_effective_date: mergeEffectiveDate
      });

      if (rpcError) throw rpcError;

      setMergeSourceProjectId("");
      setMergeTargetProjectId("");
      await refresh();
    } catch (err) {
      setError(toErrorMessage(err, "Could not merge projects."));
    } finally {
      setSaving(false);
    }
  };

  const saveHourlyRate = async () => {
    if (!user || !supabase) return;

    const dollars = Number(hourlyRateDollars);
    if (!Number.isFinite(dollars) || dollars < 0) {
      setError("Hourly rate must be a valid non-negative number.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ hourly_rate_cents: Math.round(dollars * 100) })
        .eq("id", user.id);

      if (updateError) throw updateError;
      await refresh();
      setSuccess("Saved base hourly rate.");
    } catch (err) {
      setError(toErrorMessage(err, "Could not save hourly rate."));
    } finally {
      setSaving(false);
    }
  };

  const saveClientRate = async (clientId: string) => {
    if (!supabase) return;

    const value = clientRateDrafts[clientId] ?? "";
    const dollars = value.trim() ? Number(value) : NaN;
    if (value.trim() && (!Number.isFinite(dollars) || dollars < 0)) {
      setError("Client hourly rate must be a valid non-negative number.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: updateError } = await supabase
        .from("clients")
        .update({ hourly_rate_cents: value.trim() ? Math.round(dollars * 100) : null })
        .eq("id", clientId);
      if (updateError) {
        if (updateError.code === "42703" && updateError.message.includes("hourly_rate_cents")) {
          throw new Error(
            "Client hourly rate column is missing in Supabase. Run: alter table public.clients add column if not exists hourly_rate_cents integer;"
          );
        }
        throw updateError;
      }
      await refresh();
      setSuccess("Saved client hourly rate.");
    } catch (err) {
      setError(toErrorMessage(err, "Could not save client hourly rate."));
    } finally {
      setSaving(false);
    }
  };

  const saveProjectFinancials = async (projectId: string) => {
    if (!supabase) return;

    const budgetValue = projectBudgetDrafts[projectId] ?? "";
    const budgetDollars = budgetValue.trim() ? Number(budgetValue) : NaN;
    if (budgetValue.trim() && (!Number.isFinite(budgetDollars) || budgetDollars < 0)) {
      setError("Project budget must be a valid non-negative number.");
      return;
    }
    const rateValue = projectRateDrafts[projectId] ?? "";
    const rateDollars = rateValue.trim() ? Number(rateValue) : NaN;
    if (rateValue.trim() && (!Number.isFinite(rateDollars) || rateDollars < 0)) {
      setError("Project hourly rate must be a valid non-negative number.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: updateError } = await supabase
        .from("projects")
        .update({
          budget_cents: budgetValue.trim() ? Math.round(budgetDollars * 100) : null,
          hourly_rate_cents: rateValue.trim() ? Math.round(rateDollars * 100) : null
        })
        .eq("id", projectId);

      if (updateError) {
        if (updateError.code === "42703" && updateError.message.includes("hourly_rate_cents")) {
          throw new Error(
            "Project hourly rate column is missing in Supabase. Run: alter table public.projects add column if not exists hourly_rate_cents integer;"
          );
        }
        throw updateError;
      }
      await refresh();
      setSuccess("Saved project budget and rate.");
    } catch (err) {
      setError(toErrorMessage(err, "Could not save project financials."));
    } finally {
      setSaving(false);
    }
  };

  const addFeedSource = async () => {
    if (!user || !supabase || !newFeedName.trim() || !newFeedUrl.trim()) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const feedUrl = newFeedUrl.trim();
      if (!feedUrl.startsWith("https://")) {
        throw new Error("Feed URL must start with https://");
      }

      const { error: insertError } = await supabase.from("calendar_feed_sources").insert({
        owner_id: user.id,
        name: newFeedName.trim(),
        feed_url: feedUrl,
        active: true
      });

      if (insertError) throw insertError;
      setNewFeedName("");
      setNewFeedUrl("");
      await refresh();
    } catch (err) {
      setError(toErrorMessage(err, "Could not add calendar source."));
    } finally {
      setSaving(false);
    }
  };

  const toggleFeedSource = async (id: string, nextActive: boolean) => {
    if (!supabase) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: updateError } = await supabase
        .from("calendar_feed_sources")
        .update({ active: nextActive })
        .eq("id", id);

      if (updateError) throw updateError;
      await refresh();
    } catch (err) {
      setError(toErrorMessage(err, "Could not update calendar source."));
    } finally {
      setSaving(false);
    }
  };

  const deleteFeedSource = async (id: string) => {
    if (!supabase) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: deleteError } = await supabase.from("calendar_feed_sources").delete().eq("id", id);
      if (deleteError) throw deleteError;
      await refresh();
    } catch (err) {
      setError(toErrorMessage(err, "Could not remove calendar source."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell
      title="Admin Mode"
      subtitle="Role-gated controls for clients, projects, and forward-only merge events."
    >
      {!isAdmin && !loading ? (
        <section className="rounded-2xl border border-black/10 bg-panel p-5 shadow-soft">
          <h2 className="text-base font-semibold">Admin access required</h2>
          <p className="mt-2 text-sm text-muted">
            Your current account does not have admin role permissions.
          </p>
        </section>
      ) : null}

      {isAdmin ? (
        <>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {success ? <p className="text-sm text-[#2f7a4a]">{success}</p> : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-black/5 bg-panel p-4 shadow-soft">
          <h2 className="text-base font-semibold">Clients</h2>
          <p className="mt-1 text-sm text-muted">Add or archive client buckets.</p>

          <div className="mt-3 flex gap-2">
            <input
              value={newClient}
              onChange={(event) => setNewClient(event.target.value)}
              placeholder="New client name"
              className="flex-1 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
            />
            <button
              className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={() => {
                void addClient();
              }}
              disabled={saving || !newClient.trim()}
            >
              Add
            </button>
          </div>

          <ul className="mt-3 space-y-2">
            {clients.map((client) => (
              <li key={client.id} className="rounded-xl bg-white px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span>{client.name}</span>
                  <button
                    className="rounded-full border border-black/10 px-2 py-0.5 text-xs"
                    onClick={() => {
                      void archiveClient(client.id);
                    }}
                    disabled={saving}
                  >
                    Archive
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="25"
                    value={clientRateDrafts[client.id] ?? ""}
                    onChange={(event) =>
                      setClientRateDrafts((current) => ({
                        ...current,
                        [client.id]: event.target.value
                      }))
                    }
                    placeholder="Client rate $/hr (optional)"
                    className="w-44 rounded-xl border border-black/10 bg-white px-3 py-1.5 text-xs"
                  />
                  <button
                    className="rounded-full border border-black/10 px-3 py-1 text-xs"
                    onClick={() => {
                      void saveClientRate(client.id);
                    }}
                    disabled={saving}
                  >
                    Save rate
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-black/5 bg-panel p-4 shadow-soft">
          <h2 className="text-base font-semibold">Projects</h2>
          <p className="mt-1 text-sm text-muted">Each project belongs to one client.</p>

          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr,1fr,auto]">
            <select
              value={newProjectClientId}
              onChange={(event) => setNewProjectClientId(event.target.value)}
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
            >
              <option value="">Select client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            <input
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              placeholder="New project name"
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
            />
            <button
              className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={() => {
                void addProject();
              }}
              disabled={saving || !newProjectClientId || !newProjectName.trim()}
            >
              Add
            </button>
          </div>

          <ul className="mt-3 space-y-2">
            {projects.map((project) => (
              <li key={project.id} className="rounded-xl bg-white px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <span>
                    {project.name} <span className="text-muted">({clientNameById.get(project.clientId)})</span>
                  </span>
                </div>
                <div className="mt-2 flex flex-nowrap items-center gap-2 overflow-x-auto whitespace-nowrap pb-1">
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={projectBudgetDrafts[project.id] ?? ""}
                    onChange={(event) =>
                      setProjectBudgetDrafts((current) => ({
                        ...current,
                        [project.id]: event.target.value
                      }))
                    }
                    placeholder="Budget $"
                    className="w-32 rounded-xl border border-black/10 bg-white px-3 py-1.5 text-xs"
                  />
                  <input
                    type="number"
                    min="0"
                    step="25"
                    value={projectRateDrafts[project.id] ?? ""}
                    onChange={(event) =>
                      setProjectRateDrafts((current) => ({
                        ...current,
                        [project.id]: event.target.value
                      }))
                    }
                    placeholder="Rate $/hr (optional)"
                    className="w-40 rounded-xl border border-black/10 bg-white px-3 py-1.5 text-xs"
                  />
                  <button
                    className="rounded-full bg-ink px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                    onClick={() => {
                      void saveProjectFinancials(project.id);
                    }}
                    disabled={saving}
                  >
                    Save budget + rate
                  </button>
                  <button
                    className="inline-flex h-8 shrink-0 items-center justify-center rounded-full border border-red-200 bg-red-50 px-2.5 text-red-700 disabled:opacity-50"
                    onClick={() => {
                      void archiveProject(project.id);
                    }}
                    disabled={saving}
                    aria-label={`Archive ${project.name}`}
                    title="Archive project"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-black/5 bg-panel p-4 shadow-soft">
        <h2 className="text-base font-semibold">Rough Budgeting</h2>
        <p className="mt-1 text-sm text-muted">Set hourly rate and project budgets for loose burn tracking.</p>

        <div className="mt-3 flex items-center gap-2">
          <label className="text-sm text-muted">Hourly rate ($/hr)</label>
          <input
            type="number"
            min="0"
            step="25"
            value={hourlyRateDollars}
            onChange={(event) => setHourlyRateDollars(event.target.value)}
            placeholder="300"
            className="w-28 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          />
          <button
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={() => {
              void saveHourlyRate();
            }}
            disabled={saving}
          >
            Save rate
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-black/5 bg-panel p-4 shadow-soft">
        <h2 className="text-base font-semibold">Merge projects (forward-only)</h2>
        <p className="mt-1 text-sm text-muted">
          Entries before effective date stay untouched. Entries on/after date move to target project.
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <select
            value={mergeSourceProjectId}
            onChange={(event) => setMergeSourceProjectId(event.target.value)}
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          >
            <option value="">Source project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <select
            value={mergeTargetProjectId}
            onChange={(event) => setMergeTargetProjectId(event.target.value)}
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          >
            <option value="">Target project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={mergeEffectiveDate}
            onChange={(event) => setMergeEffectiveDate(event.target.value)}
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          />
          <button
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={() => {
              void mergeProjects();
            }}
            disabled={
              saving ||
              !mergeSourceProjectId ||
              !mergeTargetProjectId ||
              !mergeEffectiveDate ||
              loading
            }
          >
            Merge
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-black/5 bg-panel p-4 shadow-soft">
        <h2 className="text-base font-semibold">Calendar Sources (Feed Links)</h2>
        <p className="mt-1 text-sm text-muted">
          Add only work calendar iCal feed links. Sync uses these sources and ignores all others.
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr,1.6fr,auto]">
          <input
            value={newFeedName}
            onChange={(event) => setNewFeedName(event.target.value)}
            placeholder="Source name (e.g. Natrx Team)"
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          />
          <input
            value={newFeedUrl}
            onChange={(event) => setNewFeedUrl(event.target.value)}
            placeholder="https://.../basic.ics"
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
          />
          <button
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={() => {
              void addFeedSource();
            }}
            disabled={saving || !newFeedName.trim() || !newFeedUrl.trim()}
          >
            Add source
          </button>
        </div>

        <ul className="mt-3 space-y-2">
          {feedSources.map((source) => (
            <li key={source.id} className="rounded-xl bg-white px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-ink">{source.name}</p>
                  <p className="text-xs text-muted">{source.feedUrl}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-full border border-black/10 px-3 py-1 text-xs"
                    onClick={() => {
                      void toggleFeedSource(source.id, !source.active);
                    }}
                    disabled={saving}
                  >
                    {source.active ? "Disable" : "Enable"}
                  </button>
                  <button
                    className="rounded-full border border-black/10 px-3 py-1 text-xs"
                    onClick={() => {
                      void deleteFeedSource(source.id);
                    }}
                    disabled={saving}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
        </>
      ) : null}
    </AppShell>
  );
}
