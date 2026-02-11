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
  clientName: string;
  projectName: string;
  isDraft?: boolean;
  cells: Record<string, number>;
}

export interface MergeEvent {
  id: string;
  sourceProjectId: string;
  targetProjectId: string;
  effectiveDate: string;
}
