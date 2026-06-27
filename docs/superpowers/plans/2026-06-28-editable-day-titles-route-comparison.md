# Editable Day Titles and Route Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each day heading editable and replace direct route navigation with a responsive three-mode time-and-family-price comparison.

**Architecture:** Extend `TripState` with normalized day titles and persist them in the existing revisioned Supabase write. Keep fare estimation as pure functions in `planner.ts`; keep route fetching in `RouteRibbon`, while a focused `RouteComparisonDialog` renders the three options. Preserve the existing tropical field-note visual language.

**Tech Stack:** Next.js 16, React 19, TypeScript, TanStack Query, Supabase/Postgres, Vitest, Testing Library, Playwright, CSS.

---

### Task 1: Day-title state and compatibility

**Files:**
- Modify: `src/types/trip.ts`
- Modify: `src/lib/trip-state.ts`
- Test: `src/lib/trip-state.test.ts`

- [ ] **Step 1: Write failing reducer and hydration tests**

Add tests asserting that `createInitialState().dayTitles["2026-07-08"]` contains the seed title, `set-day-title` trims and saves a non-empty title, rejects an empty/over-40-character title, and `normalizeTripState` fills titles missing from an old stored state.

```ts
const renamed = tripReducer(createInitialState(), {
  type: "set-day-title", date: "2026-07-08", title: "  动物世界日  ",
});
expect(renamed.dayTitles["2026-07-08"]).toBe("动物世界日");
expect(normalizeTripState({ revision: 1, cards: [], scheduledItems: [] }).dayTitles["2026-07-08"]).toBe("Mandai 像素与夜行");
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npx vitest run src/lib/trip-state.test.ts`
Expected: FAIL because `dayTitles`, `normalizeTripState`, and `set-day-title` do not exist.

- [ ] **Step 3: Add the minimal state model**

Add `dayTitles: Record<string, string>` to `TripState`, derive default titles from `tripDays`, normalize old state at all hydration/initialization boundaries, and add:

```ts
| { type: "set-day-title"; date: string; title: string }
```

The reducer trims, validates 1–40 characters, increments revision, and updates only the selected date.

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run: `npx vitest run src/lib/trip-state.test.ts`
Expected: all trip-state tests PASS.

### Task 2: Persist day titles through Supabase

**Files:**
- Create: `supabase/migrations/202606280002_day_titles.sql`
- Modify: `src/lib/trip-server.ts`
- Modify: `src/app/api/trips/state/route.ts`
- Test: `src/lib/trip-state.test.ts`

- [ ] **Step 1: Add a failing serialized-state compatibility test**

Verify that a remotely loaded state with `day_titles = null` normalizes to defaults, while a populated map remains unchanged.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npx vitest run src/lib/trip-state.test.ts`
Expected: FAIL until the loading helper handles remote day titles.

- [ ] **Step 3: Add the migration and server wiring**

The migration adds `day_titles jsonb not null default '{}'::jsonb` to `trips`, replaces the RPC signature with `p_day_titles jsonb`, updates `trips.day_titles` in the same optimistic revision statement, and re-grants execute permission. `loadTripState` selects `revision,day_titles`; PUT passes `p_day_titles: state.dayTitles`.

```sql
alter table public.trips add column if not exists day_titles jsonb not null default '{}'::jsonb;
```

- [ ] **Step 4: Run focused tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS with the extended state shape.

### Task 3: Family route fare estimator

**Files:**
- Modify: `src/types/trip.ts`
- Modify: `src/lib/planner.ts`
- Test: `src/lib/planner.test.ts`

- [ ] **Step 1: Write failing fare tests**

Cover walk = `S$0`, transit lower/upper totals for a short and long route, taxi distance pricing, surcharge widening, S$0.10 rounding, and a human-readable price label.

```ts
expect(estimateFamilyRouteFare({ mode: "walk", distanceMeters: 900 }, "10:00").label).toBe("S$0");
expect(estimateFamilyRouteFare({ mode: "transit", distanceMeters: 5000 }, "10:00").max).toBeGreaterThan(5);
expect(estimateFamilyRouteFare({ mode: "taxi", distanceMeters: 12000 }, "19:00").min).toBeGreaterThan(10);
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npx vitest run src/lib/planner.test.ts`
Expected: FAIL because `estimateFamilyRouteFare` does not exist.

- [ ] **Step 3: Implement official-table estimates**

Add a `RouteFareEstimate` type and pure estimator. Transit uses the PTC distance bands with two adult fares plus two concession fares for the minimum and four adult fares for the maximum. Taxi uses S$4.60 for the first kilometre, S$0.27 per started 400m through 10km, then per 350m, with a modest time/surcharge range; walking is free. Every result includes `label`, `note`, `sourceUrl`, and `checkedAt: "2026-06-28"`.

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run: `npx vitest run src/lib/planner.test.ts`
Expected: all planner tests PASS.

### Task 4: Editable title UI

**Files:**
- Create: `src/components/editable-day-title.tsx`
- Modify: `src/components/planner-app.tsx`
- Test: `src/components/planner-app.test.tsx`

- [ ] **Step 1: Write failing interaction tests**

Test click-to-edit, Enter/blur save, Escape cancel, and empty-value rejection using the visible day-two heading.

```tsx
await user.click(screen.getByRole("button", { name: "编辑 Mandai 像素与夜行" }));
await user.clear(screen.getByLabelText("7月8日标题"));
await user.type(screen.getByLabelText("7月8日标题"), "动物世界日{Enter}");
expect(screen.getByRole("heading", { name: "动物世界日" })).toBeInTheDocument();
```

- [ ] **Step 2: Run component test and confirm RED**

Run: `npx vitest run src/components/planner-app.test.tsx`
Expected: FAIL because the edit button/input is absent.

- [ ] **Step 3: Implement `EditableDayTitle` and dispatch**

The component owns draft/editing state, focuses/selects on entry, calls `onSave` for valid trimmed text, and restores the original on Escape. `DayColumn` receives the state title and dispatches `set-day-title`.

- [ ] **Step 4: Run component test and confirm GREEN**

Run: `npx vitest run src/components/planner-app.test.tsx`
Expected: title interaction tests PASS.

### Task 5: Route comparison dialog

**Files:**
- Create: `src/components/route-comparison-dialog.tsx`
- Modify: `src/components/planner-app.tsx`
- Test: `src/components/planner-app.test.tsx`

- [ ] **Step 1: Write failing dialog tests**

Click the first transport ribbon and assert a named dialog contains `步行`, `公交 / MRT`, `打车`, three family prices, and three `Google Maps 查询` links. Assert the ribbon itself is a button rather than an external link and Escape closes the dialog.

- [ ] **Step 2: Run component test and confirm RED**

Run: `npx vitest run src/components/planner-app.test.tsx`
Expected: FAIL because clicking still follows a link and no dialog exists.

- [ ] **Step 3: Implement route completion and dialog**

`RouteRibbon` changes to a button, merges OneMap results by mode over `estimateRoutes` so all three modes always exist, and opens `RouteComparisonDialog`. The dialog derives each fare via `estimateFamilyRouteFare`, highlights `recommended`, displays route metadata, and keeps Google navigation in explicit per-mode links.

- [ ] **Step 4: Run component test and confirm GREEN**

Run: `npx vitest run src/components/planner-app.test.tsx`
Expected: all dialog tests PASS.

### Task 6: Responsive field-note styling

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add focused styles**

Add `.day-title-button`, `.day-title-input`, `.route-comparison`, `.route-options`, and `.route-option` styles using the existing paper, leaf, chilli, sun, ink, and dashed-route tokens. Desktop uses a centred paper dialog with three columns; `@media (max-width: 760px)` anchors it to the bottom with one-column option cards and safe-area padding.

- [ ] **Step 2: Run lint and typecheck**

Run: `npm run lint && npm run typecheck`
Expected: PASS.

### Task 7: Browser and production verification

**Files:**
- Modify: `e2e/planner.spec.ts`

- [ ] **Step 1: Add an E2E flow**

Verify day-two title editing persists in the rendered heading; verify clicking a route ribbon opens the three-option dialog without navigation; verify the Google link has a Maps URL. Run on desktop and mobile projects.

- [ ] **Step 2: Run the complete verification gate**

Run in order:

```powershell
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
npm audit --omit=dev
```

Expected: zero failures, successful production build, zero audit vulnerabilities.

- [ ] **Step 3: Visually inspect desktop and mobile**

Use the in-app browser at desktop and 390×844 viewports. Confirm title input does not shift the header, the dialog fits without clipping, all three prices are legible, Escape/close works, and Google Maps only opens through explicit buttons.

- [ ] **Step 4: Commit**

```bash
git add src supabase e2e docs/superpowers/plans/2026-06-28-editable-day-titles-route-comparison.md
git commit -m "feat: add editable day titles and route comparison"
```
