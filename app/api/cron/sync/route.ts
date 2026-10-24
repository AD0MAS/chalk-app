import { timingSafeEqual } from "node:crypto";
import { syncBank } from "@/lib/bank/sync";
import { syncCalendar } from "@/lib/google/sync";

// Daily (vercel.json → "crons"; Vercel Hobby allows once a day):
//   * Google Calendar safety net – normally every change is pushed right away and failed ones are retried
//     whenever Chalk is open; this catches anything still pending even if Adomas doesn't open the app;
//   * Bank – new incoming payments, even on days Chalk isn't opened. A background request (no PSU headers):
//     only within the budget of 4 bank requests per 24 h, never while rate-limited (lib/bank/budget.ts).
//
// Vercel calls it with "Authorization: Bearer <CRON_SECRET>". proxy.ts skips /api/cron, so this check
// is the only lock: without CRON_SECRET set, the route refuses everything.

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) return new Response(null, { status: 401 });
  // Independent: one failing never stops the other (both already store their own errors).
  const [google, bank] = await Promise.allSettled([syncCalendar(), syncBank({ mode: "cron" })]);
  // Only counts and states – never lesson or payment data – so the Vercel logs stay free of personal details.
  return Response.json({
    google: google.status === "fulfilled" ? { state: google.value.state, pending: google.value.pending, failed: google.value.failed } : { state: "error" },
    bank: bank.status === "fulfilled" ? { state: bank.value.state, imported: bank.value.imported ?? 0, skipped: bank.value.skipped ?? null, budgetLeft: bank.value.budgetLeft } : { state: "error" },
  });
}
