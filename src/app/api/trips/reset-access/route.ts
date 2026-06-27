import { NextRequest, NextResponse } from "next/server";
import { hashShareToken, newShareToken } from "@/lib/server";
import { requestUser, serviceSupabase } from "@/lib/supabase/server";
import { isTripMember } from "@/lib/trip-server";

export async function POST(request: NextRequest) {
  const user = await requestUser(request.headers.get("authorization"));
  const { tripId } = await request.json() as { tripId: string };
  if (!user || !(await isTripMember(tripId, user.id))) return NextResponse.json({ error: "无权重置访问" }, { status: 403 });
  const token = newShareToken();
  const supabase = serviceSupabase();
  const { error } = await supabase.from("trips").update({ share_token_hash: hashShareToken(token) }).eq("id", tripId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from("trip_members").delete().eq("trip_id", tripId).neq("user_id", user.id);
  return NextResponse.json({ token });
}

