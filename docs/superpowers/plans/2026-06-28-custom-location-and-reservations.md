# Custom Location and Reservation Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make custom-card locations resolve to real OneMap coordinates, support editing and confirmed deletion, and add persistent reservation tracking to attraction and food cards.

**Architecture:** Centralize card-level mutations in the trip reducer and share OneMap address-resolution logic between the create dialog and detail drawer. Reservation state lives on `ActivityCard`, so every rendering of the same card stays synchronized through the existing persistence and Supabase sync path.

**Tech Stack:** Next.js, React, TypeScript, TanStack Query, OneMap API proxy, Vitest, Testing Library, Playwright, CSS

---

### Task 1: Add card location and reservation state actions

**Files:**
- Modify: `src/types/trip.ts`
- Modify: `src/lib/trip-state.ts`
- Modify: `src/lib/trip-state.test.ts`

- [ ] **Step 1: Write failing reducer tests**

Add tests that exercise the desired public actions:

```ts
it("updates a custom card location without changing its identity", () => {
  const state = tripReducer(createInitialState(), { type: "add-card", card: customCard });
  const next = tripReducer(state, {
    type: "set-card-location",
    cardId: customCard.id,
    location: {
      address: "414 GEYLANG ROAD SINGAPORE 389392",
      latitude: 1.312888405679514,
      longitude: 103.8826252657034,
    },
  });
  expect(next.cards.find((card) => card.id === customCard.id)).toMatchObject({
    id: customCard.id,
    address: "414 GEYLANG ROAD SINGAPORE 389392",
    latitude: 1.312888405679514,
    longitude: 103.8826252657034,
  });
  expect(next.revision).toBe(state.revision + 1);
});

it("toggles reservation status only for attraction and food cards", () => {
  const state = createInitialState();
  const booked = tripReducer(state, { type: "toggle-reservation", cardId: "minecraft" });
  expect(booked.cards.find((card) => card.id === "minecraft")?.reservationStatus).toBe("booked");
  const required = tripReducer(booked, { type: "toggle-reservation", cardId: "minecraft" });
  expect(required.cards.find((card) => card.id === "minecraft")?.reservationStatus).toBe("required");
  expect(tripReducer(state, { type: "toggle-reservation", cardId: "hotel-rest" })).toBe(state);
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `npm test -- src/lib/trip-state.test.ts`

Expected: FAIL because the new actions and `reservationStatus` do not exist.

- [ ] **Step 3: Add the type and reducer actions**

Extend `ActivityCard`:

```ts
reservationStatus?: "required" | "booked";
```

Extend `TripAction`:

```ts
| { type: "set-card-location"; cardId: string; location: Pick<ActivityCard, "address" | "latitude" | "longitude"> }
| { type: "toggle-reservation"; cardId: string }
```

Normalize cards so attraction and food cards without a persisted value receive `required`, then implement both actions. `set-card-location` must reject non-finite coordinates and unknown cards; `toggle-reservation` must return the same state for shopping, rest, and transport cards.

- [ ] **Step 4: Run the reducer tests and verify GREEN**

Run: `npm test -- src/lib/trip-state.test.ts`

Expected: all trip-state tests PASS.

- [ ] **Step 5: Commit the state layer**

```powershell
git add src/types/trip.ts src/lib/trip-state.ts src/lib/trip-state.test.ts
git commit -m "feat: add card location and reservation state"
```

### Task 2: Build reusable OneMap place resolution

**Files:**
- Create: `src/lib/place-search.ts`
- Create: `src/lib/place-search.test.ts`

- [ ] **Step 1: Write failing resolver tests**

Define the desired behavior using a supplied fetch function:

```ts
it("returns the unique OneMap result", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [geylang] }), { status: 200 }));
  await expect(resolvePlaceAddress("414 Geylang Rd Singapore 389392", fetcher)).resolves.toEqual({
    kind: "resolved",
    place: geylang,
  });
});

it("requires selection when multiple results exist", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [geylang, geylangA] }), { status: 200 }));
  await expect(resolvePlaceAddress("389392", fetcher)).resolves.toEqual({
    kind: "ambiguous",
    results: [geylang, geylangA],
  });
});

it("reports an unresolved address instead of inventing coordinates", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }));
  await expect(resolvePlaceAddress("unknown", fetcher)).resolves.toEqual({ kind: "unresolved", results: [] });
});
```

- [ ] **Step 2: Run the resolver tests and verify RED**

Run: `npm test -- src/lib/place-search.test.ts`

Expected: FAIL because `place-search.ts` does not exist.

- [ ] **Step 3: Implement the resolver**

Create `PlaceResult`, `searchPlaces`, and `resolvePlaceAddress`. The resolver must URL-encode the query, reject non-OK responses, and return this discriminated union:

```ts
type PlaceResolution =
  | { kind: "resolved"; place: PlaceResult }
  | { kind: "ambiguous"; results: PlaceResult[] }
  | { kind: "unresolved"; results: [] };
```

- [ ] **Step 4: Run the resolver tests and verify GREEN**

Run: `npm test -- src/lib/place-search.test.ts`

Expected: all resolver tests PASS.

- [ ] **Step 5: Commit the resolver**

```powershell
git add src/lib/place-search.ts src/lib/place-search.test.ts
git commit -m "feat: resolve custom places through OneMap"
```

### Task 3: Require confirmed coordinates when creating custom cards

**Files:**
- Modify: `src/components/planner-app.tsx`
- Modify: `src/components/planner-app.test.tsx`

- [ ] **Step 1: Write failing create-dialog tests**

Add component tests that mock `/api/places` and verify:

```ts
it("auto-resolves a unique address before saving a custom card", async () => {
  // Open the custom dialog, enter No Signboard Seafood and the full Geylang address,
  // submit, then assert the saved card opens with the resolved address and its map link.
  expect(await screen.findByRole("link", { name: "打开地图" })).toHaveAttribute(
    "href",
    expect.stringContaining("414%20GEYLANG%20ROAD"),
  );
});

it("does not save an unresolved custom address", async () => {
  // Return no OneMap results, submit, and assert the dialog remains open with
  // “OneMap 找不到这个地址，请补充邮编或选择候选地址”.
});
```

- [ ] **Step 2: Run the component tests and verify RED**

Run: `npm test -- src/components/planner-app.test.tsx`

Expected: FAIL because the current submit path uses hotel coordinates.

- [ ] **Step 3: Make custom-card submission asynchronous**

Use `resolvePlaceAddress` when latitude/longitude are absent. Apply a unique result automatically, expose ambiguous results in the existing suggestion list, and keep the dialog open for unresolved/error cases. Remove both `|| hotel.latitude` and `|| hotel.longitude`. Set `reservationStatus: "required"` for custom attraction and food cards.

When the address input changes, clear stored latitude and longitude before starting the debounced search.

- [ ] **Step 4: Run the component tests and verify GREEN**

Run: `npm test -- src/components/planner-app.test.tsx`

Expected: all create-dialog tests PASS.

### Task 4: Edit and delete existing custom cards safely

**Files:**
- Modify: `src/components/planner-app.tsx`
- Modify: `src/components/planner-app.test.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write failing detail-drawer tests**

Add tests that create a custom card, open its details, and verify:

```ts
it("updates an existing custom card to a selected OneMap location", async () => {
  // Enter the Geylang address, choose the result, confirm, and assert that the
  // detail drawer displays 414 GEYLANG ROAD rather than Swissôtel.
});

it("requires a second confirmation before deleting a custom card", async () => {
  // First click reveals “确认删除” and “取消”; cancel preserves the card.
  // Re-enter confirmation and click “确认删除”; the card and scheduled instances disappear.
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `npm test -- src/components/planner-app.test.tsx`

Expected: FAIL because location editing and inline delete confirmation are absent.

- [ ] **Step 3: Implement location editing and delete confirmation**

Add `onLocation` to `DetailDrawer`. For custom cards, render an edit button beside the address, resolve or select a OneMap place, and dispatch `set-card-location`. Replace the immediate delete button with local confirmation state and explicit confirm/cancel buttons. Keep preloaded cards read-only and non-deletable.

- [ ] **Step 4: Style and verify the custom-card controls**

Add focused styles for the location editor, result list, error text, and destructive confirmation row. Run:

`npm test -- src/components/planner-app.test.tsx`

Expected: all detail-drawer tests PASS.

- [ ] **Step 5: Commit custom-place UI**

```powershell
git add src/components/planner-app.tsx src/components/planner-app.test.tsx src/app/globals.css
git commit -m "feat: validate and edit custom card locations"
```

### Task 5: Add reservation toggles everywhere a card appears

**Files:**
- Create: `src/components/reservation-toggle.tsx`
- Create: `src/components/reservation-toggle.test.tsx`
- Modify: `src/components/planner-app.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write failing reservation component tests**

```tsx
it("shows required and booked states", async () => {
  const user = userEvent.setup();
  const onToggle = vi.fn();
  const { rerender } = render(<ReservationToggle status="required" onToggle={onToggle} />);
  await user.click(screen.getByRole("button", { name: "标记为已预约" }));
  expect(onToggle).toHaveBeenCalledOnce();
  rerender(<ReservationToggle status="booked" onToggle={onToggle} />);
  expect(screen.getByText("已预约")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run: `npm test -- src/components/reservation-toggle.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement and integrate the toggle**

Create a small button component displaying `需预约` or `✓ 已预约`. Render it for attraction and food cards in `CandidateCard`, `ScheduledCard`, and `DetailDrawer`. Thread one `onToggleReservation(cardId)` callback from `PlannerApp` and dispatch `toggle-reservation`; do not render it for other categories.

- [ ] **Step 4: Run reservation and planner tests**

Run: `npm test -- src/components/reservation-toggle.test.tsx src/components/planner-app.test.tsx`

Expected: all tests PASS and one click updates every visible copy of the card.

- [ ] **Step 5: Commit reservation UI**

```powershell
git add src/components/reservation-toggle.tsx src/components/reservation-toggle.test.tsx src/components/planner-app.tsx src/app/globals.css
git commit -m "feat: track card reservation status"
```

### Task 6: Add end-to-end regressions and verify

**Files:**
- Modify: `e2e/planner.spec.ts`

- [ ] **Step 1: Add end-to-end coverage**

Add one test that creates No Signboard Seafood with `414 Geylang Rd Singapore 389392`, schedules it, opens the incoming transport comparison, and asserts the Google Maps destination contains `1.312888405679514,103.8826252657034` rather than the hotel coordinates.

Add one test that toggles Minecraft to `已预约`, reloads, and verifies the booked state remains visible.

- [ ] **Step 2: Run the focused browser tests**

Run:

```powershell
npx playwright test e2e/planner.spec.ts --grep "custom location|reservation" --project desktop-chromium
```

Expected: both focused tests PASS.

- [ ] **Step 3: Run complete verification**

Run:

```powershell
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
git diff --check
```

Expected: all unit/component tests pass, type checking and linting succeed, production build succeeds, all applicable Playwright tests pass, and `git diff --check` reports no errors.

- [ ] **Step 4: Commit end-to-end coverage**

```powershell
git add e2e/planner.spec.ts
git commit -m "test: cover custom locations and reservations"
```
