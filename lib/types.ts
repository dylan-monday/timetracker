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
