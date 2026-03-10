import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AgencyRole,
  Estimate,
  EstimateCalculation,
  EstimateHardCost,
  EstimateLineItem,
  EstimateListItem,
  EstimatePhase,
  EstimateStatus,
  ProfileOption,
  DEFAULT_PHASE_NAMES,
} from "@/lib/types";

// ─────────────────────────────────────────────────────────────────
// Agency Roles
// ─────────────────────────────────────────────────────────────────

export async function fetchAgencyRoles(supabase: SupabaseClient): Promise<AgencyRole[]> {
  const { data, error } = await supabase
    .from("agency_roles")
    .select("id,name,default_hourly_rate_cents,sort_order")
    .order("sort_order", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    defaultHourlyRateCents: row.default_hourly_rate_cents,
    sortOrder: row.sort_order,
  }));
}

export async function ensureDefaultAgencyRoles(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { error } = await supabase.rpc("create_default_agency_roles", {
    p_owner_id: userId,
  });

  if (error) throw error;
}

export async function upsertAgencyRole(
  supabase: SupabaseClient,
  userId: string,
  role: Partial<AgencyRole> & { name: string }
): Promise<AgencyRole> {
  const { data, error } = await supabase
    .from("agency_roles")
    .upsert(
      {
        id: role.id,
        owner_id: userId,
        name: role.name,
        default_hourly_rate_cents: role.defaultHourlyRateCents ?? 0,
        sort_order: role.sortOrder ?? 0,
      },
      { onConflict: "id" }
    )
    .select("id,name,default_hourly_rate_cents,sort_order")
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    defaultHourlyRateCents: data.default_hourly_rate_cents,
    sortOrder: data.sort_order,
  };
}

// ─────────────────────────────────────────────────────────────────
// Profiles (for person picker)
// ─────────────────────────────────────────────────────────────────

function extractDisplayName(email: string): string {
  // Extract name from email like "dylan@mondayandpartners.com" -> "Dylan"
  const localPart = email.split("@")[0];
  // Handle formats like "dylan.smith" or "dylan_smith"
  const parts = localPart.split(/[._-]/);
  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export async function fetchProfiles(
  supabase: SupabaseClient
): Promise<ProfileOption[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,hourly_rate_cents")
    .order("email", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    displayName: extractDisplayName(row.email),
    hourlyRateCents: row.hourly_rate_cents ?? 0,
  }));
}

// ─────────────────────────────────────────────────────────────────
// Estimates List
// ─────────────────────────────────────────────────────────────────

export async function fetchEstimatesList(
  supabase: SupabaseClient
): Promise<EstimateListItem[]> {
  const { data: estimates, error } = await supabase
    .from("estimates")
    .select(`
      id,
      name,
      status,
      client_id,
      project_id,
      created_at,
      updated_at,
      clients(name),
      projects(name),
      estimate_phases(
        id,
        estimate_line_items(hours,hourly_rate_cents)
      ),
      estimate_hard_costs(amount_cents)
    `)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return (estimates ?? []).map((est) => {
    const client = Array.isArray(est.clients) ? est.clients[0] : est.clients;
    const project = Array.isArray(est.projects) ? est.projects[0] : est.projects;

    // Calculate totals
    let laborCents = 0;
    const phases = est.estimate_phases ?? [];
    for (const phase of phases) {
      const items = phase.estimate_line_items ?? [];
      for (const item of items) {
        laborCents += (item.hours ?? 0) * (item.hourly_rate_cents ?? 0);
      }
    }

    let hardCostsCents = 0;
    for (const cost of est.estimate_hard_costs ?? []) {
      hardCostsCents += cost.amount_cents ?? 0;
    }

    // For list view, show labor + hard costs (without markup/contingency for simplicity)
    const totalCents = laborCents + hardCostsCents;

    return {
      id: est.id,
      name: est.name,
      status: est.status as EstimateStatus,
      projectId: est.project_id,
      projectName: project?.name ?? null,
      clientName: client?.name ?? null,
      createdAt: est.created_at,
      updatedAt: est.updated_at,
      phaseCount: phases.length,
      totalCents,
    };
  });
}

// ─────────────────────────────────────────────────────────────────
// Single Estimate (Full)
// ─────────────────────────────────────────────────────────────────

export async function fetchEstimate(
  supabase: SupabaseClient,
  estimateId: string
): Promise<Estimate | null> {
  const { data, error } = await supabase
    .from("estimates")
    .select(`
      id,
      owner_id,
      name,
      status,
      client_id,
      project_id,
      markup_percent,
      contingency_percent,
      notes,
      created_at,
      updated_at,
      clients(id,name,kind),
      projects(id,name,clients(name)),
      estimate_phases(
        id,
        estimate_id,
        name,
        sort_order,
        estimate_line_items(
          id,
          phase_id,
          role_name,
          person_name,
          person_id,
          hours,
          hourly_rate_cents,
          sort_order
        )
      ),
      estimate_hard_costs(
        id,
        estimate_id,
        description,
        amount_cents,
        sort_order
      )
    `)
    .eq("id", estimateId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const client = Array.isArray(data.clients) ? data.clients[0] : data.clients;
  const project = Array.isArray(data.projects) ? data.projects[0] : data.projects;
  const projectClient = project ? (Array.isArray(project.clients) ? project.clients[0] : project.clients) : null;

  const phases: EstimatePhase[] = (data.estimate_phases ?? [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((phase) => ({
      id: phase.id,
      estimateId: phase.estimate_id,
      name: phase.name,
      sortOrder: phase.sort_order,
      lineItems: (phase.estimate_line_items ?? [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((item) => ({
          id: item.id,
          phaseId: item.phase_id,
          roleName: item.role_name,
          personName: item.person_name,
          personId: item.person_id,
          hours: Number(item.hours),
          hourlyRateCents: item.hourly_rate_cents,
          sortOrder: item.sort_order,
        })),
    }));

  const hardCosts: EstimateHardCost[] = (data.estimate_hard_costs ?? [])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((cost) => ({
      id: cost.id,
      estimateId: cost.estimate_id,
      description: cost.description,
      amountCents: cost.amount_cents,
      sortOrder: cost.sort_order,
    }));

  return {
    id: data.id,
    ownerId: data.owner_id,
    name: data.name,
    status: data.status as EstimateStatus,
    clientId: data.client_id,
    projectId: data.project_id,
    markupPercent: Number(data.markup_percent),
    contingencyPercent: Number(data.contingency_percent),
    notes: data.notes,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    phases,
    hardCosts,
    client: client
      ? {
          id: client.id,
          name: client.name,
          kind: client.kind,
        }
      : null,
    project: project
      ? {
          id: project.id,
          name: project.name,
          clientName: projectClient?.name ?? "Unknown",
        }
      : null,
  };
}

// ─────────────────────────────────────────────────────────────────
// Create / Update Estimate
// ─────────────────────────────────────────────────────────────────

export async function createEstimate(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  clientId?: string | null,
  initialPhaseNames?: readonly string[]
): Promise<string> {
  // Create the estimate
  const { data: estimate, error: estError } = await supabase
    .from("estimates")
    .insert({
      owner_id: userId,
      name,
      client_id: clientId ?? null,
      status: "draft",
      markup_percent: 15,
      contingency_percent: 10,
    })
    .select("id")
    .single();

  if (estError) throw estError;

  // Create default phases if provided
  const phaseNames = initialPhaseNames ?? [];
  if (phaseNames.length > 0) {
    const phasesToInsert = phaseNames.map((phaseName, index) => ({
      estimate_id: estimate.id,
      name: phaseName,
      sort_order: index,
    }));

    const { error: phaseError } = await supabase
      .from("estimate_phases")
      .insert(phasesToInsert);

    if (phaseError) throw phaseError;
  }

  return estimate.id;
}

export async function updateEstimate(
  supabase: SupabaseClient,
  estimateId: string,
  updates: {
    name?: string;
    status?: EstimateStatus;
    clientId?: string | null;
    projectId?: string | null;
    markupPercent?: number;
    contingencyPercent?: number;
    notes?: string | null;
  }
): Promise<void> {
  const payload: Record<string, unknown> = {};

  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.clientId !== undefined) payload.client_id = updates.clientId;
  if (updates.projectId !== undefined) payload.project_id = updates.projectId;
  if (updates.markupPercent !== undefined) payload.markup_percent = updates.markupPercent;
  if (updates.contingencyPercent !== undefined) payload.contingency_percent = updates.contingencyPercent;
  if (updates.notes !== undefined) payload.notes = updates.notes;

  const { error } = await supabase
    .from("estimates")
    .update(payload)
    .eq("id", estimateId);

  if (error) throw error;
}

export async function deleteEstimate(
  supabase: SupabaseClient,
  estimateId: string
): Promise<void> {
  const { error } = await supabase
    .from("estimates")
    .delete()
    .eq("id", estimateId);

  if (error) throw error;
}

/**
 * Creates a project from an estimate and links them.
 * Called when estimate status changes to "live".
 */
export async function createProjectFromEstimate(
  supabase: SupabaseClient,
  userId: string,
  estimateId: string,
  projectName: string,
  clientId: string
): Promise<string> {
  // Create the project
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      owner_id: userId,
      client_id: clientId,
      name: projectName,
      active: true,
    })
    .select("id")
    .single();

  if (projectError) throw projectError;

  // Link estimate to the new project and set status to live
  const { error: updateError } = await supabase
    .from("estimates")
    .update({
      project_id: project.id,
      status: "live",
    })
    .eq("id", estimateId);

  if (updateError) throw updateError;

  return project.id;
}

// ─────────────────────────────────────────────────────────────────
// Phases
// ─────────────────────────────────────────────────────────────────

export async function createPhase(
  supabase: SupabaseClient,
  estimateId: string,
  name: string,
  sortOrder: number
): Promise<EstimatePhase> {
  const { data, error } = await supabase
    .from("estimate_phases")
    .insert({
      estimate_id: estimateId,
      name,
      sort_order: sortOrder,
    })
    .select("id,estimate_id,name,sort_order")
    .single();

  if (error) throw error;

  return {
    id: data.id,
    estimateId: data.estimate_id,
    name: data.name,
    sortOrder: data.sort_order,
    lineItems: [],
  };
}

export async function updatePhase(
  supabase: SupabaseClient,
  phaseId: string,
  updates: { name?: string; sortOrder?: number }
): Promise<void> {
  const payload: Record<string, unknown> = {};

  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.sortOrder !== undefined) payload.sort_order = updates.sortOrder;

  const { error } = await supabase
    .from("estimate_phases")
    .update(payload)
    .eq("id", phaseId);

  if (error) throw error;
}

export async function deletePhase(
  supabase: SupabaseClient,
  phaseId: string
): Promise<void> {
  const { error } = await supabase
    .from("estimate_phases")
    .delete()
    .eq("id", phaseId);

  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────
// Line Items
// ─────────────────────────────────────────────────────────────────

export async function createLineItem(
  supabase: SupabaseClient,
  phaseId: string,
  item: {
    roleName: string;
    personName?: string | null;
    personId?: string | null;
    hours?: number;
    hourlyRateCents?: number;
    sortOrder?: number;
  }
): Promise<EstimateLineItem> {
  const { data, error } = await supabase
    .from("estimate_line_items")
    .insert({
      phase_id: phaseId,
      role_name: item.roleName,
      person_name: item.personName ?? null,
      person_id: item.personId ?? null,
      hours: item.hours ?? 0,
      hourly_rate_cents: item.hourlyRateCents ?? 0,
      sort_order: item.sortOrder ?? 0,
    })
    .select("id,phase_id,role_name,person_name,person_id,hours,hourly_rate_cents,sort_order")
    .single();

  if (error) throw error;

  return {
    id: data.id,
    phaseId: data.phase_id,
    roleName: data.role_name,
    personName: data.person_name,
    personId: data.person_id,
    hours: Number(data.hours),
    hourlyRateCents: data.hourly_rate_cents,
    sortOrder: data.sort_order,
  };
}

export async function updateLineItem(
  supabase: SupabaseClient,
  itemId: string,
  updates: {
    roleName?: string;
    personName?: string | null;
    personId?: string | null;
    hours?: number;
    hourlyRateCents?: number;
    sortOrder?: number;
  }
): Promise<void> {
  const payload: Record<string, unknown> = {};

  if (updates.roleName !== undefined) payload.role_name = updates.roleName;
  if (updates.personName !== undefined) payload.person_name = updates.personName;
  if (updates.personId !== undefined) payload.person_id = updates.personId;
  if (updates.hours !== undefined) payload.hours = updates.hours;
  if (updates.hourlyRateCents !== undefined) payload.hourly_rate_cents = updates.hourlyRateCents;
  if (updates.sortOrder !== undefined) payload.sort_order = updates.sortOrder;

  const { error } = await supabase
    .from("estimate_line_items")
    .update(payload)
    .eq("id", itemId);

  if (error) throw error;
}

export async function deleteLineItem(
  supabase: SupabaseClient,
  itemId: string
): Promise<void> {
  const { error } = await supabase
    .from("estimate_line_items")
    .delete()
    .eq("id", itemId);

  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────
// Hard Costs
// ─────────────────────────────────────────────────────────────────

export async function createHardCost(
  supabase: SupabaseClient,
  estimateId: string,
  cost: {
    description: string;
    amountCents?: number;
    sortOrder?: number;
  }
): Promise<EstimateHardCost> {
  const { data, error } = await supabase
    .from("estimate_hard_costs")
    .insert({
      estimate_id: estimateId,
      description: cost.description,
      amount_cents: cost.amountCents ?? 0,
      sort_order: cost.sortOrder ?? 0,
    })
    .select("id,estimate_id,description,amount_cents,sort_order")
    .single();

  if (error) throw error;

  return {
    id: data.id,
    estimateId: data.estimate_id,
    description: data.description,
    amountCents: data.amount_cents,
    sortOrder: data.sort_order,
  };
}

export async function updateHardCost(
  supabase: SupabaseClient,
  costId: string,
  updates: {
    description?: string;
    amountCents?: number;
    sortOrder?: number;
  }
): Promise<void> {
  const payload: Record<string, unknown> = {};

  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.amountCents !== undefined) payload.amount_cents = updates.amountCents;
  if (updates.sortOrder !== undefined) payload.sort_order = updates.sortOrder;

  const { error } = await supabase
    .from("estimate_hard_costs")
    .update(payload)
    .eq("id", costId);

  if (error) throw error;
}

export async function deleteHardCost(
  supabase: SupabaseClient,
  costId: string
): Promise<void> {
  const { error } = await supabase
    .from("estimate_hard_costs")
    .delete()
    .eq("id", costId);

  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────
// Calculations (Client-side)
// ─────────────────────────────────────────────────────────────────

export function calculateEstimate(estimate: Estimate): EstimateCalculation {
  // Sum labor across all phases
  let laborSubtotalCents = 0;
  let totalEstimatedHours = 0;

  for (const phase of estimate.phases ?? []) {
    for (const item of phase.lineItems) {
      laborSubtotalCents += item.hours * item.hourlyRateCents;
      totalEstimatedHours += item.hours;
    }
  }

  // Apply markup
  const markupCents = Math.round(laborSubtotalCents * (estimate.markupPercent / 100));
  const laborWithMarkupCents = laborSubtotalCents + markupCents;

  // Apply contingency
  const contingencyCents = Math.round(laborWithMarkupCents * (estimate.contingencyPercent / 100));
  const laborPlusContingencyCents = laborWithMarkupCents + contingencyCents;

  // Sum hard costs
  let hardCostsTotalCents = 0;
  for (const cost of estimate.hardCosts ?? []) {
    hardCostsTotalCents += cost.amountCents;
  }

  // Project total
  const projectTotalCents = laborPlusContingencyCents + hardCostsTotalCents;

  return {
    laborSubtotalCents,
    markupCents,
    laborWithMarkupCents,
    contingencyCents,
    laborPlusContingencyCents,
    hardCostsTotalCents,
    projectTotalCents,
    totalEstimatedHours,
  };
}

// ─────────────────────────────────────────────────────────────────
// Tracking (Estimate vs Actuals)
// ─────────────────────────────────────────────────────────────────

export async function fetchEstimateTracking(
  supabase: SupabaseClient,
  estimateId: string
): Promise<{
  estimatedHours: number;
  actualMinutes: number;
  estimatedValueCents: number;
  actualValueCents: number;
} | null> {
  // First get the estimate with its project link
  const estimate = await fetchEstimate(supabase, estimateId);
  if (!estimate || !estimate.projectId) return null;

  // Calculate estimated hours and value from line items
  let estimatedHours = 0;
  let estimatedValueCents = 0;

  for (const phase of estimate.phases ?? []) {
    for (const item of phase.lineItems) {
      estimatedHours += item.hours;
      estimatedValueCents += item.hours * item.hourlyRateCents;
    }
  }

  // Fetch actual time entries for the linked project
  const { data: entries, error } = await supabase
    .from("time_entries")
    .select("rounded_minutes")
    .eq("project_id", estimate.projectId)
    .eq("status", "approved");

  if (error) throw error;

  const actualMinutes = (entries ?? []).reduce(
    (sum, entry) => sum + (entry.rounded_minutes ?? 0),
    0
  );

  // For actual value, we need the project's effective rate
  // For now, use average rate from estimate (can be refined later)
  const avgRateCents = estimatedHours > 0
    ? Math.round(estimatedValueCents / estimatedHours)
    : 0;
  const actualValueCents = Math.round((actualMinutes / 60) * avgRateCents);

  return {
    estimatedHours,
    actualMinutes,
    estimatedValueCents,
    actualValueCents,
  };
}
