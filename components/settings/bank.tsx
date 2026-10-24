import { Landmark } from "lucide-react";
import { connection } from "next/server";
import { BANK_IMPORT_FROM, maskIban, type BankState } from "@/lib/bank/constants";
import { isBankConfigured } from "@/lib/bank/enable-banking";
import { UNATTENDED_LIMIT } from "@/lib/bank/budget";
import { aroundTime, bankInfoOf, loadBankConnection } from "@/lib/bank/sync";
import { formatDateLong, vilniusParts } from "@/lib/lessons/time";
import { plural } from "@/lib/plural";
import { createAdminClient } from "@/lib/supabase/admin";
import { btn, card } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { BankActions } from "./bank-actions";

// Nustatymai → Bankas (docs/SPEC.md §1 Payments, §3.10): connection, last sync, consent expiry + "Pratęsti".
// Server component: the Enable Banking session never leaves the server.

const RESULTS: Record<string, string> = {
  prijungta: "Bankas prijungtas. Pirmas importas laukia tavo patvirtinimo.",
  pratesta: "Sutikimas pratęstas. Chalk tikrina naujus mokėjimus.",
  atsisakyta: "Prijungimas atšauktas.",
  "be-saskaitu": "Bankas negrąžino nė vienos sąskaitos – Enable Banking'e susiek savo banko sąskaitą.",
  nenustatyta: "Trūksta ENABLE_BANKING_APP_ID ir ENABLE_BANKING_PRIVATE_KEY.",
  klaida: "Nepavyko prijungti banko. Bandyk dar kartą.",
};

const PILL: Record<Exclude<BankState, "off">, { className: string; text: (days: number | null) => string }> = {
  ok: { className: "bg-sage-tint text-sage-ink", text: () => "Sinchronizuota" },
  review: { className: "bg-sand-tint text-sand-ink", text: () => "Laukia patvirtinimo" },
  warning: { className: "bg-sand-tint text-sand-ink", text: (d) => `Baigsis po ${d} d.` },
  limited: { className: "bg-sand-tint text-sand-ink", text: () => "Bankas riboja" },
  error: { className: "bg-coral-tint text-coral-ink", text: () => "Klaida" },
  expired: { className: "bg-coral-tint text-coral-ink", text: () => "Sutikimas baigėsi" },
};

const when = (iso: string) => {
  const { date, time } = vilniusParts(iso);
  return `${formatDateLong(date)}, ${time}`;
};

export async function BankSection({ searchParams }: { searchParams: Promise<{ bankas?: string }> }) {
  await connection(); // request-time: the consent countdown uses the current time
  const { bankas } = await searchParams;
  const result = bankas ? (RESULTS[bankas] ?? null) : null;
  const configured = isBankConfigured();
  const conn = configured ? await loadBankConnection(createAdminClient()) : null;
  const info = bankInfoOf(conn);

  const header = (subtitle: string, pill?: React.ReactNode) => (
    <div className="flex items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-pill border bg-background">
        <Landmark aria-hidden="true" className="size-5" strokeWidth={1.75} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <h2 id="bankas-title" className="font-medium">
          Bankas
        </h2>
        <span className="truncate-name text-sm text-muted-foreground">{subtitle}</span>
      </div>
      {pill}
    </div>
  );

  if (!conn || info.state === "off") {
    return (
      <section id="bankas" aria-labelledby="bankas-title" className={cn(card, "scroll-mt-nav px-5 py-5")}>
        {header("Neprijungta", <span className="inline-flex h-6 shrink-0 items-center rounded-pill bg-muted px-2.5 text-[13px] font-medium text-muted-foreground">Neprijungta</span>)}
        <div className="mt-4 flex flex-col gap-2 text-sm leading-5 text-muted-foreground">
          {configured ? (
            <p>
              Chalk per Enable Banking skaitys tik gautus mokėjimus į tavo banko sąskaitą (nuo {formatDateLong(BANK_IMPORT_FROM)}) ir priskirs juos mokiniams.
              Pinigų judinti Chalk negali. Prisijungsi prie banko su Smart-ID.
            </p>
          ) : (
            <p>
              Trūksta <code>ENABLE_BANKING_APP_ID</code> ir <code>ENABLE_BANKING_PRIVATE_KEY</code>. Kol jų nėra, mokėjimus gali įkelti iš išrašo (Mokėjimai → „Įkelti išrašą“).
            </p>
          )}
        </div>
        {configured && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <a href="/api/bank/connect" className={btn.primary}>
              Prijungti banką
            </a>
          </div>
        )}
        <BankActions result={result} connected={false} />
      </section>
    );
  }

  const state = info.state as Exclude<BankState, "off">;
  const pill = PILL[state];
  const renewSoon = state === "warning" || state === "expired";
  const validDate = info.validUntil ? vilniusParts(info.validUntil).date : null;

  return (
    <section id="bankas" aria-labelledby="bankas-title" className={cn(card, "scroll-mt-nav px-5 py-5")}>
      {header(
        conn.accounts.length ? conn.accounts.map((a) => maskIban(a.iban)).join(" · ") : "Asmeninė sąskaita",
        <span className={cn("inline-flex h-6 shrink-0 items-center rounded-pill px-2.5 text-[13px] font-medium tabular-nums", pill.className)}>{pill.text(info.daysLeft)}</span>
      )}

      {renewSoon && validDate && (
        <div className="mt-4 rounded-tile bg-sand-tint px-4 py-3 text-sm leading-5 text-sand-ink">
          {state === "expired" ? (
            <>Banko sutikimas baigėsi {formatDateLong(validDate)} – nauji mokėjimai neateina. Spausk „Pratęsti“ ir patvirtink su Smart-ID.</>
          ) : (
            <>
              Banko sutikimas baigsis {formatDateLong(validDate)} (po {plural(info.daysLeft ?? 0, ["dienos", "dienų", "dienų"])}). Pratęsk – užtruks minutę su Smart-ID.
            </>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 text-sm leading-5 text-muted-foreground">
        {state === "review" ? (
          <p className="text-foreground">Pirmas importas laukia tavo patvirtinimo – Chalk dar neįkėlė nė vieno mokėjimo.</p>
        ) : (
          <p>Gauti mokėjimai nuo {formatDateLong(BANK_IMPORT_FROM)}: žinomi mokėtojai priskiriami mokiniams, kiti laukia „Nepriskirti mokėjimai“. Tikrinama atidarius Chalk (ne dažniau kaip kas 2 val.) ir kasdien ryte.</p>
        )}
        {(validDate && !renewSoon) || info.lastSyncAt ? (
          <div className="flex flex-col tabular-nums">
            {validDate && !renewSoon ? (
              <p>
                Sutikimas galioja iki <span className="whitespace-nowrap">{formatDateLong(validDate)}</span>{" "}
                <span className="whitespace-nowrap">· liko {info.daysLeft} d.</span>
              </p>
            ) : null}
            {info.lastSyncAt ? (
              <p>
                Paskutinė sinchronizacija <span className="whitespace-nowrap">{when(info.lastSyncAt)}</span>
                {conn.last_imported !== null ? <span className="whitespace-nowrap"> · naujų: {conn.last_imported}</span> : null}
              </p>
            ) : null}
          </div>
        ) : null}
        {info.message && state !== "expired" ? <p className={state === "error" ? "text-coral-ink" : "text-foreground"}>{info.message}</p> : null}
        {state !== "review" ? (
          <p className="tabular-nums">
            Foninės užklausos bankui (kai Chalk neatidarytas): liko {info.budgetLeft} iš {UNATTENDED_LIMIT} per 24 val.
            {info.budgetFreesAt ? ` · kita atsilaisvins ${aroundTime(info.budgetFreesAt)}` : null}
          </p>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <BankActions
          result={result}
          connected
          canSync={state !== "review" && state !== "expired"}
          limitedUntil={info.retryAfter ? aroundTime(info.retryAfter) : null}
          renewPrimary={renewSoon}
        />
      </div>
    </section>
  );
}
