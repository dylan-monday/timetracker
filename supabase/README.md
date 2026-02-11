# Supabase Notes

## Schema
Run `/supabase/schema.sql` in the SQL editor.

## Auth
- Provider: Google
- Allowed domain: `mondayandpartners.com`
- Admin bootstrap: set `dylan@mondayandpartners.com` role to `admin` in `public.profiles`
- Profile rows are auto-created by trigger on `auth.users`

## Merge behavior
Use `public.apply_project_merge(owner_id, source_project_id, target_project_id, effective_date)`
for forward-only merges without rewriting historical entries before effective date.

## Reminder/recap jobs
`public.email_jobs` provides idempotency tracking for scheduled sends.
A Supabase scheduled function (or external scheduler) should enqueue:
- Daily at 4:00 PM local timezone: `job_kind = 'daily_reminder'`
- Friday at 5:00 PM local timezone: `job_kind = 'weekly_recap'`

## First-login bootstrap
After first login, run:
```sql
select public.create_default_internal_clients('<OWNER_UUID>');
```
