import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { authUrl, isGoogleConfigured, redirectUri, STATE_COOKIE } from "@/lib/google/oauth";

// Nustatymai → "Prijungti Google Calendar": off to Google's consent screen.
// proxy.ts has already checked that Adomas is logged in.
export async function GET(request: NextRequest) {
  if (!isGoogleConfigured()) return NextResponse.redirect(new URL("/nustatymai?google=nenustatyta#google", request.url));

  // Random state in an httpOnly cookie; the callback must get the same value back (CSRF protection).
  const state = randomBytes(24).toString("base64url");
  const response = NextResponse.redirect(authUrl(redirectUri(request.nextUrl.origin), state));
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/google",
    maxAge: 600,
  });
  return response;
}
