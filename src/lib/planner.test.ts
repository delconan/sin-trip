import { describe, expect, it } from "vitest";
import {
  calculateFamilyPrice,
  detectScheduleWarnings,
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
});
