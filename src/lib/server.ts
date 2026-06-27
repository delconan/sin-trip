import { createHash, randomBytes } from "node:crypto";

export function newShareToken() {
  return randomBytes(16).toString("hex");
}

export function hashShareToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isValidShareToken(token: string) {
  return /^[a-f0-9]{32}$/i.test(token);
}

export function buildOneMapRouteUrl({
  start,
  end,
  routeType,
  date,
  time,
}: {
  start: { latitude: number; longitude: number };
  end: { latitude: number; longitude: number };
  routeType: "walk" | "drive" | "pt";
  date: string;
  time: string;
}) {
  const [year, month, day] = date.split("-");
  const params = new URLSearchParams({
    start: `${start.latitude},${start.longitude}`,
    end: `${end.latitude},${end.longitude}`,
    routeType,
  });
  if (routeType === "pt") {
    params.set("date", `${month}-${day}-${year}`);
    params.set("time", `${time}:00`);
    params.set("mode", "transit");
    params.set("numItineraries", "3");
    params.set("maxWalkDistance", "1200");
  }
  return `https://www.onemap.gov.sg/api/public/routingsvc/route?${params}`;
}
