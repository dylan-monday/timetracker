-- Allow unassigned calendar drafts so user can map-or-reject in UI.
-- Safe to run multiple times.

alter table public.time_entries
  alter column project_id drop not null;
