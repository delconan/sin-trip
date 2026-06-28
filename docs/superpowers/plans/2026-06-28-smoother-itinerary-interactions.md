# Smoother Itinerary Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add precise cross-day drag placement, defer time-based reordering until explicit confirmation, and make card-level suggested duration editable from the detail drawer.

**Architecture:** Keep persisted mutations in the existing reducer while extracting temporary time editing and drag projection into focused components/helpers. Drag preview state remains local to `PlannerApp`; only `onDragEnd` changes the trip. Duration remains a card property so every scheduled instance recalculates automatically.

**Tech Stack:** React 19, TypeScript, dnd-kit, Vitest, Testing Library, Playwright, CSS.

---

### Task 1: Card-duration domain mutation

**Files:**
- Modify: `src/lib/trip-state.ts`
- Test: `src/lib/trip-state.test.ts`

- [ ] **Step 1: Write failing reducer tests**

Add a test that dispatches `{ type: "set-card-duration", cardId: "hotel-rest", durationMinutes: 120 }`, asserts the card changes once and revision increases once. Assert 10, 17, and 735 minutes throw while 15 and 720 are accepted.

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/lib/trip-state.test.ts`
Expected: FAIL because the action is unknown.

- [ ] **Step 3: Implement the reducer action**

Add the action to `TripAction`, validate integer, 15–720 range, and 15-minute divisibility, then immutably update the matching card.

- [ ] **Step 4: Run GREEN**

Run: `npx vitest run src/lib/trip-state.test.ts`
Expected: PASS.

### Task 2: Deferred time editor

**Files:**
- Create: `src/components/scheduled-time-editor.tsx`
- Create: `src/components/scheduled-time-editor.test.tsx`
- Modify: `src/components/planner-app.tsx`

- [ ] **Step 1: Write failing component tests**

Render the wished-for component with `value="19:15"`, change to `10:00`, and assert `onCommit` has not fired while the preview end time updates. Press Enter and assert one commit with `10:00`; in another test press Escape and assert the input returns to `19:15` without a commit.

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/components/scheduled-time-editor.test.tsx`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the editor**

Create a local draft state, native `time` input with `step=900`, preview end time via `getEndTime`, and dirty-state confirm/cancel buttons. Enter/confirm calls `onCommit`; Escape/cancel resets; blur does nothing.

- [ ] **Step 4: Integrate into scheduled cards**

Replace the controlled time input in `ScheduledCard` with `ScheduledTimeEditor`, keyed by saved start time so Realtime changes reset stale drafts.

- [ ] **Step 5: Run GREEN**

Run: `npx vitest run src/components/scheduled-time-editor.test.tsx src/components/planner-app.test.tsx`
Expected: PASS.

### Task 3: Editable duration in the detail drawer

**Files:**
- Modify: `src/components/planner-app.tsx`
- Test: `src/components/planner-app.test.tsx`

- [ ] **Step 1: Write failing drawer test**

Open Minecraft details, change the `Minecraft Experience 建议时长` input from 60 to 90, assert the day card still ends at 17:00 before confirmation, click `确认 Minecraft Experience 建议时长`, then assert it ends at 17:30.

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/components/planner-app.test.tsx`
Expected: FAIL because duration is static text.

- [ ] **Step 3: Implement drawer duration editing**

Add a local duration draft with numeric input (`min=15`, `max=720`, `step=15`) and confirm/cancel controls. Change `selected` from an `ActivityCard` object to `selectedCardId`, derive the selected card from `state.cards`, and dispatch `set-card-duration` on confirmation.

- [ ] **Step 4: Run GREEN**

Run: `npx vitest run src/components/planner-app.test.tsx src/lib/trip-state.test.ts`
Expected: PASS.

### Task 4: Pure cross-day drop projection

**Files:**
- Create: `src/lib/drag-projection.ts`
- Create: `src/lib/drag-projection.test.ts`

- [ ] **Step 1: Write failing projection tests**

Test an item from day three over the upper half of day-two Minecraft returns day two position 0; over the lower half returns position 1; over an empty `day:` target returns position 0; over no target returns undefined. Include a same-day downward move to ensure the active item is removed before calculating the target index.

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/lib/drag-projection.test.ts`
Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement projection**

Export `projectDrop({ activeItemId, overId, items, activeTop, overTop, overHeight })`. Strip `item:`/`day:` prefixes, calculate against day items excluding the active item, and return `{ date, position }`.

- [ ] **Step 4: Run GREEN**

Run: `npx vitest run src/lib/drag-projection.test.ts`
Expected: PASS.

### Task 5: Drag overlay and insertion marker

**Files:**
- Modify: `src/components/planner-app.tsx`
- Modify: `src/app/globals.css`
- Test: `src/components/planner-app.test.tsx`

- [ ] **Step 1: Add failing preview-state assertions**

Test the exported `DropIndicator` renders `放在这里`, and verify a cancelled drag produces no reducer mutation through the pure projection/reducer coverage.

- [ ] **Step 2: Run RED**

Run: `npx vitest run src/components/planner-app.test.tsx`
Expected: FAIL because the indicator is absent.

- [ ] **Step 3: Wire dnd-kit preview events**

Add `onDragStart`, `onDragOver`, `onDragCancel`, `onDragEnd`, `DragOverlay`, and pointer-first collision detection with closest-centre fallback. Store `{ activeItemId, projection }` locally. `onDragOver` only updates projection; `onDragEnd` dispatches one `move` using the latest projection.

- [ ] **Step 4: Render target markers**

Pass projection into each `DayColumn`. Insert a marker before the projected index or after the final item; render the same marker inside an empty day. Suppress the marker in non-target days.

- [ ] **Step 5: Style the interaction**

Add a chilli-red insertion line, rounded endpoint, short label, reserved card-height gap, raised paper `DragOverlay`, and grab/grabbing cursor. Keep the existing journal palette and mobile horizontal board.

- [ ] **Step 6: Run GREEN**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS.

### Task 6: End-to-end and visual verification

**Files:**
- Modify: `e2e/planner.spec.ts`

- [ ] **Step 1: Add E2E flows**

Cover time draft staying in place until confirmation, duration edit changing the displayed end time, and a desktop cross-day drag that lands before a chosen target. Keep the mobile time-confirm control visible and usable.

- [ ] **Step 2: Run the complete gate**

Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e`, and `npm audit --omit=dev`.

- [ ] **Step 3: Inspect desktop and 390×844 mobile**

Confirm the overlay follows the pointer, the marker is unambiguous, no list jumps during time editing, and duration controls fit the drawer.

- [ ] **Step 4: Commit**

```bash
git add src e2e docs/superpowers/plans/2026-06-28-smoother-itinerary-interactions.md
git commit -m "feat: smooth itinerary editing interactions"
```
