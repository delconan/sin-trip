import { describe, expect, it } from "vitest";
import {
  calculateFamilyPrice,
  detectScheduleWarnings,
  estimateFamilyRouteFare,
  estimateRoutes,
  getEndTime,
  recommendRoute,
} from "./planner";
import type { ActivityCard, RouteOption, ScheduledItem } from "@/types/trip";

describe("planner domain rules", () => {
  it("calculates a 2 adult + 2 child family total", () => {
    expect(calculateFamilyPrice({ adult: 46, child: 40 })).toBe(172);
  });

  it("returns undefined when a child price is unavailable", () => {
    expect(calculateFamilyPrice({ adult: 49 })).toBeUndefined();
  });

  it("calculates an end time across the hour boundary", () => {
    expect(getEndTime("19:15", 165)).toBe("22:00");
  });

  it("flags overlap, insufficient transfer time, and closed hours", () => {
    const card = {
      id: "night-safari",
      title: "夜间动物园",
      durationMinutes: 165,
      openingHours: { "2026-07-08": [{ start: "19:15", end: "23:59" }] },
    } as unknown as ActivityCard;
    const item = { id: "one", date: "2026-07-08", startTime: "18:45", cardId: card.id } as ScheduledItem;

    expect(
      detectScheduleWarnings({
        item,
        card,
        previousEndTime: "18:30",
        transferMinutes: 30,
      }),
    ).toEqual(expect.arrayContaining(["营业时间外", "交通时间不足 15 分钟"]));
  });

  it("prefers a short walk", () => {
    const routes: RouteOption[] = [
      { mode: "walk", durationMinutes: 12, distanceMeters: 900, summary: "步行", recommended: false, mapsUrl: "#" },
      { mode: "transit", durationMinutes: 17, distanceMeters: 1300, summary: "地铁", recommended: false, mapsUrl: "#" },
      { mode: "taxi", durationMinutes: 7, distanceMeters: 1600, summary: "打车", recommended: false, mapsUrl: "#" },
    ];
    expect(recommendRoute(routes, { departureTime: "11:00", hasLuggage: false })?.mode).toBe("walk");
  });

  it("prefers taxi late at night", () => {
    const routes: RouteOption[] = [
      { mode: "transit", durationMinutes: 30, distanceMeters: 9000, summary: "地铁", recommended: false, mapsUrl: "#" },
      { mode: "taxi", durationMinutes: 20, distanceMeters: 9000, summary: "打车", recommended: false, mapsUrl: "#" },
    ];
    expect(recommendRoute(routes, { departureTime: "21:45", hasLuggage: false })?.mode).toBe("taxi");
  });

  it("estimates three transport choices between two coordinates", () => {
    const routes = estimateRoutes(
      { title: "Hotel", latitude: 1.2932, longitude: 103.8522 },
      { title: "Merlion", latitude: 1.2868, longitude: 103.8545 },
      "18:00",
    );
    expect(routes.map((route) => route.mode)).toEqual(["walk", "transit", "taxi"]);
    expect(routes.find((route) => route.recommended)?.mode).toBe("walk");
  });

  it("shows walking as free for the whole family", () => {
    expect(estimateFamilyRouteFare({ mode: "walk", distanceMeters: 900 }, "10:00")).toMatchObject({
      min: 0,
      max: 0,
      label: "S$0",
    });
  });

  it("calculates a public-transport family range from adult and child fare bands", () => {
    expect(estimateFamilyRouteFare({ mode: "transit", distanceMeters: 5000 }, "10:00")).toMatchObject({
      min: 4.3,
      max: 6,
      label: "S$4.30–6.00",
    });
  });

  it("widens a taxi estimate during evening surcharge hours", () => {
    const daytime = estimateFamilyRouteFare({ mode: "taxi", distanceMeters: 12000 }, "14:00");
    const evening = estimateFamilyRouteFare({ mode: "taxi", distanceMeters: 12000 }, "19:00");

    expect(daytime.min).toBe(12.4);
    expect(evening.min).toBe(12.4);
    expect(evening.max).toBeGreaterThan(daytime.max);
    expect(evening.label).toMatch(/^S\$12\.40–/);
  });
});
