# Project Fee Estimator

**Status**: Phase 1 & 2 Complete
**Author**: Dylan + Claude
**Created**: 2025-03-09
**Implemented**: 2026-03-10

## Overview

A project fee estimation tool that serves two purposes:
1. **Proposal building**: Noodle on project costs before sending to clients
2. **Tracking against estimates**: Once approved, compare actual time to what was estimated

This is an owner-only feature. Future employees will track time without seeing estimates or project economics.

---

## Philosophy

The estimator is a **thinking tool**, not a contract. It helps answer:
- "What should I charge for this?"
- "Am I on track against what I thought this would take?"

It's not surveillance. Workers (future) won't be measured against estimates. They log time honestly. Estimate comparison is for project management awareness, not performance management.

### Privacy Principle (Critical for Multi-User Future)

**Individual timesheets are private** — that's the worker's business. But **project-level time is visible** for proper billing and client adjustments.

Tracking happens against **roles**, not people:
- "We estimated 40h of Design work; 52h was logged" — aggregate, not individual
- Owner sees role-level accuracy, not individual performance inspection
- This protects individuals while still giving project insight

This is the humanistic core: awareness for project management without surveillance of individuals.

---

## Core Concepts

### Estimate Structure

```
Estimate
├── Name (e.g., "Brand Campaign Q3")
├── Status: draft | live | archived
├── Phases (typically 1-5)
│   └── Phase (e.g., "Concept Development")
│       └── Line Items
│           └── Role + Person (optional) + Hours + Rate
│               e.g., "Creative Director, Dylan, 20h, $250/hr"
├── Hard Costs (line items, no markup)
├── Markup % (applied to labor subtotal, default 15%)
├── Contingency % (applied to labor + markup, default 10%)
└── Project Link (nullable, set when live)
```

### Default Phase Names

Seeded presets (adjustable per estimate):
1. Immersion
2. Concept Development
3. Creative Development
4. Production
5. Post Production

### Role + Person Model

- **Role/Title** (required): e.g., "Creative Director", "Designer", "Producer"
- **Person** (optional): e.g., "Dylan" — for now just text, future: pick from employee list
- **Hourly Rate**: Defaults from agency role settings, adjustable per estimate

Future enhancement: When selecting a person from the employee list, their title and default rate auto-fill but remain adjustable for that specific estimate.

### Calculation

```
Labor Subtotal     = Σ (hours × rate) across all phases
Labor + Markup     = Labor Subtotal × (1 + markup%)
Contingency        = (Labor + Markup) × contingency%
Hard Costs         = Σ all hard cost line items

─────────────────────────────────────────────────────
Project Total      = Labor + Markup + Contingency + Hard Costs
```

Markup applies to labor only. Contingency is a buffer on the labor portion. Hard costs pass through at cost.

### Status Flow

```
┌─────────┐     ┌─────────┐     ┌──────────┐
│  Draft  │ ──► │  Live   │ ──► │ Archived │
└─────────┘     └─────────┘     └──────────┘
    │               │
    │ (editing)     │ (tracking against actuals)
    │               │
    └── Send to client outside system
        Client approves
        Change to Live ──► Creates/links project
```

**Draft**: Work in progress, editable, not yet sent to client
**Live**: Client approved, linked to project, tracking against actuals
**Archived**: Project complete or estimate abandoned

---

## Data Model

### New Tables

```sql
-- Estimates (the container)
create table estimates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'live', 'archived')),
  project_id uuid references projects(id) on delete set null,
  markup_percent numeric(5,2) not null default 15.00,
  contingency_percent numeric(5,2) not null default 10.00,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Phases within an estimate
create table estimate_phases (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid references estimates(id) on delete cascade not null,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

-- Personnel/role line items within phases
create table estimate_line_items (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid references estimate_phases(id) on delete cascade not null,
  role_name text not null, -- e.g., "Creative Director", "Designer"
  person_name text, -- optional, e.g., "Dylan" (text for now)
  person_id uuid references auth.users(id) on delete set null, -- future: link to actual user
  hours numeric(8,2) not null default 0,
  hourly_rate_cents integer not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

-- Hard costs (not subject to markup)
create table estimate_hard_costs (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid references estimates(id) on delete cascade not null,
  description text not null,
  amount_cents integer not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

-- Agency default rates (prepopulate estimates)
create table agency_roles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  default_hourly_rate_cents integer not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz default now(),
  unique(owner_id, name)
);
```

### RLS Policies

All tables get standard owner-only policies:
```sql
create policy "Users can manage own estimates"
  on estimates for all using (owner_id = auth.uid());
-- (repeat for all new tables)
```

### Indexes

```sql
create index idx_estimates_owner on estimates(owner_id);
create index idx_estimates_project on estimates(project_id);
create index idx_estimate_phases_estimate on estimate_phases(estimate_id);
create index idx_estimate_line_items_phase on estimate_line_items(phase_id);
create index idx_estimate_hard_costs_estimate on estimate_hard_costs(estimate_id);
```

---

## UI Design

### Navigation

Add "Estimates" to the app shell navigation:
- Week | Trends | **Estimates** | Settings

### Routes

- `/estimates` — List all estimates (cards with status badges)
- `/estimates/new` — Create new estimate
- `/estimates/[id]` — Edit estimate / view tracking (when live)

### Estimate List Page (`/estimates`)

```
┌──────────────────────────────────────────────────────┐
│  Estimates                          [+ New Estimate] │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │ Brand Campaign Q3              [LIVE]       │    │
│  │ $24,500 · 3 phases · Linked to Project X    │    │
│  │ Created Jan 15                              │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │ Website Redesign               [DRAFT]      │    │
│  │ $18,200 · 2 phases                          │    │
│  │ Created Feb 3                               │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Estimate Builder (`/estimates/[id]`)

```
┌──────────────────────────────────────────────────────────────────┐
│  ← Back to Estimates                                             │
│                                                                  │
│  [Estimate Name Input_________________]     Status: [Draft ▾]    │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  PHASES                                                          │
│  ─────────────────────────────────────────────────               │
│                                                                  │
│  ┌ Concepting ──────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │  Role              Person      Hours    Rate      Total  │   │
│  │  ─────────────────────────────────────────────────────── │   │
│  │  [Creative Dir ▾]  [Dylan  ]   [20  ]   [$250]   $5,000 │   │
│  │  [Designer ▾    ]  [      ]   [10  ]   [$150]   $1,500 │   │
│  │  [+ Add line item]                                       │   │
│  │                                                          │   │
│  │                               Phase subtotal:   $6,500   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌ Production ──────────────────────────────────────────────┐   │
│  │  ...                                                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  [+ Add Phase]                                                   │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  HARD COSTS                                                      │
│  ─────────────────────────────────────────────────               │
│                                                                  │
│  Description                              Amount                 │
│  ───────────────────────────────────────────────────────────    │
│  [Stock footage_________________]         [$500_____]            │
│  [Print production______________]         [$2,000___]            │
│  [+ Add hard cost]                                               │
│                                                                  │
│                               Hard costs total:      $2,500      │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  SUMMARY                                                         │
│  ─────────────────────────────────────────────────               │
│                                                                  │
│  Labor subtotal                                      $12,000     │
│  Markup ([15__]%)                                    + $1,800    │
│  ───────────────────────────────────────────────────────────    │
│  Labor total                                         $13,800     │
│  Contingency ([10__]%)                              + $1,380     │
│  ───────────────────────────────────────────────────────────    │
│  Labor + contingency                                 $15,180     │
│  Hard costs                                         + $2,500     │
│  ═══════════════════════════════════════════════════════════    │
│  PROJECT TOTAL                                       $17,680     │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  Notes                                                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Assumes 2 rounds of revisions. Additional rounds at...   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│                                              [Save]  [Delete]    │
└──────────────────────────────────────────────────────────────────┘
```

### Live Estimate View (Tracking)

When status = "live" and linked to a project, show tracking section.

**For MVP (single user):** Show aggregate tracking for the whole estimate.

```
┌──────────────────────────────────────────────────────────────────┐
│  TRACKING AGAINST ESTIMATE                                       │
│  ─────────────────────────────────────────────────               │
│                                                                  │
│  Linked to: Brand Campaign Q3                                    │
│                                                                  │
│  My estimated hours:      45h                                    │
│  My actual hours:         38h                                    │
│  ───────────────────────────────────────────────────────────    │
│  Remaining:               7h (15%)                               │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ ████████████████████████████████████░░░░░░░░░░ 84%      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  My estimated value:      $11,250                                │
│  My actual value:         $9,500                                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**For future multi-user:** Owner sees role-level breakdown, not individual breakdown.

```
┌──────────────────────────────────────────────────────────────────┐
│  PROJECT TRACKING (Owner View)                                   │
│  ─────────────────────────────────────────────────               │
│                                                                  │
│  Role               Estimated    Actual      Variance            │
│  ───────────────────────────────────────────────────────────    │
│  Creative Director     45h        38h         -7h (under)        │
│  Designer              30h        35h         +5h (over)         │
│  Producer              20h        18h         -2h (under)        │
│  ───────────────────────────────────────────────────────────    │
│  Total                 95h        91h         -4h (under)        │
│                                                                  │
│  Estimated labor value:     $23,750                              │
│  Actual labor value:        $22,750                              │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

Note: Role-level tracking shows **aggregate hours per role**, not individual performance. Multiple people could fill a role; we sum their logged hours against the role's estimate. This is for project accuracy, not individual surveillance.

---

## Implementation Phases

### Phase 1: Foundation (MVP) - COMPLETE

**Database**
- [x] Create migration with new tables (estimates, phases, line items, hard costs)
- [x] Add RLS policies
- [x] Create agency_roles table with seed data

**Types**
- [x] Add TypeScript interfaces in `lib/types.ts`

**Data Layer**
- [x] Create `lib/supabase/estimates.ts` with CRUD operations

**UI: Estimate List**
- [x] Create `/estimates` page
- [x] List estimates as cards with status badges
- [x] "New Estimate" button

**UI: Estimate Builder**
- [x] Create `/estimates/[id]` page
- [x] Estimate name + status
- [x] Phases section with add/remove
- [x] Line items within phases (role, person, hours, rate)
- [x] Hard costs section
- [x] Markup and contingency inputs
- [x] Summary calculation
- [x] Notes field
- [x] Explicit save (not auto-save)

**Navigation**
- [x] Add "Estimates" link to app shell

### Phase 2: Go Live Flow - COMPLETE

**Status Management**
- [x] Status dropdown (draft → live → archived)
- [x] When changing to "live":
  - [x] Select project from dropdown
  - [x] Link estimate to project
  - [x] Project budget remains independent

**Tracking View**
- [x] When viewing a live estimate, show tracking section
- [x] Sum estimated hours from line items
- [x] Fetch actual hours from time_entries for linked project
- [x] Calculate: estimated hours, actual hours, remaining, percentage
- [x] Progress bar visualization (color-coded: green/amber/red)
- [x] Show hours comparison and value comparison

### Phase 3: Polish - PARTIAL

**Agency Roles**
- [x] Default agency roles created on first use (via DB function)
- [x] Role dropdown in estimate line items prepopulates from agency_roles
- [x] Can still type custom role names (ComboBox with create-on-type)
- [ ] Settings UI section for managing default roles + rates (future)

**UX Improvements**
- [ ] Drag-and-drop reordering of phases and line items
- [ ] Duplicate estimate
- [ ] Keyboard shortcuts (Tab through cells)

**Validations**
- [ ] Prevent archiving live estimate with active project
- [ ] Warn when estimate total differs significantly from project budget

---

## Future Considerations (Not for MVP)

### Multi-User & Privacy Model

When multiple users exist:

**Workers see:**
- Their own time entries for the project
- Nothing about estimates, budgets, or project economics
- They log time honestly without gaming against targets

**Owners see:**
- Full estimate with all line items
- Role-level tracking (aggregate, not individual): "Design role: 30h estimated, 35h logged"
- Project-level totals for client billing conversations
- NOT individual timesheets — that's private

**Why role-level, not person-level?**
- Multiple people might fill one role
- We care about "was the Design budget accurate?" not "how did Sarah perform?"
- Protects individuals from being measured against estimates they didn't create
- Keeps the system humanistic: awareness for project management, not surveillance

### Estimate Versioning

If formal versioning needed:
- `estimate_versions` table snapshots estimate state
- Can compare original vs revised
- For MVP: just edit the estimate; duplicate manually if you want history

### Project-to-Estimate Linking

Currently: one estimate → one project
Future possibility: one estimate → multiple projects (campaign with deliverables)
For MVP: keep it simple, 1:1 relationship

### Reporting

- "How accurate are my estimates?" over time
- Average overrun/underrun percentage
- Which phases are most often underestimated

---

## Technical Notes

### Component Structure

```
app/
  estimates/
    page.tsx          # List view
    [id]/
      page.tsx        # Builder/editor
components/
  estimate-builder.tsx    # Main form component
  estimate-phase.tsx      # Phase card with line items
  estimate-summary.tsx    # Calculation display
  estimate-tracking.tsx   # Actuals vs estimate (for live)
lib/
  supabase/
    estimates.ts      # Data operations
```

### Calculation Logic

Keep calculations client-side for responsiveness. Summary updates as you type.

```typescript
function calculateEstimate(estimate: Estimate) {
  const laborSubtotal = estimate.phases.reduce((sum, phase) =>
    sum + phase.lineItems.reduce((s, item) =>
      s + (item.hours * item.hourlyRateCents), 0), 0)

  const markup = laborSubtotal * (estimate.markupPercent / 100)
  const laborWithMarkup = laborSubtotal + markup
  const contingency = laborWithMarkup * (estimate.contingencyPercent / 100)
  const hardCostsTotal = estimate.hardCosts.reduce((s, c) => s + c.amountCents, 0)

  return {
    laborSubtotal,
    markup,
    laborWithMarkup,
    contingency,
    laborPlusContingency: laborWithMarkup + contingency,
    hardCostsTotal,
    projectTotal: laborWithMarkup + contingency + hardCostsTotal
  }
}
```

### Auto-save vs Explicit Save

Recommend: **Explicit save** for MVP. Auto-save adds complexity (debouncing, conflict handling). A "Save" button is clearer and prevents accidental data loss from tabbing through fields.

---

## Decisions Made

1. **Default markup**: 15%. **Default contingency**: 10%.

2. **Phase presets**: Immersion, Concept Development, Creative Development, Production, Post Production

3. **Role vs Person**: Role is required. Person is optional (text for now, future: pick from employee list with auto-filled title and rate, adjustable per estimate).

4. **What syncs when going live**: Not the total estimate (which includes hard costs, markup, contingency). What syncs is the **role/hours budget per line item**. Owner tracks their own hours against estimated hours. Future: aggregate role-level accuracy.

---

## How Role-Based Time Tracking Will Work (Future)

When a project goes live with an estimate, each line item represents a role budget:
- "Creative Director: 45h"
- "Designer: 30h"

When employees log time to that project, their logged time counts against the role they're assigned to (or the role specified when logging — TBD).

**Owner view**: Aggregate hours per role vs estimate
**Worker view**: Just their time logged (no estimate visibility, no role-level totals)

This keeps project economics visible to owners for billing and client conversations, while protecting individuals from being measured against estimates they had no part in creating.

### Open Question for Future

How do we associate a time entry with a role? Options:
1. **Implicit**: Employee has a default role (e.g., "Designer"), all their time counts toward that role
2. **Explicit**: When logging time, optionally specify which role (for people who wear multiple hats)
3. **Hybrid**: Default to their role, but allow override per entry

For MVP (single user), this isn't needed — all logged hours count toward the estimate.

---

## Success Criteria

The estimator is working when you can:

1. Create a new estimate with phases, line items, and hard costs
2. See the calculated total update as you edit
3. Mark it as "live" and link to a project
4. View your actual hours against estimated hours
5. Feel like you have better visibility into project economics

The estimate builder should feel like a **sandbox for thinking**, not a rigid form. Quick to use, forgiving of changes, helpful for decisions.
