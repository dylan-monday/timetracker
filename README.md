# Monday + Partners Time Tracker

A premium, pared-back time tracker built for creative work.

## Product direction
- Cursor-inspired light interface (not stark white)
- Fast weekly grid entry (rows: client/project, columns: days)
- Human input parsing (`1.5`, `1h 30m`, `90m`) with 15-minute rounding
- Weekend collapsed by default
- Missing-time visualization for 8am-5pm window
- Calendar events imported as drafts that require approval
- Admin mode in-app for clients/projects/forward-only merge events
- Trends by week/month/quarter/year
- Loose budget pulse (`hours * hourly rate` vs project budget)

## Stack
- Next.js + TypeScript + Tailwind (Vercel deploy)
- Supabase (Google auth, Postgres, RLS)
- Resend for reminder and recap emails

## Local setup
1. Install dependencies
   ```bash
   npm install
   ```
2. Copy env file
   ```bash
   cp .env.example .env.local
   ```
3. Fill in environment values in `.env.local`
4. Run dev server
   ```bash
   npm run dev
   ```

## Supabase
1. Create a Supabase project.
2. Run the SQL in `/supabase/schema.sql`.
3. Configure Google OAuth in Supabase Auth.
4. Set app redirect URL to your local and production URLs.
5. Sign in once with `dylan@mondayandpartners.com` so profile is created by trigger.
6. Run bootstrap helper SQL:
   ```sql
   select public.create_default_internal_clients('<OWNER_UUID>');
   ```
   Use your `profiles.id` as `OWNER_UUID`.

## Email jobs
- Daily reminder at 4:00 PM local user time with deep link to app.
- Weekly recap every Friday at 5:00 PM local user time.
- API endpoints:
  - `POST /api/cron/daily-reminder`
  - `POST /api/cron/weekly-recap`
  - Header required: `x-cron-secret: <CRON_SECRET>`

## Current implementation status
- Auth gate with Google sign-in UI and domain check
- Supabase-backed week grid reads/writes manual entries
- Admin CRUD for clients/projects + forward-only merge RPC
- Trends page wired to approved entry aggregates

## Suggested Vercel Cron setup
1. Add `CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`, and Supabase env vars in Vercel.
2. Configure Vercel cron jobs to call:
   - weekday 4:00 PM local: `/api/cron/daily-reminder`
   - Friday 5:00 PM local: `/api/cron/weekly-recap`
3. Send `x-cron-secret` header from cron invocations.

(Calendar ingest/approval backend is the next implementation step.)
