import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 "proxy" (formerly middleware): every page requires Adomas to be logged in.
// Public on purpose (skipped by the matcher below): /privatumas (Google's consent screen links to it),
// /api/cron/* (Vercel Cron – the route checks CRON_SECRET itself), robots.txt, the PWA manifest and icons.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Everything except Next.js internals (/_next/static, /_next/image, dev HMR …), the public paths and static files.
    "/((?!_next/|privatumas$|api/cron/|robots\\.txt$|manifest\\.webmanifest$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
