# M+P Time Tracker - Project Spec

## 1) Product Summary

M+P Time Tracker is a lightweight, premium-feeling time app for a single creative operator (currently Dylan) at Monday + Partners.

Core intent:
- Capture time quickly in a weekly canvas.
- Reduce admin drag (not traditional accounting UX).
- Turn raw time into useful trend/value signals.
- Blend professional and personal time-awareness.

Current UX direction:
- Cursor-inspired, light but not stark white.
- High usability on mobile.
- Human language over accounting language.

---

## 2) What the App Does

### Week View (primary workflow)
- Shows one-week grid (Mon-Sun optional; weekdays default).
- Rows are project lines (each project belongs to one client).
- Cells store rounded minutes per day (15-minute increments).
- Manual input accepts shorthand (`1.5`, `1h 30m`, `90m`).
- Quick Add line supports:
  - selecting existing client + project
  - creating new client/project inline
  - free-text tags with autocomplete from prior tags
- Line delete supports confirmation.
- Week line pinning allows showing active lines even before entries are added.
- Mobile day navigator supports:
  - relative labels (`Today`, `Yesterday`, `Tomorrow`)
  - swipe left/right day switching
- Time entry feedback:
  - iOS keyboard dismisses immediately on Done tap
  - Visual save confirmation (green checkmark) appears briefly after successful entry
  - Works identically on mobile and desktop
- Today column visual distinction:
  - Today's column has a subtle warm amber tint
  - Past days appear slightly muted
  - Future days appear lighter/more open
- Time-based ambient background:
  - Background colors shift based on local time of day (morning/midday/afternoon/evening/night)
  - Gradients slowly drift position over 30-60 second cycles
  - Debug mode available via `?debug-bg=1` query param

### Calendar Drafts Inbox
- Calendar imports create `draft` entries, not auto-approved final entries.
- Drafts can be approved/reassigned/rejected inline.
- Mapping is required (or reject) in intended workflow.
- Imported calendar entries include event title and time range for review context.

### Admin (role-gated in same app)
- Add/archive clients.
- Add/archive projects.
- Rename projects.
- Set project budget and project hourly rate.
- Set user hourly rate and client-level hourly rates.
- Merge projects forward-only from an effective date.
- Manage calendar feed sources (iCal links) used for sync.

### Trends
- Range views: week/month/quarter/year.
- Totals: total, client work, internal, exercise.
- Project value estimates:
  - value = hours * effective rate
  - effective rate precedence: project rate -> client rate -> user rate
- Budget tracking (when budget exists): burn + remaining.

### Email Jobs
- Daily reminder email: "Do your time".
- Weekly recap email: summary totals and trends link.

---

## 3) Data + Rules

### Key entities
- `profiles` (role, timezone, hourly rate)
- `clients` (external/internal, optional hourly rate)
- `projects` (belongs to client, optional budget/rate, archivable, merge target)
- `time_entries` (manual/calendar, draft/approved/rejected, rounded 15m)
- `calendar_feed_sources` (owner-managed iCal URLs)
- `calendar_events` (raw imported event records)
- `project_merge_events` (forward-only remapping history)
- `email_jobs` (cron send tracking)

### Important business rules
- Allowed auth domain: `@mondayandpartners.com`.
- Admin default: `dylan@mondayandpartners.com` (also enforced in app fallback).
- Rounding: nearest 15 minutes.
- Missing-time logic uses 8:00-17:00 daily window for signal, not punitive accounting.
- Project merge is forward-only from effective date.

---

## 4) Architecture

- Framework: Next.js (App Router) + React + TypeScript + Tailwind.
- DB/Auth: Supabase (Postgres + RLS + Google OAuth via Supabase Auth).
- Email: Resend.
- Hosting: Vercel (production at `time.mondayandpartners.com`).

Important routes:
- `/week` - week grid + calendar drafts
- `/trends` - time/value summaries
- `/admin` - role-gated management
- `POST /api/calendar/sync` - imports from active iCal feed sources
- `POST /api/cron/daily-reminder`
- `POST /api/cron/weekly-recap`

---

## 5) Environment Variables (Required)

Set these in local `.env.local` and Vercel project envs:

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser auth/data access key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-side admin access for API routes |
| `RESEND_API_KEY` | Yes (email features) | Send reminder/recap emails |
| `APP_URL` | Yes | Canonical app URL used in emails |
| `EMAIL_FROM` | Yes | Sender name/email for emails |
| `CRON_SECRET` | Yes (manual cron auth) | Protect cron endpoints when not using native Vercel cron header |
| `GOOGLE_CLIENT_ID` | Optional in app runtime | Needed in Supabase Google provider setup; not directly consumed by app code |
| `GOOGLE_CLIENT_SECRET` | Optional in app runtime | Needed in Supabase Google provider setup; not directly consumed by app code |

Notes:
- Never commit secret values to git.
- `GOOGLE_CLIENT_ID/SECRET` are operationally required for Google auth in Supabase, even though this codebase does not directly read them at runtime.

---

## 6) Login IDs, Ownership, and Non-Secret Identifiers

### App/Auth
- Allowed user domain: `mondayandpartners.com`
- Current admin user: `dylan@mondayandpartners.com`

### Source control
- GitHub repo: `https://github.com/dylan-monday/timetracker.git`
- GitHub owner account: `dylan-monday`

### Supabase (current project)
- Project ID: `idmnhovgngwdnbnisbdp`
- Project URL: `https://idmnhovgngwdnbnisbdp.supabase.co`
- Public key id in use: publishable key (configured outside repo)

### Google OAuth (current client id)
- OAuth Client ID: `585212971170-nrs4sip2jma5ro7vqa9ge0iarfp2q91v.apps.googleusercontent.com`

### Deployment
- Vercel project: `timetracker`
- Production domain: `https://time.mondayandpartners.com`

---

## 7) Setup Flow (Clean Install)

1. Clone and install:
   - `npm install`
2. Create `.env.local` from `.env.example`.
3. Provision Supabase project and run:
   - `supabase/schema.sql`
4. Configure Supabase Google provider:
   - enable Google
   - add Google client ID + secret
   - callback URL from Supabase copied into Google OAuth client
   - allowed redirects include local and production URLs
5. Sign in once with `dylan@mondayandpartners.com` (creates profile via trigger).
6. Bootstrap defaults:
   - `select public.create_default_internal_clients('<OWNER_UUID>');`
7. Add required env vars in Vercel.
8. Configure cron jobs (or external scheduler) for:
   - daily reminder at 4:00 PM
   - weekly recap Friday at 5:00 PM
9. In Admin -> Calendar Sources, add active iCal feed URLs for desired calendars.

---

## 8) Current Known Issues / Watchlist

- Calendar sync quality depends on clean feed sources and mapping workflow; noisy shared calendars can still require filtering decisions.

---

## 9) Operational Notes

- `Sync` in week view = refreshes week data from DB only.
- `Sync calendars` = runs calendar import pipeline.
- Calendar imports are draft-first by design to preserve user control.
- If schema drift occurs (older DB), app includes fallback handling for missing rate columns in some queries.

