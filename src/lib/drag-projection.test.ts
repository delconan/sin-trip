import { describe, expect, it } from "vitest";
import { projectDrop } from "./drag-projection";
import type { ScheduledItem } from "@/types/trip";

const items = [
  { id: "a", cardId: "a", date: "2026-07-09", startTime: "10:00", position: 0 },
  { id: "b", cardId: "b", date: "2026-07-08", startTime: "16:00", position: 0 },
  { id: "c", cardId: "c", date: "2026-07-08", startTime: "17:00", position: 1 },
  { id: "d", cardId: "d", date: "2026-07-08", startTime: "18:00", position: 2 },
] satisfies ScheduledItem[];

describe("projectDrop", () => {
  it("places a cross-day item before the target in its upper half", () => {
    expect(projectDrop({ activeItemId: "a", overId: "item:b", items, activeCenterY: 175, overTop: 150, overHeight: 100 })).toEqual({ date: "2026-07-08", position: 0 });
  });

  it("places a cross-day item after the target in its lower half", () => {
    expect(projectDrop({ activeItemId: "a", overId: "item:b", items, activeCenterY: 225, overTop: 150, overHeight: 100 })).toEqual({ date: "2026-07-08", position: 1 });
  });

  it("places an item at position zero in an empty day", () => {
    expect(projectDrop({ activeItemId: "a", overId: "day:2026-07-10", items })).toEqual({ date: "2026-07-10", position: 0 });
  });

  it("calculates same-day downward positions after removing the active item", () => {
    expect(projectDrop({ activeItemId: "b", overId: "item:d", items, activeCenterY: 225, overTop: 150, overHeight: 100 })).toEqual({ date: "2026-07-08", position: 2 });
  });

  it("returns undefined without a valid target", () => {
    expect(projectDrop({ activeItemId: "a", overId: undefined, items })).toBeUndefined();
  });
});
