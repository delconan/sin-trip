import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseServerConfigured = Boolean(url && publishableKey && serviceRoleKey);

export function serviceSupabase() {
  if (!url || !serviceRoleKey) throw new Error("Supabase service credentials are not configured");
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function requestSupabase(authorization: string | null) {
  if (!url || !publishableKey) throw new Error("Supabase public credentials are not configured");
  return createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: authorization ? { Authorization: authorization } : {} },
  });
}

export async function requestUser(authorization: string | null) {
  if (!authorization?.startsWith("Bearer ")) return null;
  const client = requestSupabase(authorization);
  const { data, error } = await client.auth.getUser(authorization.slice(7));
  return error ? null : data.user;
}

