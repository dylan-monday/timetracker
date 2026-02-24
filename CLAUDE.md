# M+P Time Tracker - Project Context

## Quick Reference

**Stack**: Next.js 15 (App Router) + TypeScript + Tailwind + Supabase + Vercel
**Production**: https://time.mondayandpartners.com
**Repo**: https://github.com/dylan-monday/timetracker.git

## What This App Does

A premium, lightweight time tracker for Monday + Partners (currently single user: Dylan). Not accounting software - it's a personal instrument for tracking where time goes and understanding its value.

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

4. **Settings** (`/admin`) - Management
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
| Calendar sync API | `app/api/calendar/sync/route.ts` |
| Types | `lib/types.ts` |
| DB schema | `supabase/schema.sql` |

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
- Distinct pitches per nav destination (Week=G3, Trends=C4, Settings=F3)
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

## Known Limitations

1. **Mobile animation**: Background gradient doesn't animate on iOS Safari (static fallback is fine)
2. **Mobile sounds**: Disabled entirely - AudioContext unlock too unreliable
3. **Single user**: Currently designed for Dylan only, no multi-tenancy

## Recent Work (Feb 2026)

- Week navigation: view/edit any past week via prev/next arrows
- URL-based week state (`?start=YYYY-MM-DD`)
- Date format shows month: "Tue 2/24" not "Tue 24"
- Animated gradient logo using CSS mask
- Row order syncs to Supabase for cross-device persistence
- Contextual greetings based on time of day and user name
- Crystalline bell sounds for UI feedback (desktop only)

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
