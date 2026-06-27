import type { ActivityCard, PriceQuote, RouteFareEstimate, RouteOption, ScheduledItem } from "@/types/trip";

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

const transitFareBands = [
  [3.2, 1.28, 0.52], [4.2, 1.38, 0.60], [5.2, 1.49, 0.66], [6.2, 1.59, 0.71],
  [7.2, 1.68, 0.74], [8.2, 1.75, 0.78], [9.2, 1.82, 0.78], [10.2, 1.86, 0.78],
  [11.2, 1.90, 0.78], [12.2, 1.94, 0.78], [13.2, 1.98, 0.78], [14.2, 2.02, 0.78],
  [15.2, 2.07, 0.78], [16.2, 2.11, 0.78], [17.2, 2.15, 0.78], [18.2, 2.20, 0.78],
  [19.2, 2.24, 0.78], [20.2, 2.27, 0.78], [21.2, 2.30, 0.78], [22.2, 2.33, 0.78],
  [23.2, 2.36, 0.78], [24.2, 2.38, 0.78], [25.2, 2.40, 0.78], [26.2, 2.42, 0.78],
  [27.2, 2.43, 0.78], [28.2, 2.44, 0.78], [29.2, 2.45, 0.78], [30.2, 2.46, 0.78],
  [31.2, 2.47, 0.78], [32.2, 2.48, 0.78], [33.2, 2.49, 0.78], [34.2, 2.50, 0.78],
  [35.2, 2.51, 0.78], [36.2, 2.52, 0.78], [37.2, 2.53, 0.78], [38.2, 2.54, 0.78],
  [39.2, 2.55, 0.78], [40.2, 2.56, 0.78], [Infinity, 2.57, 0.78],
] as const;

const roundFare = (value: number) => Math.round(value * 10) / 10;
const fareLabel = (min: number, max: number) => min === max ? `S$${min === 0 ? "0" : min.toFixed(2)}` : `S$${min.toFixed(2)}–${max.toFixed(2)}`;

export function estimateFamilyRouteFare(
  route: Pick<RouteOption, "mode" | "distanceMeters">,
  departureTime: string,
): RouteFareEstimate {
  const checkedAt = "2026-06-28";
  if (route.mode === "walk") {
    return { min: 0, max: 0, label: "S$0", note: "全家步行，无交通票价", sourceUrl: "https://www.google.com/maps", checkedAt };
  }
  if (route.mode === "transit") {
    const km = route.distanceMeters / 1000;
    const [, adult, child] = transitFareBands.find(([limit]) => km <= limit)!;
    const min = roundFare(adult * 2 + child * 2);
    const max = roundFare(adult * 4);
    return {
      min,
      max,
      label: fareLabel(min, max),
      note: "下限含两名儿童优惠票；上限按四人普通卡，资格及实际线路为准",
      sourceUrl: "https://www.ptc.gov.sg/fares/public-transport-fares-and-passes/",
      checkedAt,
    };
  }
  const distance = Math.max(1000, route.distanceMeters);
  const throughTenKm = Math.max(0, Math.min(distance, 10_000) - 1000);
  const afterTenKm = Math.max(0, distance - 10_000);
  const meterFare = 4.6 + Math.ceil(throughTenKm / 400) * 0.27 + Math.ceil(afterTenKm / 350) * 0.27;
  const departure = toMinutes(departureTime);
  const surchargePeriod = (departure >= 6 * 60 && departure < 9 * 60 + 30) || departure >= 18 * 60;
  const min = roundFare(meterFare);
  const max = roundFare(meterFare * (surchargePeriod ? 1.45 : 1.2));
  return {
    min,
    max,
    label: fareLabel(min, max),
    note: "一车家庭价估算；不含 ERP、机场、预约费及动态一口价",
    sourceUrl: "https://www.cdgtaxi.com.sg/ride-with-us/fares/",
    checkedAt,
  };
}

export function sortDayItems(items: ScheduledItem[]) {
  return [...items].sort((a, b) => a.position - b.position || a.startTime.localeCompare(b.startTime));
}
