-- Add indexes for calendar sync query performance

-- Used when checking existing calendar entries by status/source
create index if not exists idx_time_entries_owner_status_source
  on public.time_entries(owner_id, status, source);

-- Used when linking time entries to calendar events
create index if not exists idx_time_entries_calendar_event
  on public.time_entries(calendar_event_id);

-- Used when fetching active feed sources for a user
create index if not exists idx_calendar_feed_sources_owner_active
  on public.calendar_feed_sources(owner_id, active);
