import { after, NextResponse, type NextRequest } from "next/server";
import { BANK_STATE_COOKIE as STATE_COOKIE, createSession, deleteSession } from "@/lib/bank/enable-banking";
import { requestPsuHeaders, syncBank } from "@/lib/bank/sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Enable Banking sends Adomas back here after the bank login (?code=…&state=…).
// Creates the session and stores it server-side only. "Pratęsti" lands here too: the new session
// replaces the old one (which is closed at the bank). Payments already imported are not touched.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const back = (result: string) => {
    const response = NextResponse.redirect(new URL(`/nustatymai?bankas=${result}#bankas`, request.url));
    response.cookies.set(STATE_COOKIE, "", { path: "/api/bank", maxAge: 0 });
    return response;
  };

  if (params.get("error")) return back("atsisakyta"); // cancelled at the bank / Enable Banking
  const state = request.cookies.get(STATE_COOKIE)?.value;
  const code = params.get("code");
  if (!code || !state || params.get("state") !== state) return back("klaida");

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const ownerId = data?.claims?.sub;
  if (!ownerId) return back("klaida");

  let approved = false;
  try {
    const session = await createSession(code);
    if (!session.accounts.length) return back("be-saskaitu");

    const admin = createAdminClient();
    const { data: old } = await admin.from("bank_connection").select("session_id, import_approved_at").eq("owner_id", ownerId).maybeSingle();
    const { error } = await admin.from("bank_connection").upsert({
      owner_id: ownerId,
      session_id: session.sessionId,
      aspsp_name: session.aspspName,
      accounts: session.accounts,
      valid_until: session.validUntil,
      connected_at: new Date().toISOString(),
      last_error: null,
      last_attempt_at: null,
      sync_lock_until: null,
    });
    if (error) throw new Error(`bank_connection: ${error.message}`);
    if (old?.session_id && old.session_id !== session.sessionId) await deleteSession(old.session_id);
    approved = !!old?.import_approved_at;
  } catch (e) {
    console.error("Bank callback:", e instanceof Error ? e.message : e);
    return back("klaida");
  }

  // Renewed: pick up anything new right away. First time: nothing is imported until Adomas approves.
  if (approved) {
    const psu = await requestPsuHeaders(); // Adomas just came back from the bank – attended
    after(() => syncBank({ mode: "manual", psu }).then(() => undefined, (e) => console.error("Bank sync:", e)));
  }
  return back(approved ? "pratesta" : "prijungta");
}
