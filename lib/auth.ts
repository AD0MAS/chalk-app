// Chalk has exactly one user. Their email comes from the ALLOWED_EMAIL env var (server only).

export function allowedEmail(): string | null {
  const email = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  return email ? email : null;
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  const allowed = allowedEmail();
  return !!allowed && !!email && email.trim().toLowerCase() === allowed;
}

/** Only allow redirects to our own paths ("/mokiniai"), never to other sites ("//evil.com"). */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}

export const LOGIN_PATH = "/prisijungti";
