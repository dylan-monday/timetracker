export type Role = "admin" | "user";

export type EntryStatus = "draft" | "approved" | "rejected";

export type EntrySource = "manual" | "calendar";

export type ClientKind = "external" | "internal";

export interface Client {
  id: string;
  name: string;
  kind: ClientKind;
  active: boolean;
}

export interface Project {
  id: string;
  clientId: string;
  name: string;
  active: boolean;
  budgetAmountCents?: number;
}

export interface TimeEntry {
  id: string;
  userId: string;
  projectId: string;
  date: string;
  roundedMinutes: number;
  status: EntryStatus;
  source: EntrySource;
  tags: string[];
  notes?: string;
}

export interface WeekDay {
  isoDate: string;
  label: string;
  day: string;
}

export interface WeekLine {
  id: string;
  projectId?: string;
  clientId?: string;
  clientName: string;
  projectName: string;
  isDraft?: boolean;
  cells: Record<string, number>;
}

export interface ClientOption {
  id: string;
  name: string;
  kind: ClientKind;
  hourlyRateCents?: number | null;
}

export interface ProjectOption {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  budgetCents?: number | null;
  hourlyRateCents?: number | null;
}

export interface DraftEntry {
  id: string;
  isoDate: string;
  roundedMinutes: number;
  projectId: string | null;
  projectName: string;
  clientName: string;
  eventTitle: string;
  startsAt: string | null;
  endsAt: string | null;
}

export interface MergeEvent {
  id: string;
  sourceProjectId: string;
  targetProjectId: string;
  effectiveDate: string;
}

export interface CalendarFeedSource {
  id: string;
  name: string;
  feedUrl: string;
  active: boolean;
}

// ─────────────────────────────────────────────────────────────────
// Estimates
// ─────────────────────────────────────────────────────────────────

export type EstimateStatus = "draft" | "live" | "archived";

export interface AgencyRole {
  id: string;
  name: string;
  defaultHourlyRateCents: number;
  sortOrder: number;
}

export interface EstimateLineItem {
  id: string;
  phaseId: string;
  roleName: string;
  personName: string | null;
  personId: string | null;
  hours: number;
  hourlyRateCents: number;
  sortOrder: number;
}

export interface EstimatePhase {
  id: string;
  estimateId: string;
  name: string;
  sortOrder: number;
  lineItems: EstimateLineItem[];
}

export interface EstimateHardCost {
  id: string;
  estimateId: string;
  description: string;
  amountCents: number;
  sortOrder: number;
}

export interface Estimate {
  id: string;
  ownerId: string;
  name: string;
  status: EstimateStatus;
  clientId: string | null;
  projectId: string | null;
  markupPercent: number;
  contingencyPercent: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Nested data (populated when fetching full estimate)
  phases?: EstimatePhase[];
  hardCosts?: EstimateHardCost[];
  // Joined data
  client?: {
    id: string;
    name: string;
    kind: ClientKind;
  } | null;
  project?: {
    id: string;
    name: string;
    clientName: string;
  } | null;
}

export interface EstimateListItem {
  id: string;
  name: string;
  status: EstimateStatus;
  projectId: string | null;
  projectName: string | null;
  clientName: string | null;
  createdAt: string;
  updatedAt: string;
  // Computed totals
  phaseCount: number;
  totalCents: number;
}

export interface EstimateCalculation {
  laborSubtotalCents: number;
  markupCents: number;
  laborWithMarkupCents: number;
  contingencyCents: number;
  laborPlusContingencyCents: number;
  hardCostsTotalCents: number;
  projectTotalCents: number;
  totalEstimatedHours: number;
}

// Default phase names for new estimates
export const DEFAULT_PHASE_NAMES = [
  "Immersion",
  "Concept Development",
  "Creative Development",
  "Production",
  "Post Production",
] as const;
