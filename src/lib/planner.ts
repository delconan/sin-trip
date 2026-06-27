import type { ActivityCard, PriceQuote, RouteOption, ScheduledItem } from "@/types/trip";

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const formatMinutes = (minutes: number) => {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
};

export function calculateFamilyPrice(price: Pick<PriceQuote, "adult" | "child">) {
  if (price.adult === undefined || price.child === undefined) return undefined;
  return price.adult * 2 + price.child * 2;
}

export function getEndTime(startTime: string, durationMinutes: number) {
  return formatMinutes(toMinutes(startTime) + durationMinutes);
}

export function minutesBetween(start: string, end: string) {
  return toMinutes(end) - toMinutes(start);
}

export function isWithinOpeningHours(card: ActivityCard, date: string, startTime: string) {
  const windows = card.openingHours?.[date] ?? card.openingHours?.default;
  if (!windows?.length) return true;
  const start = toMinutes(startTime);
  const end = start + card.durationMinutes;
  return windows.some((window) => start >= toMinutes(window.start) && end <= toMinutes(window.end));
}

export function detectScheduleWarnings({
  item,
  card,
  previousEndTime,
  transferMinutes = 0,
}: {
  item: ScheduledItem;
  card: ActivityCard;
  previousEndTime?: string;
  transferMinutes?: number;
}) {
  const warnings: string[] = [];
  if (!isWithinOpeningHours(card, item.date, item.startTime)) warnings.push("营业时间外");
  if (previousEndTime) {
    const gap = minutesBetween(previousEndTime, item.startTime);
    if (gap < 0) warnings.push(`与上一活动重叠 ${Math.abs(gap)} 分钟`);
    else if (gap < transferMinutes) warnings.push(`交通时间不足 ${transferMinutes - gap} 分钟`);
  }
  return warnings;
}

export function recommendRoute(
  routes: RouteOption[],
  context: { departureTime: string; hasLuggage: boolean },
) {
  if (!routes.length) return undefined;
  const walk = routes.find((route) => route.mode === "walk");
  const transit = routes.find((route) => route.mode === "transit");
  const taxi = routes.find((route) => route.mode === "taxi");
  if (walk && walk.durationMinutes <= 15 && walk.distanceMeters <= 1200) return walk;
  const late = toMinutes(context.departureTime) >= 18 * 60 + 30;
  if (taxi && (late || context.hasLuggage || (transit && transit.durationMinutes - taxi.durationMinutes > 20))) return taxi;
  return transit ?? taxi ?? walk ?? routes[0];
}

type Place = { title: string; latitude: number; longitude: number };

function distanceMeters(from: Place, to: Place) {
  const radius = 6_371_000;
  const radians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = radians(to.latitude - from.latitude);
  const deltaLng = radians(to.longitude - from.longitude);
  const lat1 = radians(from.latitude);
  const lat2 = radians(to.latitude);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return Math.round(radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function estimateRoutes(from: Place, to: Place, departureTime: string, hasLuggage = false) {
  const distance = distanceMeters(from, to);
  const minutes = (speedKmh: number, overhead: number) => Math.max(2, Math.round((distance / 1000 / speedKmh) * 60 + overhead));
  const destination = encodeURIComponent(`${to.latitude},${to.longitude}`);
  const origin = encodeURIComponent(`${from.latitude},${from.longitude}`);
  const base = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
  const routes: RouteOption[] = [
    { mode: "walk", durationMinutes: minutes(4.5, 1), distanceMeters: distance, summary: `步行约 ${(distance / 1000).toFixed(1)} km`, recommended: false, mapsUrl: `${base}&travelmode=walking` },
    { mode: "transit", durationMinutes: minutes(16, 9), distanceMeters: Math.round(distance * 1.18), summary: "地铁 / 公交建议", recommended: false, mapsUrl: `${base}&travelmode=transit` },
    { mode: "taxi", durationMinutes: minutes(28, 5), distanceMeters: Math.round(distance * 1.1), summary: "Grab / 出租车预计", recommended: false, mapsUrl: `${base}&travelmode=driving` },
  ];
  const recommendation = recommendRoute(routes, { departureTime, hasLuggage });
  return routes.map((route) => ({ ...route, recommended: route.mode === recommendation?.mode }));
}

export function sortDayItems(items: ScheduledItem[]) {
  return [...items].sort((a, b) => a.position - b.position || a.startTime.localeCompare(b.startTime));
}
