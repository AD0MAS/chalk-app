import { NextResponse, type NextRequest } from "next/server";
import { ensureCalendar } from "@/lib/google/calendar";
import { exchangeCode, GOOGLE_SCOPE, redirectUri, rememberAccessToken, STATE_COOKIE } from "@/lib/google/oauth";
import { scheduleSync } from "@/lib/google/sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Google sends Adomas back here after the consent screen.
// Stores the refresh token server-side only, creates (or reuses) the "Pamokos" calendar
// and starts the first sync in the background.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const back = (result: string) => {
    const response = NextResponse.redirect(new URL(`/nustatymai?google=${result}#google`, request.url));
    response.cookies.set(STATE_COOKIE, "", { path: "/api/google", maxAge: 0 });
    return response;
  };

  if (params.get("error")) return back("atsisakyta"); // "Cancel" on Google's screen
  const state = request.cookies.get(STATE_COOKIE)?.value;
  const code = params.get("code");
  if (!code || !state || params.get("state") !== state) return back("klaida");

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const ownerId = data?.claims?.sub;
  if (!ownerId) return back("klaida");

  try {
    const tokens = await exchangeCode(code, redirectUri(request.nextUrl.origin));
    // Granular consent: the calendar checkbox may have been left unticked.
    if (!tokens.scope?.split(" ").includes(GOOGLE_SCOPE)) return back("be-teisiu");
    if (!tokens.refresh_token) return back("klaida");
    rememberAccessToken(tokens.refresh_token, tokens.access_token, tokens.expires_in);

    const admin = createAdminClient();
    const { data: existing } = await admin.from("google_connection").select("calendar_id").eq("owner_id", ownerId).maybeSingle();
    const calendar = await ensureCalendar(tokens.access_token, existing?.calendar_id ?? null);

    const { error } = await admin.from("google_connection").upsert({
      owner_id: ownerId,
      refresh_token: tokens.refresh_token,
      scope: tokens.scope,
      calendar_id: calendar.id,
      connected_at: new Date().toISOString(),
      last_error: null,
      sync_lock_until: null,
    });
    if (error) throw new Error(`google_connection: ${error.message}`);

    // A brand-new calendar is empty: every lesson has to be sent again.
    if (calendar.created) {
      const { error: markError } = await admin.from("lessons").update({ gcal_dirty: true }).eq("owner_id", ownerId);
      if (markError) throw new Error(`lessons: ${markError.message}`);
    }
  } catch (e) {
    console.error("Google connect:", e);
    return back("klaida");
  }

  scheduleSync();
  return back("prijungta");
}
