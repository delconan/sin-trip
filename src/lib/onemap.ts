import { buildOneMapRouteUrl } from "@/lib/server";
import type { RouteOption } from "@/types/trip";

let tokenCache: { accessToken: string; expiresAt: number } | undefined;

export const isOneMapConfigured = () => Boolean(process.env.ONEMAP_API_EMAIL && process.env.ONEMAP_API_PASSWORD);

async function oneMapToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() / 1000 + 300) return tokenCache.accessToken;
  const email = process.env.ONEMAP_API_EMAIL;
  const password = process.env.ONEMAP_API_PASSWORD;
  if (!email || !password) throw new Error("OneMap credentials are not configured");
  const response = await fetch("https://www.onemap.gov.sg/api/auth/post/getToken", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`OneMap authentication failed: ${response.status}`);
  const data = await response.json() as { access_token: string; expiry_timestamp: string };
  tokenCache = { accessToken: data.access_token, expiresAt: Number(data.expiry_timestamp) };
  return data.access_token;
}

async function oneMapFetch(url: string) {
  const token = await oneMapToken();
  const response = await fetch(url, { headers: { Authorization: token }, cache: "no-store" });
  if (!response.ok) throw new Error(`OneMap request failed: ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(String(data.error));
  return data;
}

export async function searchOneMapPlaces(query: string) {
  const params = new URLSearchParams({ searchVal: query, returnGeom: "Y", getAddrDetails: "Y", pageNum: "1" });
  const data = await oneMapFetch(`https://www.onemap.gov.sg/api/common/elastic/search?${params}`) as {
    results?: Array<{ SEARCHVAL: string; ADDRESS: string; LATITUDE: string; LONGITUDE: string; POSTAL?: string }>;
  };
  return (data.results ?? []).slice(0, 6).map((result) => ({
    title: result.SEARCHVAL,
    address: result.ADDRESS,
    latitude: Number(result.LATITUDE),
    longitude: Number(result.LONGITUDE),
    postal: result.POSTAL,
  }));
}

export async function fetchOneMapRoutes({
  start,
  end,
  date,
  time,
}: {
  start: { latitude: number; longitude: number };
  end: { latitude: number; longitude: number };
  date: string;
  time: string;
}) {
  const modes = ["walk", "pt", "drive"] as const;
  const payloads = await Promise.all(modes.map(async (routeType) => {
    const url = buildOneMapRouteUrl({ start, end, routeType, date, time });
    return { routeType, data: await oneMapFetch(url) };
  }));
  const mapsBase = `https://www.google.com/maps/dir/?api=1&origin=${start.latitude},${start.longitude}&destination=${end.latitude},${end.longitude}`;
  return payloads.map(({ routeType, data }): RouteOption => {
    if (routeType === "pt") {
      const itinerary = data.plan?.itineraries?.[0];
      const legs = itinerary?.legs ?? [];
      return {
        mode: "transit",
        durationMinutes: Math.max(1, Math.round(Number(itinerary?.duration ?? 0) / 60)),
        distanceMeters: Math.round(legs.reduce((sum: number, leg: { distance?: number }) => sum + Number(leg.distance ?? 0), 0)),
        summary: legs.filter((leg: { mode?: string }) => leg.mode !== "WALK").map((leg: { routeShortName?: string; mode?: string }) => leg.routeShortName || leg.mode).join(" → ") || "MRT / 公交",
        recommended: false,
        mapsUrl: `${mapsBase}&travelmode=transit`,
      };
    }
    const summary = data.route_summary ?? {};
    return {
      mode: routeType === "walk" ? "walk" : "taxi",
      durationMinutes: Math.max(1, Math.round(Number(summary.total_time ?? 0) / 60)),
      distanceMeters: Math.round(Number(summary.total_distance ?? 0)),
      summary: routeType === "walk" ? "OneMap 步行路线" : "OneMap 驾车估时",
      recommended: false,
      mapsUrl: `${mapsBase}&travelmode=${routeType === "walk" ? "walking" : "driving"}`,
    };
  });
}

