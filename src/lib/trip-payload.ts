import { z } from "zod";
import { tripDays } from "@/data/seed";
import { normalizeTripState } from "@/lib/trip-state";
import type { TripState } from "@/types/trip";

const shortText = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();
const clockTime = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const quarterHour = z.string().regex(/^(?:[01]\d|2[0-3]):(?:00|15|30|45)$/);
const supportedDates = new Set<string>(tripDays.map((day) => day.date));

const openingWindowSchema = z.object({
  start: clockTime,
  end: clockTime,
}).strict();

const priceSchema = z.object({
  currency: z.literal("SGD"),
  adult: z.number().nonnegative().max(100_000).optional(),
  child: z.number().nonnegative().max(100_000).optional(),
  familyTotal: z.number().nonnegative().max(100_000).optional(),
  kind: z.enum(["exact", "from", "range", "free"]),
  source: z.enum(["klook", "official", "manual"]),
  sourceUrl: optionalText(2_000),
  checkedAt: shortText(40),
  note: optionalText(1_000),
}).strict();

const activityCardSchema = z.object({
  id: shortText(120),
  title: shortText(160),
  subtitle: optionalText(300),
  category: z.enum(["attraction", "food", "shopping", "rest", "transport"]),
  description: z.string().max(5_000),
  address: shortText(1_000),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  durationMinutes: z.number().int().min(15).max(720).refine((value) => value % 15 === 0),
  openingHours: z.record(z.string().max(40), z.array(openingWindowSchema).max(12)).optional(),
  price: priceSchema.optional(),
  imageUrl: optionalText(2_000),
  imageCredit: optionalText(500),
  imageSourceUrl: optionalText(2_000),
  bookingUrl: optionalText(2_000),
  constraints: z.array(z.string().max(500)).max(30).optional(),
  tags: z.array(z.string().max(80)).max(50),
  accent: z.enum(["leaf", "sun", "chilli", "sky", "night"]).optional(),
  custom: z.boolean().optional(),
  reservationStatus: z.enum(["required", "booked"]).optional(),
}).strict();

const scheduledItemSchema = z.object({
  id: shortText(120),
  cardId: shortText(120),
  date: z.string().refine((value) => supportedDates.has(value), "不支持的旅行日期"),
  startTime: quarterHour,
  position: z.number().int().nonnegative().max(500),
  notes: optionalText(2_000),
  version: z.number().int().nonnegative().max(1_000_000).optional(),
}).strict();

const tripStateSchema = z.object({
  revision: z.number().int().positive().max(1_000_000_000),
  dayTitles: z.record(z.string(), z.string().trim().min(1).max(40)).refine(
    (titles) => Object.keys(titles).every((date) => supportedDates.has(date)),
    "行程标题包含不支持的日期",
  ),
  cards: z.array(activityCardSchema).max(500),
  scheduledItems: z.array(scheduledItemSchema).max(500),
}).strict();

export function parseTripSnapshot(input: unknown): TripState {
  const state = tripStateSchema.parse(input) as TripState;
  const cardIds = new Set(state.cards.map((card) => card.id));
  if (cardIds.size !== state.cards.length) throw new Error("卡片编号重复");
  const itemIds = new Set(state.scheduledItems.map((item) => item.id));
  if (itemIds.size !== state.scheduledItems.length) throw new Error("行程项目编号重复");
  if (state.scheduledItems.some((item) => !cardIds.has(item.cardId))) {
    throw new Error("行程项目引用了不存在的卡片");
  }
  return normalizeTripState(state);
}
