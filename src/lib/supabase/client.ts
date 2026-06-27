import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | undefined;

export const isSupabaseBrowserConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

export function browserSupabase() {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase browser credentials are not configured");
  browserClient = createClient(url, key);
  return browserClient;
}

