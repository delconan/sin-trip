import { NextRequest, NextResponse } from "next/server";
import { requestSupabase, requestUser } from "@/lib/supabase/server";
import { isTripMember, loadTripState } from "@/lib/trip-server";
import type { TripState } from "@/types/trip";

export async function GET(request: NextRequest) {
  const user = await requestUser(request.headers.get("authorization"));
  const tripId = request.nextUrl.searchParams.get("tripId");
  if (!user || !tripId || !(await isTripMember(tripId, user.id))) return NextResponse.json({ error: "无权读取此行程" }, { status: 403 });
  return NextResponse.json({ state: await loadTripState(tripId) });
}

export async function PUT(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const user = await requestUser(authorization);
  const { tripId, expectedRevision, state } = await request.json() as { tripId: string; expectedRevision: number; state: TripState };
  if (!user || !tripId || !(await isTripMember(tripId, user.id))) return NextResponse.json({ error: "无权修改此行程" }, { status: 403 });
  const { data, error } = await requestSupabase(authorization).rpc("replace_trip_state", {
    p_trip_id: tripId,
    p_expected_revision: expectedRevision,
    p_day_titles: state.dayTitles,
    p_cards: state.cards,
    p_items: state.scheduledItems,
  });
  if (error?.message.includes("revision_conflict")) return NextResponse.json({ error: "版本冲突", state: await loadTripState(tripId) }, { status: 409 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ revision: Number(data) });
}
