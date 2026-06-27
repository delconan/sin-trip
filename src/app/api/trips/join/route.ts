import { NextRequest, NextResponse } from "next/server";
import { hashShareToken, isValidShareToken } from "@/lib/server";
import { isSupabaseServerConfigured, requestUser, serviceSupabase } from "@/lib/supabase/server";
import { loadTripState } from "@/lib/trip-server";

export async function POST(request: NextRequest) {
  if (!isSupabaseServerConfigured) return NextResponse.json({ error: "Supabase 未配置" }, { status: 503 });
  const user = await requestUser(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "匿名会话无效" }, { status: 401 });
  const { token } = await request.json() as { token?: string };
  if (!token || !isValidShareToken(token)) return NextResponse.json({ error: "分享链接无效" }, { status: 400 });
  const supabase = serviceSupabase();
  const { data: trip } = await supabase.from("trips").select("id").eq("share_token_hash", hashShareToken(token)).maybeSingle();
  if (!trip) return NextResponse.json({ error: "分享链接已失效" }, { status: 404 });
  const { error } = await supabase.from("trip_members").upsert({ trip_id: trip.id, user_id: user.id }, { onConflict: "trip_id,user_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tripId: trip.id, state: await loadTripState(trip.id) });
}

