import { serviceSupabase } from "@/lib/supabase/server";
import type { ActivityCard, ScheduledItem, TripState } from "@/types/trip";

export async function loadTripState(tripId: string): Promise<TripState> {
  const supabase = serviceSupabase();
  const [{ data: trip, error: tripError }, { data: cards, error: cardsError }, { data: items, error: itemsError }] = await Promise.all([
    supabase.from("trips").select("revision").eq("id", tripId).single(),
    supabase.from("activity_cards").select("data").eq("trip_id", tripId).order("created_at"),
    supabase.from("scheduled_items").select("data").eq("trip_id", tripId),
  ]);
  if (tripError || cardsError || itemsError) throw tripError ?? cardsError ?? itemsError;
  return {
    revision: Number(trip.revision),
    cards: (cards ?? []).map((row) => row.data as ActivityCard),
    scheduledItems: (items ?? []).map((row) => row.data as ScheduledItem),
  };
}

export async function isTripMember(tripId: string, userId: string) {
  const { data } = await serviceSupabase().from("trip_members").select("trip_id").eq("trip_id", tripId).eq("user_id", userId).maybeSingle();
  return Boolean(data);
}

