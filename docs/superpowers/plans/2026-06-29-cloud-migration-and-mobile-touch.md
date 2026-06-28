# Cloud Migration and Mobile Touch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve an edited browser-local itinerary while upgrading it into a token-protected Supabase trip, and make daily itinerary movement reliable on a Pixel-sized touch screen.

**Architecture:** Local storage hydration becomes an explicit prerequisite for sync bootstrap. A token URL joins cloud state, while a tokenless URL waits for an explicit create/migrate action that sends a validated `TripState` snapshot to the server. Mobile renders one selected day and combines long-press same-day drag with a date/time move sheet; desktop drag remains unchanged.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zod, Supabase JS, dnd-kit, Vitest/Testing Library, Playwright.

---

## File map

- Create `src/lib/trip-payload.ts`: bounded Zod schema and `parseTripSnapshot` for untrusted create payloads.
- Create `src/lib/local-trip.ts`: local snapshot/backup parsing and pasted share-token extraction.
- Create `src/components/cloud-trip-entry.tsx`: tokenless-page migration/create/paste UI.
- Create `src/components/mobile-day-tabs.tsx`: mobile-only selected-day navigation.
- Create `src/components/scheduled-item-move-dialog.tsx`: accessible cross-day/date-time move confirmation.
- Modify `src/app/api/trips/create/route.ts`: accept a validated snapshot and clean up partial writes.
- Modify `src/lib/sync-client.ts`: explicit join/create/retry state machine; never auto-create.
- Modify `src/components/planner-app.tsx`: hydrate local state first, wire cloud entry, touch sensor, day tabs and move controls.
- Modify `src/lib/trip-state.ts`: atomic `move-and-set-time` and adjacent movement actions.
- Modify `src/app/globals.css`: cloud entry, mobile day tabs, move sheet, touch handle and single-day layout.
- Add focused tests beside each new module and extend `src/components/planner-app.test.tsx`, `src/lib/trip-state.test.ts`, and `e2e/planner.spec.ts`.

### Task 1: Validate and back up local trip snapshots

**Files:**
- Create: `src/lib/trip-payload.ts`
- Create: `src/lib/trip-payload.test.ts`
- Create: `src/lib/local-trip.ts`
- Create: `src/lib/local-trip.test.ts`

- [ ] **Step 1: Write failing schema and storage-helper tests**

```ts
import { describe, expect, it } from "vitest";
import { createInitialState } from "./trip-state";
import { parseTripSnapshot } from "./trip-payload";

it("accepts a complete current itinerary", () => {
  expect(parseTripSnapshot(createInitialState())).toEqual(createInitialState());
});

it("rejects dangling scheduled card references", () => {
  const state = createInitialState();
  state.scheduledItems[0].cardId = "missing-card";
  expect(() => parseTripSnapshot(state)).toThrow("行程项目引用了不存在的卡片");
});

it("rejects excessive payloads", () => {
  const state = createInitialState();
  state.cards = Array.from({ length: 501 }, (_, index) => ({ ...state.cards[0], id: `card-${index}` }));
  expect(() => parseTripSnapshot(state)).toThrow();
});
```

```ts
import { describe, expect, it } from "vitest";
import { extractPastedShareToken, readLocalTrip } from "./local-trip";

it("accepts a full private URL or a raw token", () => {
  const token = "6fb2f2aa1e23415bbbd7022e9f43f888";
  expect(extractPastedShareToken(`https://trip.example/trip#${token}`)).toBe(token);
  expect(extractPastedShareToken(token)).toBe(token);
});

it("reports whether a valid browser snapshot existed", () => {
  const storage = { getItem: () => JSON.stringify({ revision: 1, dayTitles: {}, cards: [], scheduledItems: [] }) };
  expect(readLocalTrip(storage, "trip").hadStoredState).toBe(true);
});
```

- [ ] **Step 2: Run the focused tests and verify missing-module failures**

Run: `npm test -- src/lib/trip-payload.test.ts src/lib/local-trip.test.ts`

Expected: FAIL because both modules do not exist.

- [ ] **Step 3: Implement bounded schemas and pure local helpers**

`trip-payload.ts` must use Zod to constrain strings, coordinates, 15-minute time values, 15–720 minute durations, at most 500 cards, at most 500 scheduled items, and the four supported dates. After parsing, verify unique card/item IDs and every `ScheduledItem.cardId` reference.

```ts
export function parseTripSnapshot(input: unknown): TripState {
  const state = tripStateSchema.parse(input);
  const cardIds = new Set(state.cards.map((card) => card.id));
  if (cardIds.size !== state.cards.length) throw new Error("卡片编号重复");
  if (state.scheduledItems.some((item) => !cardIds.has(item.cardId))) {
    throw new Error("行程项目引用了不存在的卡片");
  }
  return normalizeTripState(state);
}
```

`local-trip.ts` must not touch global `window` at module load. Export constants for current and backup keys, `readLocalTrip(storage, key)`, `makeBackup(state, now)`, and `extractPastedShareToken(value)`.

- [ ] **Step 4: Run the focused tests and typecheck**

Run: `npm test -- src/lib/trip-payload.test.ts src/lib/local-trip.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/trip-payload.ts src/lib/trip-payload.test.ts src/lib/local-trip.ts src/lib/local-trip.test.ts
git commit -m "feat: validate local trip migration snapshots"
```

### Task 2: Create a cloud trip from the current snapshot

**Files:**
- Create: `src/app/api/trips/create/route.test.ts`
- Modify: `src/app/api/trips/create/route.ts`

- [ ] **Step 1: Write failing API tests with mocked Supabase calls**

Cover these exact cases: invalid JSON returns 400; invalid snapshot returns 400 without database writes; valid custom card/day title/schedule data are written rather than seed data; a member/card/item write failure deletes the newly inserted `trips` row and returns 500.

```ts
const request = new NextRequest("http://localhost/api/trips/create", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: "Bearer test" },
  body: JSON.stringify({ state: editedState }),
});
const response = await POST(request);
expect(response.status).toBe(200);
expect(activityInsert).toHaveBeenCalledWith(
  expect.arrayContaining([expect.objectContaining({ data: editedState.cards[0] })]),
);
```

- [ ] **Step 2: Run the route test and verify it fails against the seed-only endpoint**

Run: `npm test -- src/app/api/trips/create/route.test.ts`

Expected: FAIL because request state is ignored and invalid snapshots are accepted.

- [ ] **Step 3: Parse the body and persist the selected initial state**

Use `parseTripSnapshot(payload.state ?? createInitialState())`. Set the new trip revision and day titles from this snapshot, and write its cards/items. On any post-trip insert error, run:

```ts
await supabase.from("trips").delete().eq("id", trip.id);
return NextResponse.json({ error: writeError.message }, { status: 500 });
```

Return the exact normalized snapshot with the server-created revision. Treat a missing/empty JSON body as `{}` so explicit “create fresh” still works.

- [ ] **Step 4: Run the API test and all existing server tests**

Run: `npm test -- src/app/api/trips/create/route.test.ts src/app/api/routes/route.test.ts src/lib/server.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/app/api/trips/create/route.ts src/app/api/trips/create/route.test.ts
git commit -m "feat: create cloud trips from local snapshots"
```

### Task 3: Replace automatic sync creation with an explicit state machine

**Files:**
- Modify: `src/lib/sync-client.ts`
- Modify: `src/lib/sync-client.test.ts`
- Create: `src/components/cloud-trip-entry.tsx`
- Create: `src/components/cloud-trip-entry.test.tsx`

- [ ] **Step 1: Write failing helper and entry-component tests**

Add tests that a tokenless bootstrap returns `needs-cloud-action` without calling `/api/trips/create`, a hash token joins automatically, `createFromLocal(state)` posts that state and updates the address, and error payloads map to a visible Chinese reason.

```tsx
render(<CloudTripEntry hadStoredState onCreate={onCreate} onOpenToken={onOpenToken} busy={false} />);
expect(screen.getByRole("button", { name: "保存当前行程到云端" })).toBeVisible();
expect(screen.queryByText(/自动创建/)).not.toBeInTheDocument();
```

- [ ] **Step 2: Run focused tests and verify failures**

Run: `npm test -- src/lib/sync-client.test.ts src/components/cloud-trip-entry.test.tsx`

Expected: FAIL because the hook still automatically posts `/api/trips/create` and the component does not exist.

- [ ] **Step 3: Implement the explicit hook API**

Change the hook signature and return contract:

```ts
export function useTripSync(
  state: TripState,
  dispatch: React.Dispatch<TripAction>,
  options: { localReady: boolean },
) {
  // token URL: join after localReady
  // no token: set needs-cloud-action; never POST create here
  return {
    status,
    errorMessage,
    tripId,
    shareUrl,
    createTrip: (initialState: TripState) => Promise<boolean>,
    retry: () => void,
    resetAccess,
  };
}
```

`createTrip` must snapshot its argument, save a backup before the request, establish/reuse the anonymous session, POST `{ state: snapshot }`, replace the URL, hydrate the returned state, subscribe to Realtime, and return success/failure. Convert known errors into actionable messages while retaining the original `console.error`.

- [ ] **Step 4: Implement `CloudTripEntry`**

Render an inline travel-notebook banner with one primary create/migrate button, a link/token input, an “打开共享行程” button disabled for invalid input, and the current sync error/retry action. Do not render or log the token after navigation.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npm test -- src/lib/sync-client.test.ts src/components/cloud-trip-entry.test.tsx && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/sync-client.ts src/lib/sync-client.test.ts src/components/cloud-trip-entry.tsx src/components/cloud-trip-entry.test.tsx
git commit -m "feat: require explicit cloud trip migration"
```

### Task 4: Hydrate local data before sync and protect sharing

**Files:**
- Modify: `src/components/planner-app.tsx`
- Modify: `src/components/planner-app.test.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write failing planner tests**

Mock the sync hook and verify: local storage is hydrated before the sync hook is allowed to join/create; a tokenless page shows `CloudTripEntry`; clicking Share without `shareUrl` does not call `clipboard.writeText`; migration passes the currently edited state; the synced state hides the entry and copies a `/trip#token` link.

```ts
await user.click(screen.getByRole("button", { name: "分享" }));
expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
expect(screen.getByText("请先把当前行程保存到云端")).toBeVisible();
```

- [ ] **Step 2: Run the component tests and verify failures**

Run: `npm test -- src/components/planner-app.test.tsx`

Expected: FAIL because `useTripSync` runs before local hydration and Share falls back to `window.location.href`.

- [ ] **Step 3: Wire deterministic local hydration and migration**

Replace `loadedRef` with state that carries both readiness and whether storage contained a valid snapshot:

```ts
const [localStatus, setLocalStatus] = useState({ ready: false, hadStoredState: false });
useEffect(() => {
  const restored = readLocalTrip(localStorage, storageKey);
  if (restored.state) dispatch({ type: "hydrate", state: restored.state });
  setLocalStatus({ ready: true, hadStoredState: restored.hadStoredState });
}, []);
const sync = useTripSync(state, dispatch, { localReady: localStatus.ready });
```

Render `CloudTripEntry` for `needs-cloud-action`/`error` without hiding the current itinerary. Change Share so unsynced clicks reveal/focus the entry and never copy the bare origin. Add the banner styles without changing the existing tropical notebook palette.

- [ ] **Step 4: Run planner tests and typecheck**

Run: `npm test -- src/components/planner-app.test.tsx src/lib/sync-client.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/components/planner-app.tsx src/components/planner-app.test.tsx src/app/globals.css
git commit -m "feat: migrate restored itinerary before cloud sync"
```

### Task 5: Add atomic cross-day/date-time movement

**Files:**
- Modify: `src/lib/trip-state.ts`
- Modify: `src/lib/trip-state.test.ts`
- Create: `src/components/scheduled-item-move-dialog.tsx`
- Create: `src/components/scheduled-item-move-dialog.test.tsx`

- [ ] **Step 1: Write failing reducer and dialog tests**

Verify `move-and-set-time` changes date and time in one revision, sorts the target day chronologically, reindexes both days, and rejects non-quarter-hour values. Verify the dialog does not dispatch while editing and confirms one `{ itemId, date, startTime }` result.

```ts
const moved = tripReducer(state, {
  type: "move-and-set-time",
  itemId: "luge",
  date: "2026-07-08",
  startTime: "10:00",
});
expect(moved.revision).toBe(state.revision + 1);
expect(sortDayItems(moved.scheduledItems.filter((item) => item.date === "2026-07-08"))[0].id).toBe("luge");
```

- [ ] **Step 2: Run focused tests and verify failures**

Run: `npm test -- src/lib/trip-state.test.ts src/components/scheduled-item-move-dialog.test.tsx`

Expected: FAIL because the action and dialog do not exist.

- [ ] **Step 3: Implement one-revision movement**

Add `move-and-set-time` to `TripAction`, validate `HH:mm` on a 15-minute boundary, update date/time/version, sort both affected days by `startTime` then prior position, and call `reindex` once. Add an adjacent-move helper that computes the neighboring placement but requires the dialog confirmation if it changes time.

- [ ] **Step 4: Implement the accessible move dialog**

Use native dialog semantics, four date buttons, `ScheduledTimeEditor`-compatible draft behavior, confirm/cancel buttons, Escape close, and focus return. The component emits a single result only on confirmation.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npm test -- src/lib/trip-state.test.ts src/components/scheduled-item-move-dialog.test.tsx && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/trip-state.ts src/lib/trip-state.test.ts src/components/scheduled-item-move-dialog.tsx src/components/scheduled-item-move-dialog.test.tsx
git commit -m "feat: move itinerary items across days atomically"
```

### Task 6: Implement the mobile single-day and touch interface

**Files:**
- Create: `src/components/mobile-day-tabs.tsx`
- Create: `src/components/mobile-day-tabs.test.tsx`
- Modify: `src/components/planner-app.tsx`
- Modify: `src/components/planner-app.test.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write failing mobile interaction tests**

Verify four date tabs expose item counts, selecting July 9 hides the other mobile columns, the card menu opens the move dialog, confirmation selects the target date, and same-day move buttons remain keyboard accessible. Assert the drag handle has a dedicated touch class and instructions.

```tsx
expect(screen.getByRole("tab", { name: /7月9日.*6项/ })).toHaveAttribute("aria-selected", "true");
await user.click(screen.getByRole("button", { name: "移动 Skyline Luge 到其他日期" }));
expect(screen.getByRole("dialog", { name: "移动 Skyline Luge · 3 Rounds" })).toBeVisible();
```

- [ ] **Step 2: Run component tests and verify failures**

Run: `npm test -- src/components/mobile-day-tabs.test.tsx src/components/planner-app.test.tsx`

Expected: FAIL because mobile still renders the four-column board and has only `PointerSensor`.

- [ ] **Step 3: Add day selection and touch sensor**

Add `selectedMobileDate`, render `MobileDayTabs`, and place `data-mobile-selected` on each day column. Configure sensors exactly once:

```ts
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
);
```

Use CSS media queries to display only the selected day below 820px. Set `touch-action: none` only on the dedicated drag handle; keep cards and board `touch-action: pan-y` so normal scrolling works.

- [ ] **Step 4: Wire move menu and focus behavior**

Open `ScheduledItemMoveDialog` from each scheduled card. After confirmation dispatch `move-and-set-time`, switch the selected mobile date to the target, close the dialog, and focus the moved card. Preserve existing overlay/projection behavior for desktop and same-day touch drag.

- [ ] **Step 5: Run component tests and the complete Vitest suite**

Run: `npm test`

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/components/mobile-day-tabs.tsx src/components/mobile-day-tabs.test.tsx src/components/planner-app.tsx src/components/planner-app.test.tsx src/app/globals.css
git commit -m "feat: add touch-friendly mobile itinerary controls"
```

### Task 7: Verify browser migration, sharing, and touch behavior

**Files:**
- Modify: `e2e/planner.spec.ts`
- Modify: `playwright.config.ts` only if a deterministic test-only sync stub is required.

- [ ] **Step 1: Add failing browser scenarios**

Add a route-backed sync fixture so tests do not need production Supabase. Cover: restored local edit survives reload; tokenless page does not POST create before click; migration POST contains the edit and produces `/trip#token`; second context using that URL sees the same state; Pixel date tabs show one day; move dialog moves Luge to July 8 at 10:00; short swipe scrolls and long-press drag reorders without a page error.

- [ ] **Step 2: Run desktop and mobile scenarios and fix only evidence-backed defects**

Run: `npm run test:e2e -- --project=desktop-chromium`

Run: `npm run test:e2e -- --project=mobile-chromium`

Expected: both projects PASS; no `Maximum update depth exceeded` errors.

- [ ] **Step 3: Run release verification**

Run: `npm run lint`

Run: `npm run typecheck`

Run: `npm test`

Run: `npm run build`

Run: `npm run test:e2e`

Expected: every command exits 0.

- [ ] **Step 4: Commit**

```powershell
git add e2e/planner.spec.ts playwright.config.ts
git commit -m "test: verify cloud migration and mobile touch flows"
```

### Task 8: Completion audit and deployment handoff

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document the production recovery sequence**

Add a short section stating: enable Supabase Anonymous Sign-Ins; deploy required Vercel variables; deploy this version; on the original computer refresh once, choose “保存当前行程到云端”, wait for “已同步”, copy the `/trip#token` link, and open that exact link on the phone. Warn that the token grants edit access.

- [ ] **Step 2: Verify docs and repository state**

Run: `git diff --check`

Run: `git status --short`

Expected: only the intended README change before commit, no generated artifacts or secrets.

- [ ] **Step 3: Commit documentation**

```powershell
git add README.md
git commit -m "docs: add safe cloud migration rollout"
```

- [ ] **Step 4: Audit every design requirement against code or test evidence**

Confirm explicit local-ready gating, backup creation, exact private share link, token paste, no silent create, actionable errors, single mobile day, long-press touch sensor, cross-day date/time move, deferred time reorder, desktop drag preservation, and full command results. Do not claim production deployment; provide the user with the exact Vercel rollout and first-migration steps.
