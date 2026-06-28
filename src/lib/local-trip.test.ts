import { describe, expect, it } from "vitest";
import { createInitialState } from "./trip-state";
import { extractPastedShareToken, makeLocalBackup, readLocalTrip } from "./local-trip";

describe("local trip recovery", () => {
  it("accepts a full private URL or a raw token", () => {
    const token = "6fb2f2aa1e23415bbbd7022e9f43f888";
    expect(extractPastedShareToken(`https://trip.example/trip#${token}`)).toBe(token);
    expect(extractPastedShareToken(token)).toBe(token);
    expect(extractPastedShareToken("https://trip.example/")).toBeUndefined();
  });

  it("restores a valid snapshot and reports that it existed", () => {
    const state = createInitialState();
    const storage = { getItem: () => JSON.stringify(state), removeItem: () => undefined };
    expect(readLocalTrip(storage, "trip")).toEqual({ state, hadStoredState: true });
  });

  it("removes corrupt stored data without reporting a saved itinerary", () => {
    let removed = "";
    const storage = { getItem: () => "not-json", removeItem: (key: string) => { removed = key; } };
    expect(readLocalTrip(storage, "trip")).toEqual({ hadStoredState: false });
    expect(removed).toBe("trip");
  });

  it("creates a timestamped independent backup", () => {
    const state = createInitialState();
    const backup = makeLocalBackup(state, new Date("2026-06-29T01:02:03.000Z"));
    state.cards[0].title = "changed later";
    expect(backup.createdAt).toBe("2026-06-29T01:02:03.000Z");
    expect(backup.state.cards[0].title).not.toBe("changed later");
  });
});
