import { NextResponse, type NextRequest } from "next/server";
import { BANK_STATE_COOKIE as STATE_COOKIE, isBankConfigured, newState, startAuth } from "@/lib/bank/enable-banking";

// Nustatymai → "Prijungti banką" / "Pratęsti": off to Enable Banking → the bank's login.
// proxy.ts has already checked that Adomas is logged in.

export async function GET(request: NextRequest) {
  const back = (result: string) => NextResponse.redirect(new URL(`/nustatymai?bankas=${result}#bankas`, request.url));
  if (!isBankConfigured()) return back("nenustatyta");

  // Random state in an httpOnly cookie; the callback must get the same value back (CSRF protection).
  const state = newState();
  let url: string;
  try {
    url = await startAuth(`${request.nextUrl.origin}/api/bank/callback`, state);
  } catch (e) {
    console.error("Bank connect:", e instanceof Error ? e.message : e);
    return back("klaida");
  }
  const response = NextResponse.redirect(url);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/bank",
    maxAge: 15 * 60,
  });
  return response;
}
