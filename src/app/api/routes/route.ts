import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { estimateRoutes, recommendRoute } from "@/lib/planner";
import { fetchOneMapRoutes, isOneMapConfigured } from "@/lib/onemap";

const place = z.object({ title: z.string(), latitude: z.number(), longitude: z.number() });
const schema = z.object({
  start: place,
  end: place,
  date: z.string().regex(/^2026-07-(07|08|09|10)$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  hasLuggage: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (body === null) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { start, end, date, time, hasLuggage } = parsed.data;
  if (isOneMapConfigured()) {
    try {
      const routes = await fetchOneMapRoutes({ start, end, date, time });
      const recommendation = recommendRoute(routes, { departureTime: time, hasLuggage });
      return NextResponse.json({ routes: routes.map((route) => ({ ...route, recommended: route.mode === recommendation?.mode })), source: "onemap" });
    } catch { /* fall through to local estimate */ }
  }
  return NextResponse.json({ routes: estimateRoutes(start, end, time, hasLuggage), source: "estimate" });
}
