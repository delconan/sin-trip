import { NextRequest, NextResponse } from "next/server";
import { isOneMapConfigured, searchOneMapPlaces } from "@/lib/onemap";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query || query.length < 3) return NextResponse.json({ results: [] });
  if (!isOneMapConfigured()) return NextResponse.json({ results: [], source: "unconfigured" });
  try {
    return NextResponse.json({ results: await searchOneMapPlaces(query), source: "onemap" });
  } catch (error) {
    return NextResponse.json({ results: [], error: error instanceof Error ? error.message : "OneMap 查询失败" }, { status: 502 });
  }
}

