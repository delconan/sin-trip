import { describe, expect, it } from "vitest";
import { extractShareToken, makeShareUrl } from "./sync-client";

describe("sync link helpers", () => {
  it("extracts a valid private token from the URL fragment", () => {
    expect(extractShareToken("#6fb2f2aa1e23415bbbd7022e9f43f888")).toBe("6fb2f2aa1e23415bbbd7022e9f43f888");
    expect(extractShareToken("#not-a-token")).toBeUndefined();
  });

  it("keeps the private token in the fragment instead of a query string", () => {
    expect(makeShareUrl("https://trip.example/trip", "6fb2f2aa1e23415bbbd7022e9f43f888")).toBe("https://trip.example/trip#6fb2f2aa1e23415bbbd7022e9f43f888");
  });
});
