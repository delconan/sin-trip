import { describe, expect, it } from "vitest";
import { createInitialState } from "./trip-state";
import { parseTripSnapshot } from "./trip-payload";

describe("trip migration payload", () => {
  it("accepts a complete current itinerary", () => {
    const state = createInitialState();
    expect(parseTripSnapshot(state)).toEqual(state);
  });

  it("rejects dangling scheduled card references", () => {
    const state = createInitialState();
    state.scheduledItems[0] = { ...state.scheduledItems[0], cardId: "missing-card" };
    expect(() => parseTripSnapshot(state)).toThrow("行程项目引用了不存在的卡片");
  });

  it("rejects duplicate IDs and excessive card collections", () => {
    const duplicate = createInitialState();
    duplicate.cards[1] = { ...duplicate.cards[1], id: duplicate.cards[0].id };
    expect(() => parseTripSnapshot(duplicate)).toThrow("卡片编号重复");

    const excessive = createInitialState();
    excessive.cards = Array.from({ length: 501 }, (_, index) => ({ ...excessive.cards[0], id: `card-${index}` }));
    expect(() => parseTripSnapshot(excessive)).toThrow();
  });

  it("rejects times and durations outside the supported quarter-hour rules", () => {
    const badTime = createInitialState();
    badTime.scheduledItems[0] = { ...badTime.scheduledItems[0], startTime: "09:07" };
    expect(() => parseTripSnapshot(badTime)).toThrow();

    const badDuration = createInitialState();
    badDuration.cards[0] = { ...badDuration.cards[0], durationMinutes: 17 };
    expect(() => parseTripSnapshot(badDuration)).toThrow();
  });
});
