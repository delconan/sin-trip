import { describe, expect, it } from "vitest";
import { seedCards, seedSchedule, tripDays } from "./seed";

describe("Singapore trip seed", () => {
  it("contains every requested activity and restaurant", () => {
    const titles = seedCards.map((card) => card.title);
    expect(titles).toEqual(
      expect.arrayContaining([
        "Minecraft Experience",
        "夜间动物园",
        "Skyline Luge · 3 Rounds",
        "花穹＋云雾林",
        "超级树灯光秀",
        "鱼尾狮公园",
        "乌节路购物",
        "Palm Beach Seafood",
        "Lau Pa Sat 沙爹街",
        "天天海南鸡饭",
        "Kampung Nasi Lemak",
        "咖椰吐司早餐",
      ]),
    );
  });

  it("contains four travel days and a comfortable starter schedule", () => {
    expect(tripDays).toHaveLength(4);
    expect(seedSchedule.filter((item) => item.date === "2026-07-08").map((item) => item.startTime)).toEqual([
      "16:00",
      "17:15",
      "19:15",
    ]);
  });

  it("includes source metadata for priced activities", () => {
    const priced = seedCards.filter((card) => card.price);
    expect(priced.length).toBeGreaterThan(5);
    for (const card of priced) {
      expect(card.price?.currency).toBe("SGD");
      expect(card.price?.checkedAt).toBe("2026-06-27");
      expect(card.price?.sourceUrl).toMatch(/^https:\/\//);
    }
  });

  it("keeps activity durations on 15 minute increments", () => {
    expect(seedCards.every((card) => card.durationMinutes % 15 === 0)).toBe(true);
  });

  it("serves seed photography from optimized local assets", () => {
    const images = seedCards.flatMap((card) => card.imageUrl ? [card.imageUrl] : []);
    expect(images.length).toBeGreaterThan(10);
    expect(images.every((image) => image.startsWith("/activity-images/") && image.endsWith(".webp"))).toBe(true);
  });
});
