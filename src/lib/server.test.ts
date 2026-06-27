import { describe, expect, it } from "vitest";
import { buildOneMapRouteUrl, hashShareToken, isValidShareToken } from "./server";

describe("server security and OneMap helpers", () => {
  it("hashes share tokens without storing the raw value", () => {
    const token = "6fb2f2aa1e23415bbbd7022e9f43f888";
    expect(hashShareToken(token)).toBe(hashShareToken(token));
    expect(hashShareToken(token)).not.toContain(token);
    expect(hashShareToken(token)).toHaveLength(64);
  });

  it("accepts only 128-bit hexadecimal share tokens", () => {
    expect(isValidShareToken("6fb2f2aa1e23415bbbd7022e9f43f888")).toBe(true);
    expect(isValidShareToken("short-token")).toBe(false);
  });

  it("builds a public transport request with Singapore date and time", () => {
    const url = buildOneMapRouteUrl({
      start: { latitude: 1.2932, longitude: 103.8522 },
      end: { latitude: 1.4042, longitude: 103.7907 },
      routeType: "pt",
      date: "2026-07-08",
      time: "15:00",
    });
    expect(url).toContain("routeType=pt");
    expect(url).toContain("date=07-08-2026");
    expect(url).toContain("time=15%3A00%3A00");
    expect(url).toContain("mode=transit");
  });
});
