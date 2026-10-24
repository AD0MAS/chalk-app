"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { allowedEmail, LOGIN_PATH, safeNextPath } from "@/lib/auth";
import { DEV_AUTO_LOGIN_OFF_COOKIE } from "@/lib/dev-auto-login";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { status: "idle" } | { status: "error"; message: string };

const WRONG = "Neteisingas el. paštas arba slaptažodis.";

/** Email + password login – only ALLOWED_EMAIL. No sign-ups (disabled in Supabase). */
export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? "/"));

  if (!email || !password) return { status: "error", message: "Įrašyk el. paštą ir slaptažodį." };

  const allowed = allowedEmail();
  if (!allowed) return { status: "error", message: "Serveryje nenustatytas ALLOWED_EMAIL (.env.local)." };
  // Same message as a wrong password, so the page doesn't reveal who can log in.
  if (email !== allowed) return { status: "error", message: WRONG };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error("signInWithPassword failed:", error.message);
    return { status: "error", message: error.status === 429 ? "Per daug bandymų. Palauk minutę." : WRONG };
  }

  // A manual login turns dev auto-login back on (see lib/dev-auto-login.ts).
  (await cookies()).delete(DEV_AUTO_LOGIN_OFF_COOKIE);
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // In development, remember that Adomas logged out on purpose, so auto-login doesn't log him straight back in.
  if (process.env.NODE_ENV === "development") {
    (await cookies()).set(DEV_AUTO_LOGIN_OFF_COOKIE, "1", { path: "/", httpOnly: true, sameSite: "lax" });
  }
  redirect(LOGIN_PATH);
}
