# Monday + Partners Time Tracker

A personal instrument for tracking where time goes and understanding its value. Built for creative work at Monday + Partners.

## What it does

- **Weekly grid**: Rows are projects, columns are days. Input accepts `1.5`, `1h 30m`, `90m` with 15-minute rounding.
- **Calendar sync**: Import events from iCal feeds as drafts, then approve, reassign, or reject them.
- **Trends**: Week/month/quarter/year analytics with sparklines, effective rates, and budget tracking.
- **Settings**: Manage clients, projects, rates, budgets, and calendar feeds.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind
- Supabase (Google auth, Postgres, RLS)
- Vercel (auto-deploy from main)
- Resend for reminder and recap emails

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev                   # localhost:3000
```

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
APP_URL
EMAIL_FROM
CRON_SECRET
```

## Supabase setup

1. Create a Supabase project
2. Run `/supabase/schema.sql`
3. Configure Google OAuth in Supabase Auth
4. Set redirect URLs for local and production
5. Sign in with `dylan@mondayandpartners.com` to create the profile
6. Run bootstrap: `select public.create_default_internal_clients('<OWNER_UUID>');`

## Email jobs

- Daily reminder: weekdays at 4 PM local (`POST /api/cron/daily-reminder`)
- Weekly recap: Fridays at 5 PM local (`POST /api/cron/weekly-recap`)
- Protected by `x-cron-secret` header

## Deploy

Push to `main`. Vercel handles the rest.
