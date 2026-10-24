import { connection } from "next/server";
import { getSyncInfo, syncCalendar } from "@/lib/google/sync";
import { createClient } from "@/lib/supabase/server";

// The navbar sync dot: GET = current status, POST = sync now (retry) and return the new status.
// Google Calendar only – polled every minute, so it must never call the bank (that is /api/bank/sync).
// proxy.ts lets only Adomas through; the check below is a second lock on the door.

async function loggedIn() {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return !!data?.claims?.sub;
}

export async function GET() {
  if (!(await loggedIn())) return new Response(null, { status: 401 });
  return Response.json(await getSyncInfo());
}

export async function POST() {
  if (!(await loggedIn())) return new Response(null, { status: 401 });
  return Response.json(await syncCalendar());
}
