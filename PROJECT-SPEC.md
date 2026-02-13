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
- Warm, sophisticated color palette.

---

## 2) What the App Does

### Week View (primary workflow)
- Shows one-week grid (Mon-Sun optional; weekdays default).
- Rows are project lines (each project belongs to one client).
- Cells store rounded minutes per day (15-minute increments).
- Manual input accepts shorthand (`1.5`, `1h 30m`, `90m`).
- **Draggable rows**: Entire rows can be dragged to reorder. Order persists in localStorage.
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
- **Category color coding**: 3px left border on each row indicates category:
  - Teal (#2d8a7b) = External client work
  - Amber (#b8956a) = Internal investment
  - Rose (#c47a7a) = Personal time
- Time-based ambient background:
  - Background colors shift based on local time of day (morning/midday/afternoon/evening/night)
  - Gradients slowly drift position over 30-60 second cycles
  - Debug mode available via `?debug-bg=1` query param

### Calendar Drafts Inbox
- Calendar imports create `draft` entries, not auto-approved final entries.
- Drafts can be approved/reassigned/rejected inline.
- Mapping is required (or reject) in intended workflow.
- Imported calendar entries include event title and time range for review context.

### Settings (role-gated in same app)
- Add/archive clients.
- Add/archive projects.
- Rename projects.
- Set project budget and project hourly rate.
- Set user hourly rate and client-level hourly rates.
- Merge projects forward-only from an effective date.
- Manage calendar feed sources (iCal links) used for sync.

### Trends
- Range views: week/month/quarter/year.
- **Period navigation**: Navigate to past periods with prev/next arrows and keyboard shortcuts.
- Summary cards: Total, Client delivery, Internal investment, Personal.
- **Sparklines**: 8-period trend charts under each summary card.
- **Period comparisons**: Neutral indicators (↑/↓/—) showing change vs previous period.
- **Editorial narrative card**: Dark warm background (#2d2a26) with structured content:
  - Line 1 (headline, 20px): Dominant category statement
  - Line 2 (detail, 15px): Top 2 clients/projects with hours
  - Line 3 (personal, 15px, rose accent): Personal time with dollar value
  - Line 4 (metadata, 13px): Internal work and total hours
- Project breakdown with category color coding.
- Project value estimates:
  - value = hours * effective rate
  - effective rate precedence: project rate -> client rate -> user rate
- Budget tracking (when budget exists): burn + remaining.

### Footer Messages
- Rotating motivational/philosophical messages about time and work.
- Mix of product-voice statements (no attribution) and quotes with attribution.
- Source file: `content/footer-messages.md` and `lib/footer-messages.ts`.
- Changes daily based on date seed.

### Email Jobs
- Daily reminder email: "Quick snapshot of your [day name]".
- Weekly recap email: "Your week, wrapped" with summary totals.

---

## 3) Design System

### Typography
- **Display font**: Instrument Serif (page titles: "Your Week", "Trends", "Settings")
- **Body font**: Instrument Sans (400, 500, 600 weights)
- Font weights reduced by one step throughout (semibold → medium)

### Color Palette (Warm)
| Token | Value | Usage |
|-------|-------|-------|
| `canvas` | #f5f6f3 | Page background |
| `panel` | #fbfcf9 | Card backgrounds |
| `ink` | #1a1815 | Primary text (warm near-black) |
| `muted` | #6b6560 | Secondary text (warm gray) |
| `subtle` | #a39e98 | Tertiary text (warm light gray) |
| `border` | #e8e4df | Borders (warm) |
| `accent` | #84e178 | Success/positive |
| `accentStrong` | #58c857 | Strong success |
| `warning` | #f4c760 | Warning states |
| `danger` | #f07b7b | Error/danger |

### Category Colors (CSS Variables)
| Variable | Value | Usage |
|----------|-------|-------|
| `--color-client` | #2d8a7b | External client work |
| `--color-internal` | #b8956a | Internal investment |
| `--color-personal` | #c47a7a | Personal time |

### Daily Total Pills
Hours-based color gradation (no text labels):
- 8+ hours: Green border/background with saturated green text (#2d7a3d)
- 6-8 hours: Lighter green tint
- 4-6 hours: Neutral gray
- 0-4 hours: Very light/transparent

---

## 4) Data + Rules

### Key entities
- `profiles` (role, timezone, hourly rate)
- `clients` (external/internal, optional hourly rate)
- `projects` (belongs to client, optional budget/rate, archivable, merge target)
- `time_entries` (manual/calendar, draft/approved/rejected, rounded 15m)
- `calendar_feed_sources` (owner-managed iCal URLs)
- `calendar_events` (raw imported event records)
- `project_merge_events` (forward-only remapping history)
- `email_jobs` (cron send tracking)

### Default Personal Projects
Created via `create_default_internal_clients()`:
- Thinking & Strategy
- Recharging
- Exercise
- Personal Development
- Reading

### Important business rules
- Allowed auth domain: `@mondayandpartners.com`.
- Admin default: `dylan@mondayandpartners.com` (also enforced in app fallback).
- Rounding: nearest 15 minutes.
- Project merge is forward-only from effective date.

---

## 5) Architecture

- Framework: Next.js (App Router) + React + TypeScript + Tailwind.
- DB/Auth: Supabase (Postgres + RLS + Google OAuth via Supabase Auth).
- Email: Resend.
- Hosting: Vercel (production at `time.mondayandpartners.com`).

Important routes:
- `/week` - week grid + calendar drafts
- `/trends` - time/value summaries
- `/admin` - role-gated management (labeled "Settings" in UI)
- `POST /api/calendar/sync` - imports from active iCal feed sources
- `POST /api/cron/daily-reminder`
- `POST /api/cron/weekly-recap`

---

## 6) Environment Variables (Required)

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

## 7) Login IDs, Ownership, and Non-Secret Identifiers

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

## 8) Setup Flow (Clean Install)

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

## 9) Backlog

### Week Navigation
- Allow navigating to previous/future weeks to view and edit historical data
- Complexity: Moderate (2-3 hours)
- Pattern already exists in Trends page (`periodOffset` state)
- Would require: offset state, updated `makeWeekDays()`, prev/next buttons

### Calendar Drafts Workflow
- Ensure nothing remains unmapped
- Required state: each draft must be either mapped to a valid project, or rejected
- No "unmapped skipped" end-state in normal usage

---

## 10) Operational Notes

- `Sync` in week view = refreshes week data from DB only.
- `Sync calendars` = runs calendar import pipeline.
- Calendar imports are draft-first by design to preserve user control.
- If schema drift occurs (older DB), app includes fallback handling for missing rate columns in some queries.

---

## 11) Key Files Reference

| Area | Files |
|------|-------|
| Week grid (mobile + desktop) | `components/week-grid.tsx` |
| Trends page | `app/trends/page.tsx` |
| Settings/Admin | `app/admin/page.tsx` |
| App shell + nav | `components/app-shell.tsx` |
| Auth gate | `components/auth-gate.tsx` |
| Ambient background | `components/ambient-motion.tsx` |
| Footer messages | `lib/footer-messages.ts`, `content/footer-messages.md` |
| Color/typography config | `tailwind.config.ts`, `app/globals.css` |
| Font setup | `app/layout.tsx` |
| Calendar sync API | `app/api/calendar/sync/route.ts` |
| Email templates | `lib/server/email-templates.ts` |
| Week data fetching | `lib/supabase/week.ts` |
| Types | `lib/types.ts` |
