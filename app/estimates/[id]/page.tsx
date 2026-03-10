"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { ComboBox } from "@/components/combobox";
import {
  fetchEstimate,
  fetchAgencyRoles,
  fetchProfiles,
  fetchEstimateTracking,
  updateEstimate,
  deleteEstimate,
  createProjectFromEstimate,
  createPhase,
  updatePhase,
  deletePhase,
  createLineItem,
  updateLineItem,
  deleteLineItem,
  createHardCost,
  updateHardCost,
  deleteHardCost,
  calculateEstimate,
  ensureDefaultAgencyRoles,
} from "@/lib/supabase/estimates";
import { fetchClientsAndProjects } from "@/lib/supabase/week";
import {
  DEFAULT_PHASE_NAMES,
  type AgencyRole,
  type ClientOption,
  type Estimate,
  type EstimateCalculation,
  type EstimateHardCost,
  type EstimateLineItem,
  type EstimatePhase,
  type EstimateStatus,
  type ProfileOption,
  type ProjectOption,
} from "@/lib/types";

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatCentsWithDecimals(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function parseDollars(value: string): number {
  const cleaned = value.replace(/[$,\s]/g, "").trim();
  if (!cleaned) return 0;
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? Math.round(num * 100) : 0;
}

function formatDollarsInput(cents: number): string {
  if (cents === 0) return "";
  return (cents / 100).toFixed(2);
}

function parseHours(value: string): number {
  const cleaned = value.trim();
  if (!cleaned) return 0;
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function formatHoursInput(hours: number): string {
  if (hours === 0) return "";
  return hours.toString();
}

// ─────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────

export default function EstimateBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const estimateId = params.id as string;
  const { supabase, user } = useAuth();

  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [agencyRoles, setAgencyRoles] = useState<AgencyRole[]>([]);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [tracking, setTracking] = useState<{
    estimatedHours: number;
    actualMinutes: number;
    estimatedValueCents: number;
    actualValueCents: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());

  // Local form state
  const [name, setName] = useState("");
  const [status, setStatus] = useState<EstimateStatus>("draft");
  const [clientId, setClientId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [markupPercent, setMarkupPercent] = useState("15");
  const [contingencyPercent, setContingencyPercent] = useState("10");
  const [notes, setNotes] = useState("");

  // Load data
  const refresh = useCallback(async () => {
    if (!supabase || !user) return;

    setLoading(true);
    setError(null);

    try {
      // Ensure default agency roles exist
      await ensureDefaultAgencyRoles(supabase, user.id);

      const [est, roles, profs, { clients: cli, projects: proj }] = await Promise.all([
        fetchEstimate(supabase, estimateId),
        fetchAgencyRoles(supabase),
        fetchProfiles(supabase),
        fetchClientsAndProjects(supabase),
      ]);

      if (!est) {
        setError("Estimate not found");
        setLoading(false);
        return;
      }

      setEstimate(est);
      setAgencyRoles(roles);
      setProfiles(profs);
      setClients(cli);
      setProjects(proj);

      // Fetch tracking data if live and linked to project
      if (est.status === "live" && est.projectId) {
        const trackingData = await fetchEstimateTracking(supabase, est.id);
        setTracking(trackingData);
      } else {
        setTracking(null);
      }

      // Initialize form state
      setName(est.name);
      setStatus(est.status);
      setClientId(est.clientId);
      setProjectId(est.projectId);
      setMarkupPercent(est.markupPercent.toString());
      setContingencyPercent(est.contingencyPercent.toString());
      setNotes(est.notes ?? "");

      // Expand all phases by default
      setExpandedPhases(new Set((est.phases ?? []).map((p) => p.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load estimate");
    } finally {
      setLoading(false);
    }
  }, [supabase, user, estimateId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Calculate totals
  const calculation = useMemo((): EstimateCalculation | null => {
    if (!estimate) return null;

    // Create a modified estimate with current form values
    const modifiedEstimate: Estimate = {
      ...estimate,
      markupPercent: parseFloat(markupPercent) || 0,
      contingencyPercent: parseFloat(contingencyPercent) || 0,
    };

    return calculateEstimate(modifiedEstimate);
  }, [estimate, markupPercent, contingencyPercent]);

  // Save estimate header
  const handleSaveHeader = async () => {
    if (!supabase || !estimate) return;

    setSaving(true);
    setError(null);

    try {
      const parsedMarkup = parseFloat(markupPercent);
      const parsedContingency = parseFloat(contingencyPercent);

      await updateEstimate(supabase, estimate.id, {
        name,
        status,
        clientId,
        projectId,
        markupPercent: Number.isFinite(parsedMarkup) ? parsedMarkup : 15,
        contingencyPercent: Number.isFinite(parsedContingency) ? parsedContingency : 10,
        notes: notes || null,
      });

      // Refresh to get latest data
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save estimate");
    } finally {
      setSaving(false);
    }
  };

  // Delete estimate
  const handleDelete = async () => {
    if (!supabase || !estimate) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this estimate? This cannot be undone."
    );
    if (!confirmed) return;

    setSaving(true);
    setError(null);

    try {
      await deleteEstimate(supabase, estimate.id);
      router.push("/estimates");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete estimate");
      setSaving(false);
    }
  };

  // Go live - creates a project and links estimate
  const handleGoLive = async () => {
    if (!supabase || !estimate || !user) return;

    if (!clientId) {
      setError("Please select a client before going live.");
      return;
    }

    if (!name.trim()) {
      setError("Please give this estimate a name before going live.");
      return;
    }

    const confirmed = window.confirm(
      `Create project "${name}" and mark this estimate as live? The project will be added to your timesheet.`
    );
    if (!confirmed) return;

    setSaving(true);
    setError(null);

    try {
      // Save any pending changes first
      const parsedMarkup = parseFloat(markupPercent);
      const parsedContingency = parseFloat(contingencyPercent);

      await updateEstimate(supabase, estimate.id, {
        name,
        clientId,
        markupPercent: Number.isFinite(parsedMarkup) ? parsedMarkup : 15,
        contingencyPercent: Number.isFinite(parsedContingency) ? parsedContingency : 10,
        notes: notes || null,
      });

      // Create project and go live (with budget and blended rate from estimate)
      const budgetCents = calculation?.projectTotalCents ?? 0;
      const totalHours = calculation?.totalEstimatedHours ?? 0;
      const laborCents = calculation?.laborPlusContingencyCents ?? 0;
      // Blended hourly rate = labor (with markup/contingency) ÷ hours
      const hourlyRateCents = totalHours > 0 ? Math.round(laborCents / totalHours) : 0;
      await createProjectFromEstimate(supabase, user.id, estimate.id, name, clientId, budgetCents, hourlyRateCents);

      // Refresh to get updated state
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to go live");
    } finally {
      setSaving(false);
    }
  };

  // Phase actions
  const handleAddPhase = async () => {
    if (!supabase || !estimate) return;

    const sortOrder = (estimate.phases?.length ?? 0);
    const newPhase = await createPhase(
      supabase,
      estimate.id,
      `Phase ${sortOrder + 1}`,
      sortOrder
    );

    setEstimate((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        phases: [...(prev.phases ?? []), newPhase],
      };
    });

    setExpandedPhases((prev) => new Set([...prev, newPhase.id]));
  };

  const handleUpdatePhase = async (phaseId: string, newName: string) => {
    if (!supabase) return;

    await updatePhase(supabase, phaseId, { name: newName });

    setEstimate((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        phases: prev.phases?.map((p) =>
          p.id === phaseId ? { ...p, name: newName } : p
        ),
      };
    });
  };

  const handleDeletePhase = async (phaseId: string) => {
    if (!supabase) return;

    const confirmed = window.confirm(
      "Delete this phase and all its line items?"
    );
    if (!confirmed) return;

    await deletePhase(supabase, phaseId);

    setEstimate((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        phases: prev.phases?.filter((p) => p.id !== phaseId),
      };
    });
  };

  // Line item actions
  const handleAddLineItem = async (phaseId: string) => {
    if (!supabase) return;

    const phase = estimate?.phases?.find((p) => p.id === phaseId);
    const sortOrder = phase?.lineItems.length ?? 0;

    const newItem = await createLineItem(supabase, phaseId, {
      roleName: "",
      hours: 0,
      hourlyRateCents: 0,
      sortOrder,
    });

    setEstimate((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        phases: prev.phases?.map((p) =>
          p.id === phaseId
            ? { ...p, lineItems: [...p.lineItems, newItem] }
            : p
        ),
      };
    });
  };

  const handleUpdateLineItem = async (
    itemId: string,
    updates: Partial<EstimateLineItem>
  ) => {
    if (!supabase) return;

    await updateLineItem(supabase, itemId, updates);

    setEstimate((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        phases: prev.phases?.map((p) => ({
          ...p,
          lineItems: p.lineItems.map((item) =>
            item.id === itemId ? { ...item, ...updates } : item
          ),
        })),
      };
    });
  };

  const handleDeleteLineItem = async (phaseId: string, itemId: string) => {
    if (!supabase) return;

    await deleteLineItem(supabase, itemId);

    setEstimate((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        phases: prev.phases?.map((p) =>
          p.id === phaseId
            ? { ...p, lineItems: p.lineItems.filter((i) => i.id !== itemId) }
            : p
        ),
      };
    });
  };

  // Hard cost actions
  const handleAddHardCost = async () => {
    if (!supabase || !estimate) return;

    const sortOrder = estimate.hardCosts?.length ?? 0;

    const newCost = await createHardCost(supabase, estimate.id, {
      description: "",
      amountCents: 0,
      sortOrder,
    });

    setEstimate((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        hardCosts: [...(prev.hardCosts ?? []), newCost],
      };
    });
  };

  const handleUpdateHardCost = async (
    costId: string,
    updates: Partial<EstimateHardCost>
  ) => {
    if (!supabase) return;

    await updateHardCost(supabase, costId, updates);

    setEstimate((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        hardCosts: prev.hardCosts?.map((c) =>
          c.id === costId ? { ...c, ...updates } : c
        ),
      };
    });
  };

  const handleDeleteHardCost = async (costId: string) => {
    if (!supabase) return;

    await deleteHardCost(supabase, costId);

    setEstimate((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        hardCosts: prev.hardCosts?.filter((c) => c.id !== costId),
      };
    });
  };

  // Toggle phase expansion
  const togglePhase = (phaseId: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) {
        next.delete(phaseId);
      } else {
        next.add(phaseId);
      }
      return next;
    });
  };

  // Role options for combobox
  const roleOptions = useMemo(
    () =>
      agencyRoles.map((role) => ({
        id: role.id,
        label: role.name,
      })),
    [agencyRoles]
  );

  // Person options for combobox
  const personOptions = useMemo(
    () =>
      profiles.map((profile) => ({
        id: profile.id,
        label: profile.displayName,
      })),
    [profiles]
  );

  // Get default rate for a role name
  const getRoleDefaultRate = (roleName: string): number => {
    const role = agencyRoles.find(
      (r) => r.name.toLowerCase() === roleName.toLowerCase()
    );
    return role?.defaultHourlyRateCents ?? 0;
  };

  // Get rate for a person by their display name
  const getPersonRate = (personName: string): number => {
    const profile = profiles.find(
      (p) => p.displayName.toLowerCase() === personName.toLowerCase()
    );
    return profile?.hourlyRateCents ?? 0;
  };

  // Get person ID by their display name
  const getPersonId = (personName: string): string | null => {
    const profile = profiles.find(
      (p) => p.displayName.toLowerCase() === personName.toLowerCase()
    );
    return profile?.id ?? null;
  };

  if (loading) {
    return (
      <AppShell title="Loading..." subtitle="">
        <div className="flex items-center justify-center py-12">
          <div className="text-sm text-muted">Loading estimate...</div>
        </div>
      </AppShell>
    );
  }

  if (!estimate) {
    return (
      <AppShell title="Not Found" subtitle="">
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <p className="text-muted">Estimate not found.</p>
          <Link
            href="/estimates"
            className="inline-flex items-center gap-2 text-sm text-ink hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to estimates
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Estimate Builder" subtitle="Build and refine your project proposal">
      {/* Back link */}
      <Link
        href="/estimates"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to estimates
      </Link>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content - 2 columns */}
        <div className="space-y-6 lg:col-span-2">
          {/* Header section */}
          <section className="rounded-2xl border border-black/5 bg-panel p-5 shadow-soft">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1 space-y-3">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={async () => {
                    if (name !== estimate.name && supabase) {
                      await updateEstimate(supabase, estimate.id, { name });
                    }
                  }}
                  placeholder="Project name..."
                  disabled={status === "live"}
                  className="w-full border-0 bg-transparent text-2xl font-display tracking-tight text-ink placeholder:text-muted/50 focus:outline-none disabled:cursor-not-allowed"
                />
                <div className="flex flex-wrap items-center gap-3">
                  {/* Client selector */}
                  <select
                    value={clientId ?? ""}
                    onChange={async (e) => {
                      const newClientId = e.target.value || null;
                      setClientId(newClientId);
                      if (supabase) {
                        await updateEstimate(supabase, estimate.id, { clientId: newClientId });
                      }
                    }}
                    disabled={status === "live"}
                    className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">Select client...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  {/* Status badge and actions */}
                  {status === "draft" && (
                    <>
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                        Draft
                      </span>
                      <button
                        onClick={handleGoLive}
                        disabled={saving || !clientId || !name.trim()}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Go Live
                      </button>
                    </>
                  )}

                  {status === "live" && (
                    <>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        Live
                      </span>
                      {estimate.project && (
                        <span className="text-sm text-muted">
                          → {estimate.project.clientName} / {estimate.project.name}
                        </span>
                      )}
                    </>
                  )}

                  {status === "archived" && (
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                      Archived
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {status === "draft" && (
                  <button
                    onClick={handleSaveHeader}
                    disabled={saving}
                    className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-ink/90 active:scale-[0.98] disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                )}
                {status !== "live" && (
                  <button
                    onClick={handleDelete}
                    disabled={saving}
                    className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition-all hover:bg-red-100 active:scale-[0.98] disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Phases section */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
                Phases
              </h2>
              <button
                onClick={handleAddPhase}
                className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm font-medium text-ink transition-all hover:border-black/20 hover:shadow-sm active:scale-[0.98]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Phase
              </button>
            </div>

            {(estimate.phases ?? []).length === 0 ? (
              <div className="rounded-xl border border-dashed border-black/10 bg-panel/50 py-8 text-center text-sm text-muted">
                No phases yet. Add one to get started.
              </div>
            ) : (
              <div className="space-y-3">
                {(estimate.phases ?? []).map((phase) => (
                  <PhaseCard
                    key={phase.id}
                    phase={phase}
                    expanded={expandedPhases.has(phase.id)}
                    onToggle={() => togglePhase(phase.id)}
                    onUpdateName={(newName) =>
                      handleUpdatePhase(phase.id, newName)
                    }
                    onDelete={() => handleDeletePhase(phase.id)}
                    onAddLineItem={() => handleAddLineItem(phase.id)}
                    onUpdateLineItem={handleUpdateLineItem}
                    onDeleteLineItem={(itemId) =>
                      handleDeleteLineItem(phase.id, itemId)
                    }
                    roleOptions={roleOptions}
                    personOptions={personOptions}
                    getRoleDefaultRate={getRoleDefaultRate}
                    getPersonRate={getPersonRate}
                    getPersonId={getPersonId}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Hard costs section */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
                Hard Costs
              </h2>
              <button
                onClick={handleAddHardCost}
                className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm font-medium text-ink transition-all hover:border-black/20 hover:shadow-sm active:scale-[0.98]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Cost
              </button>
            </div>

            {(estimate.hardCosts ?? []).length === 0 ? (
              <div className="rounded-xl border border-dashed border-black/10 bg-panel/50 py-6 text-center text-sm text-muted">
                No hard costs. Add outside expenses that pass through at cost.
              </div>
            ) : (
              <div className="rounded-xl border border-black/5 bg-panel shadow-soft">
                <div className="divide-y divide-black/5">
                  {(estimate.hardCosts ?? []).map((cost) => (
                    <HardCostRow
                      key={cost.id}
                      cost={cost}
                      onUpdate={(updates) =>
                        handleUpdateHardCost(cost.id, updates)
                      }
                      onDelete={() => handleDeleteHardCost(cost.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Notes section */}
          <section className="rounded-2xl border border-black/5 bg-panel p-5 shadow-soft">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">
              Notes
            </h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Assumptions, exclusions, revision policy..."
              rows={4}
              className="w-full resize-none rounded-xl border border-black/10 bg-white px-3 py-2 text-sm placeholder:text-muted/50 focus:border-black/30 focus:outline-none"
            />
          </section>
        </div>

        {/* Summary sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-6">
            {/* Calculation summary */}
            <section className="rounded-2xl border border-black/5 bg-panel p-5 shadow-soft">
              <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted">
                Summary
              </h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Labor subtotal</span>
                  <span className="font-medium font-mono">
                    {formatCents(calculation?.laborSubtotalCents ?? 0)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-muted">Markup</span>
                    <input
                      type="text"
                      value={markupPercent}
                      onChange={(e) => setMarkupPercent(e.target.value)}
                      className="w-10 rounded-lg border border-black/15 bg-canvas px-1 py-0.5 text-center font-mono text-xs focus:border-black/30 focus:outline-none"
                    />
                    <span className="text-muted">%</span>
                  </div>
                  <span className="font-medium font-mono text-emerald-600">
                    +{formatCents(calculation?.markupCents ?? 0)}
                  </span>
                </div>

                <div className="border-t border-black/5 pt-3">
                  <div className="flex justify-between">
                    <span className="text-muted">Labor total</span>
                    <span className="font-medium font-mono">
                      {formatCents(calculation?.laborWithMarkupCents ?? 0)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-muted">Contingency</span>
                    <input
                      type="text"
                      value={contingencyPercent}
                      onChange={(e) => setContingencyPercent(e.target.value)}
                      className="w-10 rounded-lg border border-black/15 bg-canvas px-1 py-0.5 text-center font-mono text-xs focus:border-black/30 focus:outline-none"
                    />
                    <span className="text-muted">%</span>
                  </div>
                  <span className="font-medium font-mono text-emerald-600">
                    +{formatCents(calculation?.contingencyCents ?? 0)}
                  </span>
                </div>

                <div className="border-t border-black/5 pt-3">
                  <div className="flex justify-between">
                    <span className="text-muted">Labor + contingency</span>
                    <span className="font-medium font-mono">
                      {formatCents(calculation?.laborPlusContingencyCents ?? 0)}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted">Hard costs</span>
                  <span className="font-medium font-mono">
                    +{formatCents(calculation?.hardCostsTotalCents ?? 0)}
                  </span>
                </div>

                <div className="border-t-2 border-ink/20 pt-3">
                  <div className="flex justify-between">
                    <span className="text-lg font-medium text-ink">
                      Project Total
                    </span>
                    <span className="text-lg font-bold font-mono text-ink">
                      {formatCents(calculation?.projectTotalCents ?? 0)}
                    </span>
                  </div>
                </div>

                <div className="mt-2 text-xs text-muted">
                  <span className="font-mono">{calculation?.totalEstimatedHours ?? 0}</span> total hours estimated
                </div>
              </div>
            </section>

            {/* Tracking section - only shown for live estimates with linked project */}
            {tracking && status === "live" && projectId && (
              <TrackingCard tracking={tracking} />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ─────────────────────────────────────────────────────────────────
// Phase Card Component
// ─────────────────────────────────────────────────────────────────

function PhaseCard({
  phase,
  expanded,
  onToggle,
  onUpdateName,
  onDelete,
  onAddLineItem,
  onUpdateLineItem,
  onDeleteLineItem,
  roleOptions,
  personOptions,
  getRoleDefaultRate,
  getPersonRate,
  getPersonId,
}: {
  phase: EstimatePhase;
  expanded: boolean;
  onToggle: () => void;
  onUpdateName: (name: string) => void;
  onDelete: () => void;
  onAddLineItem: () => void;
  onUpdateLineItem: (itemId: string, updates: Partial<EstimateLineItem>) => void;
  onDeleteLineItem: (itemId: string) => void;
  roleOptions: { id: string; label: string }[];
  personOptions: { id: string; label: string }[];
  getRoleDefaultRate: (roleName: string) => number;
  getPersonRate: (personName: string) => number;
  getPersonId: (personName: string) => string | null;
}) {
  const [nameValue, setNameValue] = useState(phase.name);

  // Phase name options from defaults
  const phaseNameOptions = useMemo(
    () =>
      DEFAULT_PHASE_NAMES.map((name, idx) => ({
        id: `phase-${idx}`,
        label: name,
      })),
    []
  );

  // Calculate phase subtotal
  const phaseSubtotal = phase.lineItems.reduce(
    (sum, item) => sum + item.hours * item.hourlyRateCents,
    0
  );

  const phaseHours = phase.lineItems.reduce(
    (sum, item) => sum + item.hours,
    0
  );

  const handleNameChange = (newName: string) => {
    setNameValue(newName);
    if (newName !== phase.name) {
      onUpdateName(newName);
    }
  };

  return (
    <div className="rounded-xl border border-black/5 bg-panel shadow-soft">
      {/* Phase header */}
      <div className="flex items-center gap-3 p-4">
        <button
          onClick={onToggle}
          className="rounded p-1 text-muted hover:bg-black/5 hover:text-ink"
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        <div className="flex-1">
          <ComboBox
            options={phaseNameOptions}
            value={nameValue}
            onChange={handleNameChange}
            placeholder="Select or type phase name..."
            allowCreate={true}
            createLabel="Custom phase"
          />
        </div>

        <div className="flex items-center gap-3 text-sm text-muted">
          <span className="font-mono">{phaseHours}h</span>
          <span className="font-medium text-ink">{formatCents(phaseSubtotal)}</span>
        </div>

        <button
          onClick={onDelete}
          className="rounded p-1.5 text-muted hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Line items */}
      {expanded && (
        <div className="border-t border-black/5">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_1fr_4rem_5rem_4.5rem] gap-2 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted">
            <div>Role</div>
            <div>Person</div>
            <div className="text-right">Hours</div>
            <div className="text-right">Rate</div>
            <div></div>
          </div>

          {/* Line items */}
          <div className="divide-y divide-black/5">
            {phase.lineItems.map((item) => (
              <LineItemRow
                key={item.id}
                item={item}
                onUpdate={(updates) => onUpdateLineItem(item.id, updates)}
                onDelete={() => onDeleteLineItem(item.id)}
                roleOptions={roleOptions}
                personOptions={personOptions}
                getRoleDefaultRate={getRoleDefaultRate}
                getPersonRate={getPersonRate}
                getPersonId={getPersonId}
              />
            ))}
          </div>

          {/* Add line item */}
          <div className="border-t border-black/5 px-4 py-3">
            <button
              onClick={onAddLineItem}
              className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
            >
              <Plus className="h-3.5 w-3.5" />
              Add line item
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Line Item Row Component
// ─────────────────────────────────────────────────────────────────

function LineItemRow({
  item,
  onUpdate,
  onDelete,
  roleOptions,
  personOptions,
  getRoleDefaultRate,
  getPersonRate,
  getPersonId,
}: {
  item: EstimateLineItem;
  onUpdate: (updates: Partial<EstimateLineItem>) => void;
  onDelete: () => void;
  roleOptions: { id: string; label: string }[];
  personOptions: { id: string; label: string }[];
  getRoleDefaultRate: (roleName: string) => number;
  getPersonRate: (personName: string) => number;
  getPersonId: (personName: string) => string | null;
}) {
  const [roleName, setRoleName] = useState(item.roleName);
  const [personName, setPersonName] = useState(item.personName ?? "");
  const [hours, setHours] = useState(formatHoursInput(item.hours));
  const [rate, setRate] = useState(formatDollarsInput(item.hourlyRateCents));

  const lineTotal = item.hours * item.hourlyRateCents;

  // Handle role selection - auto-fill rate if empty
  const handleRoleChange = (newRole: string) => {
    setRoleName(newRole);

    // If rate is empty or zero, auto-fill from role defaults
    if (!rate || parseFloat(rate) === 0) {
      const defaultRate = getRoleDefaultRate(newRole);
      if (defaultRate > 0) {
        setRate(formatDollarsInput(defaultRate));
        onUpdate({
          roleName: newRole,
          hourlyRateCents: defaultRate,
        });
        return;
      }
    }

    onUpdate({ roleName: newRole });
  };

  // Handle person selection - auto-fill rate if empty and person has a rate
  const handlePersonChange = (newPerson: string) => {
    setPersonName(newPerson);

    const personId = getPersonId(newPerson);
    const personRate = getPersonRate(newPerson);

    // If rate is empty or zero, auto-fill from person's rate
    if ((!rate || parseFloat(rate) === 0) && personRate > 0) {
      setRate(formatDollarsInput(personRate));
      onUpdate({
        personName: newPerson || null,
        personId,
        hourlyRateCents: personRate,
      });
      return;
    }

    onUpdate({
      personName: newPerson || null,
      personId,
    });
  };

  return (
    <div className="grid grid-cols-[1fr_1fr_4rem_5rem_4.5rem] items-center gap-2 px-4 py-2">
      {/* Role */}
      <div>
        <ComboBox
          options={roleOptions}
          value={roleName}
          onChange={handleRoleChange}
          placeholder="Select role..."
          allowCreate={true}
          createLabel="Add role"
        />
      </div>

      {/* Person */}
      <div>
        <ComboBox
          options={personOptions}
          value={personName}
          onChange={handlePersonChange}
          placeholder="Optional..."
          allowCreate={false}
        />
      </div>

      {/* Hours */}
      <div>
        <input
          type="text"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          onBlur={() => onUpdate({ hours: parseHours(hours) })}
          placeholder="0"
          className="w-full rounded-lg border border-black/15 bg-canvas px-2 py-1.5 text-right font-mono text-sm focus:border-black/30 focus:outline-none"
        />
      </div>

      {/* Rate */}
      <div>
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 font-mono text-sm text-muted">
            $
          </span>
          <input
            type="text"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            onBlur={() => onUpdate({ hourlyRateCents: parseDollars(rate) })}
            placeholder="0"
            className="w-full rounded-lg border border-black/15 bg-canvas py-1.5 pl-5 pr-2 text-right font-mono text-sm focus:border-black/30 focus:outline-none"
          />
        </div>
      </div>

      {/* Delete + total */}
      <div className="flex items-center justify-end gap-1">
        <span className="font-mono text-xs text-muted">{formatCents(lineTotal)}</span>
        <button
          onClick={onDelete}
          className="rounded p-1 text-muted hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Hard Cost Row Component
// ─────────────────────────────────────────────────────────────────

function HardCostRow({
  cost,
  onUpdate,
  onDelete,
}: {
  cost: EstimateHardCost;
  onUpdate: (updates: Partial<EstimateHardCost>) => void;
  onDelete: () => void;
}) {
  const [description, setDescription] = useState(cost.description);
  const [amount, setAmount] = useState(formatDollarsInput(cost.amountCents));

  return (
    <div className="flex items-center gap-3 p-4">
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={() => onUpdate({ description })}
        placeholder="Description..."
        className="flex-1 rounded-lg border border-black/15 bg-canvas px-2 py-1.5 text-sm focus:border-black/30 focus:outline-none"
      />

      <div className="relative w-28">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 font-mono text-sm text-muted">
          $
        </span>
        <input
          type="text"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onBlur={() => onUpdate({ amountCents: parseDollars(amount) })}
          placeholder="0"
          className="w-full rounded-lg border border-black/15 bg-canvas py-1.5 pl-5 pr-2 text-right font-mono text-sm focus:border-black/30 focus:outline-none"
        />
      </div>

      <button
        onClick={onDelete}
        className="rounded p-1.5 text-muted hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Tracking Card Component
// ─────────────────────────────────────────────────────────────────

function TrackingCard({
  tracking,
}: {
  tracking: {
    estimatedHours: number;
    actualMinutes: number;
    estimatedValueCents: number;
    actualValueCents: number;
  };
}) {
  const actualHours = tracking.actualMinutes / 60;
  const remainingHours = tracking.estimatedHours - actualHours;
  const progressPercent = tracking.estimatedHours > 0
    ? Math.min(100, Math.round((actualHours / tracking.estimatedHours) * 100))
    : 0;

  const isOver = actualHours > tracking.estimatedHours;

  return (
    <section className="rounded-2xl border border-black/5 bg-panel p-5 shadow-soft">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted">
        Tracking Against Estimate
      </h2>

      <div className="space-y-4">
        {/* Hours comparison */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted">My estimated hours</span>
            <span className="font-medium">{tracking.estimatedHours}h</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">My actual hours</span>
            <span className="font-medium">{actualHours.toFixed(1)}h</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">
              {isOver ? "Over by" : "Remaining"}
            </span>
            <span className={`font-medium ${isOver ? "text-red-600" : "text-emerald-600"}`}>
              {isOver ? "+" : ""}{Math.abs(remainingHours).toFixed(1)}h
              {!isOver && ` (${100 - progressPercent}%)`}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="h-3 w-full overflow-hidden rounded-full bg-black/5">
            <div
              className={`h-full rounded-full transition-all ${
                isOver
                  ? "bg-red-500"
                  : progressPercent > 80
                  ? "bg-amber-500"
                  : "bg-emerald-500"
              }`}
              style={{ width: `${Math.min(100, progressPercent)}%` }}
            />
          </div>
          <div className="text-center text-xs text-muted">
            {progressPercent}% of estimated hours used
          </div>
        </div>

        {/* Value comparison */}
        <div className="border-t border-black/5 pt-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted">Estimated value</span>
            <span className="font-medium">
              {formatCents(tracking.estimatedValueCents)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Actual value</span>
            <span className="font-medium">
              {formatCents(tracking.actualValueCents)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
