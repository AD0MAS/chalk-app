import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail, LOGIN_PATH, safeNextPath } from "@/lib/auth";
import { devAutoLoginCredentials } from "@/lib/dev-auto-login";
import type { Database } from "./database.types";

/**
 * Runs before every request (see proxy.ts): refreshes the Supabase session cookie
 * and sends anyone who is not Adomas to the login page.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          // Cache headers so a CDN never caches a response that sets auth cookies.
          Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    }
  );

  // Don't put code between createServerClient and getClaims() – it refreshes the session.
  const { data } = await supabase.auth.getClaims();
  let email = typeof data?.claims?.email === "string" ? data.claims.email : null;
  let loggedIn = !!data?.claims;
  const { pathname, search } = request.nextUrl;

  // Development only: sign in automatically (guards in lib/dev-auto-login.ts).
  if (!loggedIn) {
    const dev = devAutoLoginCredentials(request);
    if (dev) {
      const { data: signedIn, error } = await supabase.auth.signInWithPassword(dev);
      if (error) console.warn("[dev auto-login] failed:", error.message);
      else {
        loggedIn = true;
        email = signedIn.user.email ?? null;
      }
    }
  }

  // Someone else somehow has a session: sign them out.
  if (loggedIn && !isAllowedEmail(email)) {
    await supabase.auth.signOut();
    return redirectKeepingCookies(request, response, LOGIN_PATH, { klaida: "neleidziama" });
  }

  if (!loggedIn && pathname !== LOGIN_PATH) {
    return redirectKeepingCookies(request, response, LOGIN_PATH, { next: pathname + search });
  }

  if (loggedIn && pathname === LOGIN_PATH) {
    return redirectKeepingCookies(request, response, safeNextPath(request.nextUrl.searchParams.get("next")));
  }

  return response;
}

// A redirect must carry over the (possibly refreshed) auth cookies, or the session breaks.
function redirectKeepingCookies(
  request: NextRequest,
  from: NextResponse,
  target: string,
  params: Record<string, string> = {}
) {
  const url = new URL(target, request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  from.headers.forEach((value, key) => {
    if (["cache-control", "expires", "pragma"].includes(key)) redirect.headers.set(key, value);
  });
  return redirect;
}
