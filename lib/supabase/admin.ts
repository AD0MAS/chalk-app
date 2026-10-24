import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Server-only Supabase client with the secret key (service_role, bypasses RLS).
 * Used only by the Google Calendar sync (lib/google) and the bank sync (lib/bank): the token / session
 * tables are readable by service_role alone; the Google sync writes just the lessons' gcal_* columns
 * (column-level grant) and the bank sync only inserts payments.
 * Never import this from a client component – "server-only" breaks the build if someone does.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Trūksta NEXT_PUBLIC_SUPABASE_URL arba SUPABASE_SECRET_KEY.");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type AdminClient = ReturnType<typeof createAdminClient>;
