import { NextRequest, NextResponse } from "next/server";
import { seedCards, seedSchedule } from "@/data/seed";
import { newShareToken, hashShareToken } from "@/lib/server";
import { isSupabaseServerConfigured, requestUser, serviceSupabase } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  if (!isSupabaseServerConfigured) return NextResponse.json({ error: "Supabase 未配置" }, { status: 503 });
  const user = await requestUser(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "匿名会话无效" }, { status: 401 });
  const token = newShareToken();
  const supabase = serviceSupabase();
  const { data: trip, error } = await supabase.from("trips").insert({
    share_token_hash: hashShareToken(token),
    title: "四个人的小小新加坡",
    timezone: "Asia/Singapore",
    revision: 1,
    party: { adults: 2, children: 2, childAges: [6, 6], childMinHeightCm: 110 },
  }).select("id,revision").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const writes = await Promise.all([
    supabase.from("trip_members").insert({ trip_id: trip.id, user_id: user.id }),
    supabase.from("activity_cards").insert(seedCards.map((card) => ({ trip_id: trip.id, card_id: card.id, data: card }))),
    supabase.from("scheduled_items").insert(seedSchedule.map((item) => ({ trip_id: trip.id, item_id: item.id, data: item, date: item.date, position: item.position }))),
  ]);
  const writeError = writes.find((result) => result.error)?.error;
  if (writeError) return NextResponse.json({ error: writeError.message }, { status: 500 });
  return NextResponse.json({ tripId: trip.id, token, state: { revision: 1, cards: seedCards, scheduledItems: seedSchedule } });
}

