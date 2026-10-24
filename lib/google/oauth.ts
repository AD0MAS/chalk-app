import "server-only";

// Google OAuth 2.0 for a web server app (developers.google.com/identity/protocols/oauth2/web-server).
// Plain fetch – no Google SDK needed for four endpoints.

/** The narrowest Calendar scope: create secondary calendars and manage events only on calendars Chalk made. */
export const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.app.created";

export const STATE_COOKIE = "chalk_google_state";

export const isGoogleConfigured = () => !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

/** Must match an "Authorized redirect URI" of the OAuth client exactly. */
export const redirectUri = (origin: string) => `${origin}/api/google/callback`;

export function authUrl(redirect: string, state: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirect,
    response_type: "code",
    scope: GOOGLE_SCOPE,
    access_type: "offline", // → refresh token
    prompt: "consent", // always return a refresh token, also on reconnect
    state,
  }).toString();
  return url.toString();
}

type TokenResponse = { access_token: string; expires_in: number; scope?: string; refresh_token?: string };

export class GoogleAuthError extends Error {
  revoked: boolean;
  constructor(message: string, revoked: boolean) {
    super(message);
    this.revoked = revoked;
  }
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      ...params,
    }),
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // invalid_grant = the refresh token was revoked or expired → reconnect needed
    throw new GoogleAuthError(`Google token: ${body.error ?? res.status}`, body.error === "invalid_grant");
  }
  return body as TokenResponse;
}

export const exchangeCode = (code: string, redirect: string) =>
  tokenRequest({ code, redirect_uri: redirect, grant_type: "authorization_code" });

// Access tokens live ~1 h; keep the current one in memory instead of refreshing on every sync.
let cached: { refreshToken: string; accessToken: string; expiresAt: number } | null = null;

export function rememberAccessToken(refreshToken: string, accessToken: string, expiresIn: number) {
  cached = { refreshToken, accessToken, expiresAt: Date.now() + (expiresIn - 60) * 1000 };
}

export async function accessToken(refreshToken: string) {
  if (cached && cached.refreshToken === refreshToken && cached.expiresAt > Date.now()) return cached.accessToken;
  const t = await tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" });
  rememberAccessToken(refreshToken, t.access_token, t.expires_in);
  return t.access_token;
}

/** Best effort: tell Google to forget the grant (Atjungti). */
export async function revokeToken(token: string) {
  cached = null;
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  }).catch(() => undefined);
}
