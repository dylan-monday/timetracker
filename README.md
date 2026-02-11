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
4. Restrict sign-in to `@mondayandpartners.com` and set `dylan@mondayandpartners.com` as admin role after first login.

## Email jobs
- Daily reminder at 4:00 PM local user time with deep link to app.
- Weekly recap every Friday at 5:00 PM local user time.

(Actual cron/edge function wiring is next implementation step.)
