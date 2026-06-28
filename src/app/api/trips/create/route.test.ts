import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createInitialState } from "@/lib/trip-state";

const database = vi.hoisted(() => ({
  inserts: new Map<string, unknown[]>(),
  deletedTripIds: [] as string[],
  failTable: "" as string,
}));

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseServerConfigured: true,
  requestUser: vi.fn(async () => ({ id: "user-1" })),
  serviceSupabase: () => ({
    from: (table: string) => ({
      insert: (value: unknown) => {
        database.inserts.set(table, [...(database.inserts.get(table) ?? []), value]);
        if (table === "trips") {
          return {
            select: () => ({
              single: async () => ({
                data: { id: "trip-1", revision: 1 },
                error: database.failTable === table ? new Error("trip failed") : null,
              }),
            }),
          };
        }
        return Promise.resolve({ error: database.failTable === table ? new Error(`${table} failed`) : null });
      },
      delete: () => ({
        eq: async (_column: string, id: string) => {
          database.deletedTripIds.push(id);
          return { error: null };
        },
      }),
    }),
  }),
}));

vi.mock("@/lib/server", () => ({
  newShareToken: () => "6fb2f2aa1e23415bbbd7022e9f43f888",
  hashShareToken: () => "hashed-token",
}));

import { POST } from "./route";

function request(body?: string) {
  return new NextRequest("http://localhost/api/trips/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer test" },
    body,
  });
}

beforeEach(() => {
  database.inserts.clear();
  database.deletedTripIds.length = 0;
  database.failTable = "";
});

describe("POST /api/trips/create", () => {
  it("returns 400 for malformed JSON without writing", async () => {
    const response = await POST(request("{"));
    expect(response.status).toBe(400);
    expect(database.inserts.size).toBe(0);
  });

  it("returns 400 for an invalid snapshot without writing", async () => {
    const response = await POST(request(JSON.stringify({ state: { cards: "invalid" } })));
    expect(response.status).toBe(400);
    expect(database.inserts.size).toBe(0);
  });

  it("writes the edited snapshot instead of the starter seed", async () => {
    const edited = createInitialState();
    edited.dayTitles["2026-07-08"] = "我的动物日";
    edited.cards[0] = { ...edited.cards[0], title: "我修改的抵达" };
    edited.scheduledItems[0] = { ...edited.scheduledItems[0], startTime: "15:15" };

    const response = await POST(request(JSON.stringify({ state: edited })));

    expect(response.status).toBe(200);
    expect(database.inserts.get("trips")?.[0]).toMatchObject({ day_titles: edited.dayTitles });
    expect(database.inserts.get("activity_cards")?.[0]).toEqual(
      expect.arrayContaining([expect.objectContaining({ data: expect.objectContaining({ title: "我修改的抵达" }) })]),
    );
    expect(database.inserts.get("scheduled_items")?.[0]).toEqual(
      expect.arrayContaining([expect.objectContaining({ data: expect.objectContaining({ startTime: "15:15" }) })]),
    );
    await expect(response.json()).resolves.toMatchObject({ state: edited });
  });

  it("deletes the new trip when a dependent write fails", async () => {
    database.failTable = "activity_cards";
    const response = await POST(request(JSON.stringify({ state: createInitialState() })));
    expect(response.status).toBe(500);
    expect(database.deletedTripIds).toEqual(["trip-1"]);
  });
});
