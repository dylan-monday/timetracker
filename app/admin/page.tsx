"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

export default function AdminPage() {
  const { supabase, user } = useAuth();

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [feedSources, setFeedSources] = useState<CalendarFeedSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const refresh = useCallback(async () => {
    if (!user || !supabase) return;

    setLoading(true);
    setError(null);
    const isEmailAdmin = user.email?.toLowerCase() === "dylan@mondayandpartners.com";
    setIsAdmin(isEmailAdmin);

    try {
      const [
        { data: profile, error: profileError },
        { data: dbClients, error: clientsError },
        { data: dbProjects, error: projectsError },
        { data: dbFeedSources, error: feedSourcesError }
      ] = await Promise.all([
          supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
          supabase.from("clients").select("id,name,kind").eq("active", true).order("name"),
          supabase
            .from("projects")
            .select("id,name,client_id,clients(name)")
            .eq("active", true)
            .order("name"),
          supabase
            .from("calendar_feed_sources")
            .select("id,name,feed_url,active")
            .order("created_at", { ascending: true })
        ]);

      if (profileError && profileError.code !== "PGRST116") throw profileError;
      if (clientsError) throw clientsError;
      if (projectsError) throw projectsError;
      if (feedSourcesError) throw feedSourcesError;

      setIsAdmin(profile?.role === "admin" || isEmailAdmin);

      const mappedClients = (dbClients ?? []) as ClientOption[];
      const mappedProjects = (dbProjects ?? []).map((project) => ({
        id: project.id,
        name: project.name,
        clientId: project.client_id,
        clientName: Array.isArray(project.clients)
          ? project.clients[0]?.name ?? "Unknown"
          : ((project.clients as { name: string } | null)?.name ?? "Unknown")
      }));

      setClients(mappedClients);
      setProjects(mappedProjects);
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

  const addFeedSource = async () => {
    if (!user || !supabase || !newFeedName.trim() || !newFeedUrl.trim()) return;

    setSaving(true);
    setError(null);

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
              <li key={client.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm">
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
              <li key={project.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm">
                <span>
                  {project.name} <span className="text-muted">({clientNameById.get(project.clientId)})</span>
                </span>
                <button
                  className="rounded-full border border-black/10 px-2 py-0.5 text-xs"
                  onClick={() => {
                    void archiveProject(project.id);
                  }}
                  disabled={saving}
                >
                  Archive
                </button>
              </li>
            ))}
          </ul>
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
