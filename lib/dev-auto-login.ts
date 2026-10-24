import type { NextRequest } from "next/server";

// Dev auto-login: on `next dev` at localhost, sign Adomas in automatically with DEV_LOGIN_PASSWORD,
// so the login screen doesn't get in the way while building Chalk.
//
// Why this can never run in production – ALL of these must be true:
//  1. process.env.NODE_ENV === "development". Next.js sets NODE_ENV to "production" for
//     `next build` / `next start` and on Vercel, and inlines it at build time – so in a
//     production build this whole branch is dead code, whatever env vars are set.
//  2. The request is for localhost / 127.0.0.1 / [::1] (both the URL host and the Host header).
//  3. DEV_LOGIN_PASSWORD and ALLOWED_EMAIL are set (they live only in .env.local, never in git;
//     don't add DEV_LOGIN_PASSWORD to Vercel).
//  4. Adomas didn't just press "Atsijungti" (that sets DEV_AUTO_LOGIN_OFF_COOKIE).

export const DEV_AUTO_LOGIN_OFF_COOKIE = "chalk_dev_autologin_off";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function devAutoLoginCredentials(request: NextRequest): { email: string; password: string } | null {
  if (process.env.NODE_ENV !== "development") return null;

  const urlHost = request.nextUrl.hostname;
  const headerHost = (request.headers.get("host") ?? "").replace(/:\d+$/, "");
  if (!LOCAL_HOSTS.has(urlHost) || !LOCAL_HOSTS.has(headerHost)) return null;

  if (request.cookies.has(DEV_AUTO_LOGIN_OFF_COOKIE)) return null;

  const email = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  const password = process.env.DEV_LOGIN_PASSWORD;
  if (!email || !password) return null;

  return { email, password };
}
