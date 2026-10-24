import { CalendarCheck } from "lucide-react";
import { formatDateLong, vilniusParts } from "@/lib/lessons/time";
import { isGoogleConfigured } from "@/lib/google/oauth";
import { getSyncInfo } from "@/lib/google/sync";
import type { SyncInfo } from "@/lib/google/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { btn, card } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { GoogleActions } from "./google-actions";

// Nustatymai → Google Calendar (docs/SPEC.md §2, §3.10). Server component: the token never leaves the server.

const RESULTS: Record<string, string> = {
  prijungta: "Google Calendar prijungtas. Pamokos keliauja į kalendorių „Pamokos“.",
  atsisakyta: "Prijungimas atšauktas.",
  "be-teisiu": "Google nedavė teisės valdyti kalendoriaus – pažymėk ją prisijungdamas.",
  nenustatyta: "Trūksta GOOGLE_CLIENT_ID ir GOOGLE_CLIENT_SECRET faile .env.local.",
  klaida: "Nepavyko prijungti Google Calendar. Bandyk dar kartą.",
};

const PILL: Record<SyncInfo["state"], { className: string; text: (i: SyncInfo) => string }> = {
  synced: { className: "bg-sage-tint text-sage-ink", text: () => "Sinchronizuota" },
  syncing: { className: "bg-sand-tint text-sand-ink", text: (i) => `Sinchronizuojama · ${i.pending}` },
  error: { className: "bg-coral-tint text-coral-ink", text: (i) => (i.failed ? `Nesinchronizuota · ${i.failed}` : "Klaida") },
  off: { className: "bg-muted text-muted-foreground", text: () => "Neprijungta" },
};

const when = (iso: string) => {
  const { date, time } = vilniusParts(iso);
  return `${formatDateLong(date)}, ${time}`;
};

export async function GoogleCalendarSection({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const [{ google }, ownerId] = await Promise.all([searchParams, currentUserId()]);
  const configured = isGoogleConfigured();
  const admin = createAdminClient();

  const [{ data: conn }, info, { data: failed }] = await Promise.all([
    admin.from("google_connection").select("refresh_token, calendar_id, connected_at").eq("owner_id", ownerId).maybeSingle(),
    getSyncInfo(admin),
    admin
      .from("lessons")
      .select("id, starts_at, gcal_error, students(first_name)")
      .eq("owner_id", ownerId)
      .eq("gcal_dirty", true)
      .not("gcal_error", "is", null)
      .order("starts_at")
      .limit(5),
  ]);
  const connected = configured && !!conn?.refresh_token && !!conn.calendar_id;
  const pill = PILL[connected ? info.state : "off"];

  return (
    <section id="google" aria-labelledby="google-title" className={cn(card, "scroll-mt-nav px-5 py-5")}>
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-pill border bg-background">
          <CalendarCheck aria-hidden="true" className="size-5" strokeWidth={1.75} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 id="google-title" className="font-medium">
            Google Calendar
          </h2>
          <span className="truncate-name text-sm text-muted-foreground">
            {connected ? "Kalendorius „Pamokos“" : "Neprijungtas"}
          </span>
        </div>
        <span className={cn("inline-flex h-6 shrink-0 items-center rounded-pill px-2.5 text-[13px] font-medium tabular-nums", pill.className)}>
          {pill.text(info)}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-2 text-sm leading-5 text-muted-foreground">
        {!configured ? (
          <p>
            Trūksta <code>GOOGLE_CLIENT_ID</code> ir <code>GOOGLE_CLIENT_SECRET</code> faile <code>.env.local</code>.
          </p>
        ) : connected ? (
          <>
            <p>
              Chalk pats kuria, keičia ir trina pamokų įvykius kalendoriuje „Pamokos“. Kitų tavo kalendorių Chalk nemato ir
              nekeičia. Pamokas keisk Chalk’e – Google’e padaryti pakeitimai bus perrašyti.
            </p>
            <div className="flex flex-col tabular-nums">
              {conn?.connected_at ? (
                <p>
                  Prijungta <span className="whitespace-nowrap">{when(conn.connected_at)}</span>
                </p>
              ) : null}
              {info.lastSyncAt ? (
                <p>
                  Paskutinė sinchronizacija <span className="whitespace-nowrap">{when(info.lastSyncAt)}</span>
                </p>
              ) : null}
            </div>
            {info.message ? <p className="text-coral-ink">{info.message}</p> : null}
          </>
        ) : (
          <p>
            Chalk sukurs atskirą kalendorių „Pamokos“ ir jame laikys visas pamokas (pavadinimas „Vardas 11 kl A“, aprašyme
            Meet nuoroda). Kitų tavo kalendorių Chalk nemato ir nekeičia.
          </p>
        )}
      </div>

      {connected && failed?.length ? (
        <div className="mt-4 rounded-tile border px-4 py-3">
          <h3 className="text-sm font-medium">Nesinchronizuotos pamokos</h3>
          <ul className="mt-1.5 flex flex-col gap-1 text-sm">
            {failed.map((lesson) => (
              <li key={lesson.id} className="flex min-w-0 gap-2" title={lesson.gcal_error ?? undefined}>
                <span className="truncate-name min-w-0">{lesson.students?.first_name ?? "Mokinys"}</span>
                <span className="shrink-0 text-muted-foreground tabular-nums">{when(lesson.starts_at)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[13px] text-muted-foreground">Chalk bandys dar kartą automatiškai.</p>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {connected ? (
          <GoogleActions result={google ? (RESULTS[google] ?? null) : null} />
        ) : (
          <>
            {configured ? (
              <a href="/api/google/connect" className={btn.primary}>
                Prijungti Google Calendar
              </a>
            ) : null}
            <GoogleActions result={google ? (RESULTS[google] ?? null) : null} connected={false} />
          </>
        )}
      </div>
    </section>
  );
}

async function currentUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) throw new Error("Neprisijungta.");
  return id;
}
