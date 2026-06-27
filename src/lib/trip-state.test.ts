import { describe, expect, it } from "vitest";
import { createInitialState, tripReducer } from "./trip-state";

describe("trip state", () => {
  it("adds a card to a day at the next 15 minute slot", () => {
    const state = createInitialState();
    const next = tripReducer(state, { type: "schedule", cardId: "orchard", date: "2026-07-07" });
    const added = next.scheduledItems.find((item) => item.cardId === "orchard");
    expect(added?.startTime).toMatch(/^\d{2}:(00|15|30|45)$/);
    expect(next.revision).toBe(state.revision + 1);
  });

  it("moves an item to another day and rewrites positions", () => {
    const state = createInitialState();
    const next = tripReducer(state, {
      type: "move",
      itemId: "s-merlion",
      date: "2026-07-08",
      position: 1,
    });
    const moved = next.scheduledItems.find((item) => item.id === "s-merlion");
    expect(moved?.date).toBe("2026-07-08");
    expect(next.scheduledItems.filter((item) => item.date === "2026-07-08").map((item) => item.position)).toEqual([0, 1, 2, 3]);
  });

  it("updates manual time on a 15 minute boundary", () => {
    const state = createInitialState();
    expect(tripReducer(state, { type: "set-time", itemId: "s-merlion", startTime: "18:45" }).scheduledItems.find((item) => item.id === "s-merlion")?.startTime).toBe("18:45");
    expect(() => tripReducer(state, { type: "set-time", itemId: "s-merlion", startTime: "18:42" })).toThrow("15 分钟");
  });

  it("creates and removes a custom card", () => {
    const state = createInitialState();
    const card = { ...state.cards[0], id: "custom-one", title: "临时活动", custom: true };
    const added = tripReducer(state, { type: "add-card", card });
    expect(added.cards.some((item) => item.id === "custom-one")).toBe(true);
    expect(tripReducer(added, { type: "delete-card", cardId: "custom-one" }).cards.some((item) => item.id === "custom-one")).toBe(false);
  });
});
