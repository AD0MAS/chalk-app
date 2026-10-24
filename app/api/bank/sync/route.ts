import { connection } from "next/server";
import { getBankInfo, requestPsuHeaders, syncBank } from "@/lib/bank/sync";
import { createClient } from "@/lib/supabase/server";

// The navbar sync dot, bank part: GET = status, POST = "Chalk was opened" (a real page load, once per load)
// → an attended sync with Adomas's PSU headers, at most every 2 h (lib/bank/budget.ts); otherwise returns the
// status at once. Without PSU headers (localhost) it never asks the bank. Never blocks anything.
// proxy.ts lets only Adomas through; the check below is a second lock on the door.

async function loggedIn() {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return !!data?.claims?.sub;
}

export async function GET() {
  if (!(await loggedIn())) return new Response(null, { status: 401 });
  return Response.json(await getBankInfo());
}

export async function POST() {
  if (!(await loggedIn())) return new Response(null, { status: 401 });
  return Response.json(await syncBank({ mode: "app-open", psu: await requestPsuHeaders() }));
}
