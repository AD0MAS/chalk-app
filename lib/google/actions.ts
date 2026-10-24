"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revokeToken } from "./oauth";
import { syncCalendar } from "./sync";
import type { SyncInfo } from "./types";

// Nustatymai → Google Calendar buttons.

/** The admin client bypasses RLS, so make sure Adomas himself is asking (proxy.ts checks this too). */
async function requireUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) throw new Error("Neprisijungta.");
  return id;
}

/** "Sinchronizuoti iš naujo": re-sends every lesson and removes Chalk events whose lesson is gone. */
export async function resyncGoogle(): Promise<SyncInfo> {
  await requireUserId();
  const info = await syncCalendar({ full: true });
  revalidatePath("/", "layout");
  return info;
}

/**
 * "Atjungti": revokes Chalk's access and forgets the token. The "Pamokos" calendar and its events
 * stay in Google; its id is kept so that reconnecting continues in the same calendar.
 */
export async function disconnectGoogle() {
  const ownerId = await requireUserId();
  const admin = createAdminClient();
  const { data } = await admin.from("google_connection").select("refresh_token").eq("owner_id", ownerId).maybeSingle();
  if (data?.refresh_token) await revokeToken(data.refresh_token);
  const { error } = await admin
    .from("google_connection")
    .update({ refresh_token: null, scope: null, last_error: null, sync_lock_until: null })
    .eq("owner_id", ownerId);
  if (error) throw new Error("Nepavyko atjungti.");
  revalidatePath("/", "layout");
}
