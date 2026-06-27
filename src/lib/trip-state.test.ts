import { describe, expect, it } from "vitest";
import { createInitialState, normalizeTripState, tripReducer } from "./trip-state";

describe("trip state", () => {
  it("seeds editable titles for every trip day", () => {
    expect(createInitialState().dayTitles).toMatchObject({
      "2026-07-08": "Mandai 像素与夜行",
      "2026-07-10": "鸭子船 · 返程",
    });
  });

  it("trims and saves an edited day title", () => {
    const state = createInitialState();
    const next = tripReducer(state, {
      type: "set-day-title",
      date: "2026-07-08",
      title: "  动物世界日  ",
    });

    expect(next.dayTitles["2026-07-08"]).toBe("动物世界日");
    expect(next.revision).toBe(state.revision + 1);
    expect(() => tripReducer(state, { type: "set-day-title", date: "2026-07-08", title: "   " })).toThrow("1–40");
    expect(() => tripReducer(state, { type: "set-day-title", date: "2026-07-08", title: "很".repeat(41) })).toThrow("1–40");
  });

  it("fills day titles when hydrating data saved by an older version", () => {
    const state = createInitialState();
    const normalized = normalizeTripState({
      revision: state.revision,
      cards: state.cards,
      scheduledItems: state.scheduledItems,
    });

    expect(normalized.dayTitles["2026-07-08"]).toBe("Mandai 像素与夜行");
  });

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

  it("places a cross-day item before later activities when its time is changed", () => {
    const moved = tripReducer(createInitialState(), {
      type: "move",
      itemId: "s-luge",
      date: "2026-07-08",
      position: 3,
    });
    const retimed = tripReducer(moved, { type: "set-time", itemId: "s-luge", startTime: "10:00" });
    const orderedIds = retimed.scheduledItems
      .filter((item) => item.date === "2026-07-08")
      .sort((a, b) => a.position - b.position)
      .map((item) => item.id);

    expect(orderedIds.indexOf("s-luge")).toBeLessThan(orderedIds.indexOf("s-minecraft"));
  });

  it("keeps an upward drag at the requested position", () => {
    const next = tripReducer(createInitialState(), {
      type: "move",
      itemId: "s-night",
      date: "2026-07-08",
      position: 0,
    });
    const orderedIds = next.scheduledItems
      .filter((item) => item.date === "2026-07-08")
      .sort((a, b) => a.position - b.position)
      .map((item) => item.id);

    expect(orderedIds[0]).toBe("s-night");
  });

  it("creates and removes a custom card", () => {
    const state = createInitialState();
    const card = { ...state.cards[0], id: "custom-one", title: "临时活动", custom: true };
    const added = tripReducer(state, { type: "add-card", card });
    expect(added.cards.some((item) => item.id === "custom-one")).toBe(true);
    expect(tripReducer(added, { type: "delete-card", cardId: "custom-one" }).cards.some((item) => item.id === "custom-one")).toBe(false);
  });
});
