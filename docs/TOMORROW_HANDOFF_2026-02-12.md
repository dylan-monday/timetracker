# M+P Time Tracker - Handoff (Feb 12, 2026)

## Status
- Branch: `main`
- Latest deployed commit before this handoff: `9c81e18`
- App is functional; active areas to refine are UX and calendar workflow constraints.

## Backlog For Next Session (User Confirmed)
1. Ambient background motion/design: move to backlog (do not iterate further until aligned on exact visual direction).
2. Calendar drafts workflow: nothing should remain unmapped.
   - Required state: each draft must be either:
     - mapped to a valid project, or
     - rejected.
   - No "unmapped skipped" end-state in normal usage.
3. Admin projects: allow renaming project titles.
4. Admin projects: archive icon pill should be tighter (less horizontal padding).

## Current Calendar Sync Behavior
- Sync no longer crashes on unmapped events.
- Current behavior: unmapped events are skipped and reported in sync message (`Skipped X unmapped events`).
- This was added to avoid DB errors where `time_entries.project_id` is non-nullable.

## Relevant Files
- Calendar sync API: `app/api/calendar/sync/route.ts`
- Week sync messaging: `components/week-grid.tsx`
- Admin projects UI: `app/admin/page.tsx`
- Trends rates fallback: `app/trends/page.tsx`
- Shared week data loader fallbacks: `lib/supabase/week.ts`
- Visual background system: `app/globals.css`, `components/app-shell.tsx`, `components/auth-gate.tsx`

## DB Notes
If not already applied in Supabase, these columns are expected by newer rate features:
```sql
alter table public.clients add column if not exists hourly_rate_cents integer;
alter table public.projects add column if not exists hourly_rate_cents integer;
```

## Product Direction Reminder
- This is a personal + professional optimization tool.
- Priority is low-friction daily use and clarity, not accounting rigidity.
