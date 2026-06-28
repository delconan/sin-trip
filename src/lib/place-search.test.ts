import { describe, expect, it, vi } from "vitest";
import { resolvePlaceAddress } from "./place-search";

const geylang = {
  title: "414 GEYLANG ROAD SINGAPORE 389392",
  address: "414 GEYLANG ROAD SINGAPORE 389392",
  latitude: 1.312888405679514,
  longitude: 103.8826252657034,
};
const geylangA = { ...geylang, title: "414A GEYLANG ROAD", address: "414A GEYLANG ROAD SINGAPORE 389392" };

describe("resolvePlaceAddress", () => {
  it("returns the unique OneMap result", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [geylang] }), { status: 200 }));
    await expect(resolvePlaceAddress("414 Geylang Rd Singapore 389392", fetcher)).resolves.toEqual({ kind: "resolved", place: geylang });
  });

  it("requires selection when multiple results exist", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [geylang, geylangA] }), { status: 200 }));
    await expect(resolvePlaceAddress("389392", fetcher)).resolves.toEqual({ kind: "ambiguous", results: [geylang, geylangA] });
  });

  it("reports an unresolved address instead of inventing coordinates", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }));
    await expect(resolvePlaceAddress("unknown", fetcher)).resolves.toEqual({ kind: "unresolved", results: [] });
  });
});
