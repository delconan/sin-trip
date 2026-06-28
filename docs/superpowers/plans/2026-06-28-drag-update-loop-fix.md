# Drag Update Loop Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent itinerary dragging from triggering React's `Maximum update depth exceeded` while preserving precise insertion feedback.

**Architecture:** Keep drag projection and drop mutation behavior unchanged. Remove the feedback loop at its source by making `DropIndicator` visually overlay the insertion boundary without contributing height to the sortable layout, and replace the height animation with an opacity-only animation.

**Tech Stack:** Next.js, React, TypeScript, dnd-kit, Vitest, Testing Library, Playwright, CSS

---

### Task 1: Add the regression tests

**Files:**
- Modify: `src/components/planner-app.test.tsx`
- Modify: `e2e/planner.spec.ts`

- [ ] **Step 1: Add a component test for layout-neutral insertion feedback**

Import the global stylesheet and add this test to the existing `PlannerApp` suite:

```tsx
import "@/app/globals.css";

it("keeps the drop indicator out of the sortable layout flow", () => {
  render(<DropIndicator />);
  const indicator = screen.getByRole("status");
  expect(getComputedStyle(indicator).height).toBe("0px");
  expect(getComputedStyle(indicator).pointerEvents).toBe("none");
});
```

- [ ] **Step 2: Make the cross-day browser test reject React page errors**

Extend the existing `drops a cross-day card before a chosen target` test before navigation:

```ts
const pageErrors: Error[] = [];
page.on("pageerror", (error) => pageErrors.push(error));
```

After the placement assertion, add:

```ts
expect(pageErrors.map((error) => error.message)).not.toContainEqual(
  expect.stringContaining("Maximum update depth exceeded"),
);
```

- [ ] **Step 3: Run the component test and verify RED**

Run: `npm test -- src/components/planner-app.test.tsx`

Expected: FAIL because the current computed height is `58px`, not `0px`.

### Task 2: Remove insertion-marker layout feedback

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace the layout-changing indicator styles**

Replace the current `.drop-indicator` block and height animation with:

```css
.drop-indicator { position:relative; z-index:4; height:0; margin:0; color:var(--chilli); font-size:8px; font-weight:900; letter-spacing:.08em; pointer-events:none; animation:dropMarker .16s ease-out; }
.drop-indicator::before { content:""; position:absolute; left:4px; right:4px; top:0; border-top:2px solid var(--chilli); box-shadow:0 3px 0 rgba(225,84,56,.08); }
.drop-indicator::after { content:""; position:absolute; left:1px; top:-4px; width:9px; height:9px; border-radius:50%; background:var(--chilli); }
.drop-indicator span { position:absolute; left:50%; top:0; z-index:1; padding:3px 8px; border:1px solid var(--chilli); border-radius:99px; background:var(--paper); box-shadow:0 3px 9px rgba(225,84,56,.14); transform:translate(-50%,-50%); white-space:nowrap; }
@keyframes dropMarker { from { opacity:0; } }
```

This keeps the line visually anchored between cards while its layout box remains zero-height throughout the animation.

- [ ] **Step 2: Run the component test and verify GREEN**

Run: `npm test -- src/components/planner-app.test.tsx`

Expected: all tests in the file PASS.

- [ ] **Step 3: Run the cross-day browser regression**

Run: `npx playwright test e2e/planner.spec.ts --grep "drops a cross-day card" --project desktop-chromium`

Expected: PASS, with the card before Minecraft and no maximum-depth page error.

### Task 3: Verify and commit

**Files:**
- Verify: `src/components/planner-app.test.tsx`
- Verify: `e2e/planner.spec.ts`
- Verify: `src/app/globals.css`

- [ ] **Step 1: Run the full verification suite**

Run:

```powershell
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
git diff --check
```

Expected: 48 or more unit/component tests pass, type checking and linting succeed, production build succeeds, all applicable Playwright tests pass, and `git diff --check` reports no errors.

- [ ] **Step 2: Commit the fix**

```powershell
git add src/app/globals.css src/components/planner-app.test.tsx e2e/planner.spec.ts docs/superpowers/plans/2026-06-28-drag-update-loop-fix.md
git commit -m "fix: prevent drag projection update loop"
```
