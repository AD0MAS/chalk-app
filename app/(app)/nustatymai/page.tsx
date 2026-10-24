import { Download, Link2 } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { quickLinks } from "@/components/navbar/nav-data";
import { MarqueeText } from "@/components/marquee-text";
import { PageHeader } from "@/components/page-header";
import { BankSection } from "@/components/settings/bank";
import { GoogleCalendarSection } from "@/components/settings/google-calendar";
import { TaxSettingsForm } from "@/components/settings/tax-settings";
import { getTaxSettings } from "@/lib/finance/queries";
import { signOut } from "@/lib/auth-actions";
import { createClient } from "@/lib/supabase/server";
import { btn, card } from "@/lib/ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Nustatymai" };

const CSV_EXPORTS = [
  { file: "mokiniai", label: "Mokiniai" },
  { file: "pamokos", label: "Pamokos" },
  { file: "mokejimai", label: "Mokėjimai" },
];

export default function NustatymaiPage({ searchParams }: PageProps<"/nustatymai">) {
  return (
    <div className="mx-auto flex w-full max-w-[720px] animate-enter flex-col gap-4">
      <PageHeader title="Nustatymai" />

      {/* Quick links first: reachable without scrolling. The account is always the last section. */}
      <section id="nuorodos" aria-labelledby="nuorodos-title" className={cn(card, "flex scroll-mt-nav flex-col gap-4 p-5")}>
        <div className="flex items-center gap-3.5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-tile bg-muted">
            <Link2 aria-hidden="true" className="size-[22px]" strokeWidth={1.75} />
          </span>
          <div className="flex min-w-0 flex-col">
            <h2 id="nuorodos-title" className="font-medium">
              Greitosios nuorodos
            </h2>
            <p className="text-sm leading-5 text-muted-foreground">Tos pačios kaip navbar&apos;o meniu „Įrankiai“. Atsidaro naujame skirtuke.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickLinks.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" title={l.description} className={btn.small}>
              <l.icon aria-hidden="true" className="size-4" strokeWidth={1.75} />
              {l.label}
            </a>
          ))}
        </div>
      </section>

      {/* Skeleton heights ≈ the real sections (desktop / phone), so #links below don't shift much while they stream in. */}

      <Suspense fallback={<div className={cn(card, "h-[252px] animate-pulse max-md:h-[312px]")} />}>
        <GoogleCalendarSection searchParams={searchParams as Promise<{ google?: string }>} />
      </Suspense>

      <Suspense fallback={<div className={cn(card, "h-[280px] animate-pulse max-md:h-[432px]")} />}>
        <BankSection searchParams={searchParams as Promise<{ bankas?: string }>} />
      </Suspense>

      <Suspense fallback={<div className={cn(card, "h-[900px] animate-pulse max-md:h-[1320px]")} />}>
        <TaxSection />
      </Suspense>

      <section id="eksportas" aria-labelledby="eksportas-title" className={cn(card, "flex scroll-mt-nav flex-col gap-4 p-5")}>
        <div className="flex items-center gap-3.5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-tile bg-muted">
            <Download aria-hidden="true" className="size-[22px]" strokeWidth={1.75} />
          </span>
          <div className="flex min-w-0 flex-col">
            <h2 id="eksportas-title" className="font-medium">
              Eksportuoti duomenis
            </h2>
            <p className="text-sm leading-5 text-muted-foreground">Visų duomenų kopija tavo kompiuteriui: mokiniai, pamokos, užrašai, spragos, mokėjimai, istorinės pajamos.</p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-3 sm:max-w-[440px]">
          <a href="/api/export?failas=json" download className={cn(btn.small, "w-full bg-primary text-primary-foreground shadow-button hover:bg-primary hover:opacity-90")}>
            <Download aria-hidden="true" className="size-4" strokeWidth={1.75} />
            Viskas (JSON)
          </a>
          <div role="group" aria-labelledby="eksportas-csv" className="flex flex-col gap-1.5">
            <span id="eksportas-csv" className="px-1 text-[13px] leading-[18px] text-muted-foreground">
              CSV
            </span>
            <div className="grid grid-cols-3 gap-2">
              {CSV_EXPORTS.map((e) => (
                <a key={e.file} href={`/api/export?failas=${e.file}`} download className={cn(btn.small, "min-w-0 px-2")}>
                  {e.label}
                </a>
              ))}
            </div>
          </div>
        </div>
        <p className="text-[13px] leading-[18px] text-muted-foreground">
          JSON – pilna visų lentelių kopija. CSV atsidaro Excel&apos;yje (lietuviškas formatas: „;“ ir kablelis).
        </p>
      </section>

      <section aria-labelledby="paskyra" className={cn(card, "flex items-center gap-3 px-5 py-4")}>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-primary font-medium text-primary-foreground">
          A
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 id="paskyra" className="font-medium">
            Adomas
          </h2>
          <Suspense fallback={<span className="h-5 w-48 animate-pulse rounded-pill bg-muted" />}>
            <AccountEmail />
          </Suspense>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="h-10 rounded-pill px-4 text-sm font-medium text-coral-ink transition-colors duration-200 hover:bg-coral-tint"
          >
            Atsijungti
          </button>
        </form>
      </section>

    </div>
  );
}

async function AccountEmail() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims?.email === "string" ? data.claims.email : "";
  return <MarqueeText className="text-sm text-muted-foreground">{`Prisijungta kaip ${email}`}</MarqueeText>;
}

async function TaxSection() {
  return <TaxSettingsForm initial={await getTaxSettings()} />;
}
