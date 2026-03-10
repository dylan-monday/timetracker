# M+P Time Tracker - Project Context

## Quick Reference

**Stack**: Next.js 15 (App Router) + TypeScript + Tailwind + Supabase + Vercel
**Production**: https://time.mondayandpartners.com
**Repo**: https://github.com/dylan-monday/timetracker.git

## What This App Is

A personal instrument for understanding where time goes and what it's worth. Built for Dylan at Monday + Partners. Not accounting software, not a timesheet, not a productivity tool in the conventional sense.

The core idea: honest awareness of how you spend your attention creates better decisions about how to spend it next. Time tracking is the input. Self-knowledge is the output.

### Core Workflows

1. **Week View** (`/week`) - Primary interface
   - 7-day grid (Mon-Sun, weekends hidden by default)
   - Rows = projects (each belongs to a client)
   - Cells = rounded minutes (15-min increments)
   - Input accepts: `1.5`, `1h 30m`, `90m`
   - Draggable rows (order persists to Supabase `profiles.line_order`)
   - **Week navigation**: Prev/next arrows to view/edit any past week
   - URL-based state: `/week?start=YYYY-MM-DD`
   - Visual indicator (amber border) when viewing non-current week

2. **Calendar Drafts** - Imported events require approval
   - `Sync calendars` button imports from iCal feeds
   - Drafts can be approved, reassigned to different project, or rejected

3. **Trends** (`/trends`) - Analytics
   - Week/month/quarter/year views with period navigation
   - Summary cards with sparklines
   - Project value = hours × effective rate
   - Budget tracking when budget exists

4. **Estimates** (`/estimates`) - Project Fee Proposals
   - Build project fee estimates before client proposals
   - Phases (Immersion, Concept Development, Creative Development, Production, Post Production)
   - Line items per phase: Role + Person (optional) + Hours + Rate
   - Hard costs section (pass-through, no markup)
   - Markup % (default 15%) + Contingency % (default 10%)
   - Status flow: Draft → Live → Archived
   - When Live: link to project, track actual hours vs estimated hours
   - Owner-only feature (future employees won't see estimates)

5. **Settings** (`/admin`) - Management
   - Clients (external/internal), projects, rates, budgets
   - Calendar feed sources (iCal URLs)
   - Project merge (forward-only from effective date)

## Key Files

| Purpose | File |
|---------|------|
| Week grid | `components/week-grid.tsx` |
| Week data/API | `lib/supabase/week.ts` |
| App shell + nav | `components/app-shell.tsx` |
| Ambient background | `components/ambient-motion.tsx` |
| Animated logo | `components/logo-gradient.tsx` |
| Contextual greetings | `lib/greeting.ts` |
| UI sounds | `lib/sounds.ts` |
| Week date helper | `lib/mock-data.ts` → `makeWeekDays(reference)` |
| Time parsing | `lib/time.ts` |
| Trends page | `app/trends/page.tsx` |
| Admin/Settings | `app/admin/page.tsx` |
| Estimates list | `app/estimates/page.tsx` |
| Estimate builder | `app/estimates/[id]/page.tsx` |
| Estimates data/API | `lib/supabase/estimates.ts` |
| Calendar sync API | `app/api/calendar/sync/route.ts` |
| Types | `lib/types.ts` |
| DB schema | `supabase/schema.sql` |
| Estimates migration | `supabase/migrations/2026-03-10_add_estimates.sql` |

## Design System

### Typography
- **Display**: Instrument Serif (titles)
- **Body**: Instrument Sans (400, 500, 600)

### Colors
| Token | Value | Usage |
|-------|-------|-------|
| `canvas` | #f5f6f3 | Page background |
| `panel` | #fbfcf9 | Card backgrounds |
| `ink` | #1a1815 | Primary text |
| `muted` | #6b6560 | Secondary text |

### Category Colors (3px left border on rows)
| Category | Color | Variable |
|----------|-------|----------|
| External client | Teal #2d8a7b | `--color-client` |
| Internal work | Amber #b8956a | `--color-internal` |
| Personal | Rose #c47a7a | `--color-personal` |

## Ambient Background System

Time-based CSS radial-gradients (NO blur filter - that kills visibility).

| Period | Hours | Mood |
|--------|-------|------|
| Morning | 6-11am | Soft blues, teals |
| Midday | 11am-2pm | Warm whites, subtle golds |
| Afternoon | 2-5pm | Soft amber, warm gray |
| Evening | 5-9pm | Peach, dusty rose |
| Night | 9pm-6am | Blue-gray, slate |

- Gradient positions drift via `requestAnimationFrame` (30-60s cycles)
- Colors update every 30 seconds
- `?debug-bg=1` shows full 24-hour cycle in 60 seconds
- Respects `prefers-reduced-motion`

**Logo** (`components/logo-gradient.tsx`): Same gradient system, uses CSS `mask-image` with the M+P SVG so gradient shows through logo shape.

## UI Sounds

Web Audio API synthesized bells (no audio files). Source: `lib/sounds.ts`

- Warm, Frosti-inspired crystalline tones
- Detuned oscillator pairs for organic shimmer
- Distinct pitches per nav destination:
  - Week: G3 (196 Hz) - grounded, present
  - Trends: C4 (262 Hz) - reflective
  - Settings: F3 (175 Hz) - neutral
  - Estimates: Bb3 (233 Hz) - aspirational
  - Open Estimate: Eb4 (311 Hz) - anticipatory
- Desktop only (mobile AudioContext restrictions too unreliable)

## Data Model (Supabase)

Key tables:
- `profiles` - user settings, `line_order` (text[] for row ordering)
- `clients` - external/internal, optional hourly_rate_cents
- `projects` - belongs to client, optional budget/rate
- `time_entries` - manual/calendar source, draft/approved/rejected status
- `calendar_feed_sources` - iCal URLs per user
- `calendar_events` - raw imported events

Business rules:
- Allowed auth domain: `@mondayandpartners.com`
- Admin: `dylan@mondayandpartners.com`
- Time rounding: nearest 15 minutes
- Manual entry overwrites all existing entries for that project/day

## Environment Variables

Required in `.env.local` and Vercel:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
APP_URL
EMAIL_FROM
CRON_SECRET
```

## Security

**Strengths:**
- All tables have RLS policies restricting access to `owner_id = auth.uid()`
- Domain restriction enforced at DB level (`@mondayandpartners.com` only)
- No SQL injection risks (parameterized queries via Supabase client)
- CRON endpoints protected by `x-vercel-cron` header or `CRON_SECRET`
- Service role key never exposed to client

**Known gaps (low risk for single-user):**
- Admin check is client-side only (RLS still protects data)
- No rate limiting on API routes
- Calendar feed URL validation is basic (https:// only)

## Performance

- Database indexes on frequently queried columns (see `supabase/schema.sql`)
- Optimistic UI updates for time entries
- `useMemo` for expensive calculations (`totalsByDay`, `filteredProjects`, etc.)
- Parallel data fetching with `Promise.all`
- Ref pattern for `pinnedProjectIds` to avoid unnecessary re-renders

## Known Limitations

1. **Mobile animation**: Background gradient doesn't animate on iOS Safari (static fallback is fine)
2. **Mobile sounds**: Disabled entirely - AudioContext unlock too unreliable
3. **Single user**: Currently designed for Dylan only, no multi-tenancy
4. **Admin UI**: Client-side check only (add server middleware if multi-user)

## Known Issues

- `week-grid.tsx` is large (~1500 lines) - could be split into smaller components
- N+1 query pattern in `lib/server/time-report.ts` (email reports) - acceptable for single user
- Calendar drafts: unmapped events are skipped during sync, not forced to be mapped or rejected
- "Copy last week" button exists in UI but is not wired up

## To-Do

### Technical Debt
- [ ] **Standardize styles/stylesheet across all pages** - Extract common input styles to shared component or Tailwind @apply classes
- [ ] Add archive functionality for live estimates
- [ ] Split `week-grid.tsx` (~1500 lines) into smaller components

### Human Experience (Priority)
- [ ] **Make it more rewarding to use** - Think deeply about the emotional experience of tracking time
- [ ] Celebration moments - What happens when you complete a week? Hit a milestone?
- [ ] Gentle encouragement - How does the app respond when tracking is sparse?
- [ ] Meaningful summaries - Not just numbers, but insights that feel valuable
- [ ] Consider weekly rituals - What makes the end-of-week feel like closure?
- [ ] Sound design refinement - Are the current bells satisfying? What else could benefit from audio feedback?

### Future Features
- [ ] Weekly reflection prompts tied to actual data
- [ ] Goal tracking against time ("I want 20% on personal development")
- [ ] Per-role budget tracking (not just total project hours)

---

## Session Notes: March 10, 2026

### What We Built Today

**Budget Check Overhaul**
- Changed from period-filtered to **all-time hours tracking** (fixed LED Recruiting bug)
- Added **per-person breakdown** showing each person's hours, value, and percentage
- Made Budget Check **admin-only** (hidden for non-admin users)
- **Hours-based display**: Budget XXh → Xh logged (X%) → Xh left
- Red progress bar when over budget
- Fallback to estimate data for projects created before budget sync code

**Estimate → Project Budget Sync**
- When estimate goes live, project now gets both `budget_cents` AND `hourly_rate_cents`
- Hourly rate calculated as blended rate: `laborPlusContingencyCents / totalEstimatedHours`
- Projects linked to estimates now appear in Budget Check even without direct budget_cents

**UI Polish**
- Estimate form inputs now use **hover-visible borders** (matches timesheet aesthetic)
- Cleaner, less cluttered look when not actively editing

### Challenges Encountered

1. **Budget Check wasn't showing live estimates** - The query filtered for `budget_cents > 0`, but projects created before the sync code didn't have budgets set. Fixed by also fetching live estimates and calculating budget from estimate data.

2. **Thinking through what Budget Check should actually show** - Required stepping back to clarify: hours vs dollars, per-person vs total, current period vs all-time. The conversation led to a clearer design.

3. **Data model gaps** - Per-person hour budgets aren't stored when estimate goes live. Currently only total budget syncs. Role-level tracking would require storing more estimate data on the project.

### Key Learnings

- **Budget tracking is hours-first, dollars-second** for time tracking purposes. You control hours; dollars are the outcome.
- **All-time vs period tracking** serves different purposes. Budget tracking needs cumulative view; period analytics need filtered view.
- **Linked estimates provide fallback data** - Don't just sync at go-live; use the estimate as a source of truth when project data is incomplete.

### Design Decisions Made

| Decision | Rationale |
|----------|-----------|
| Budget Check is admin-only | Standard users shouldn't see budget burn rates |
| All-time hours for budget | Budgets don't reset per period |
| Calculate budget from estimate if not on project | Backward compatibility for existing data |
| Hover-visible inputs on estimates | Matches timesheet, reduces visual clutter |

### What's Next: The Human Side

The mechanics work. Now the question is: **how do we make this feel good to use?**

Ideas to explore:
- **Completion sounds** - What plays when you finish a day? A week?
- **Milestone moments** - "You've logged 1,000 hours this year"
- **Gentle nudges** - Empty timesheets shouldn't feel punishing
- **Visual rewards** - Can the ambient background respond to your tracking?
- **Weekly ritual** - What makes Friday afternoon feel like closure?
- **Gratitude** - The app should feel like it appreciates your attention

The goal: transform time tracking from obligation to self-care ritual.

---

## Recent Changes (March 2026)

### Budget Check Overhaul (March 10)
- All-time hours tracking (not period-filtered)
- Per-person breakdown with hours, value, and percentage
- Admin-only visibility
- Hours-based display with value invested
- Fallback to estimate calculations for backward compatibility

### Estimate → Project Sync (March 10)
- Go Live now sets `budget_cents` AND `hourly_rate_cents` on project
- Blended hourly rate calculated from estimate labor costs / hours

### Estimates Feature - Complete Implementation
- **Database**: Added `estimates`, `estimate_phases`, `estimate_line_items`, `estimate_hard_costs`, `agency_roles` tables
- **Client relationship**: Estimates tied to clients (not projects) since these are new work
- **Go Live flow**: Creates project automatically when estimate status → live
- **Tracking**: Owner can see actual hours vs estimated hours for live estimates

### Estimates UI Polish
- Phase names use ComboBox with preset options (Immersion, Concept Development, etc.)
- Person field uses ComboBox pulling from profiles table (auto-fills rate)
- All number inputs use monospace font (IBM Plex Mono)
- Hours/rate columns are compact, more space for role/person
- Hover-visible input borders (matches timesheet aesthetic)
- Auto-save on name and client fields (no manual Save click needed)
- New estimates start blank (no default phases, empty name)

### Sounds
- Added `openEstimate` sound (Eb4 / 311 Hz) - plays when clicking an estimate card
- Added `navEstimates` sound (Bb3 / 233 Hz) - plays on nav to estimates
- Added `timeEntry` sound with ±1.5 semitone variation for organic feel

### Bug Fixes
- Fixed markup/contingency not persisting when set to 0 (was treating 0 as falsy)
- Fixed Budget Check not showing projects from older estimates

## Where This Can Go

The time tracker works. The question now is what it becomes. The foundation supports something more ambitious than a weekly grid.

### Personal Value Intelligence
- **Effective rate trends**: Not just "hours worked" but "what was an hour of my time worth this month vs last?"
- **Energy mapping**: Which projects/clients correlate with high-output weeks vs draining ones?
- **Portfolio balance**: Am I investing enough in internal/personal work, or am I fully reactive to client demands?

### Reflection & Development
- **Weekly reflection prompts**: End-of-week questions tied to the data ("You spent 12h on X this week. Was that intentional?")
- **Goal tracking against time**: "I want to spend 20% on personal development" - am I actually doing it?
- **Narrative journaling**: Brief notes attached to weeks/days, not just hours
- **Patterns over time**: Surface recurring patterns ("You always undertrack Fridays", "Q1 is always client-heavy")

### Smarter Automation
- **Calendar-to-project learning**: After enough approvals, suggest mappings automatically
- **Weekly email that tells a story**: Not just hours, but insights ("Your client mix shifted this month")
- **Anomaly detection**: Flag weeks that look unusual compared to your baseline

### The Bigger Picture
This could become a personal operating system for a solo practitioner - the place where you understand not just what you did, but whether what you did aligns with who you want to be professionally. Time is the raw data. The value is in the reflection.

## Development

```bash
npm install
npm run dev      # localhost:3000
npm run build    # production build
npx tsc --noEmit # type check
```

Deploy: Push to main → Vercel auto-deploys

## Supabase Project

- Project ID: `idmnhovgngwdnbnisbdp`
- URL: `https://idmnhovgngwdnbnisbdp.supabase.co`
