import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { TaxCardData } from "@/lib/finance/queries";
import { formatDayMonth } from "@/lib/lessons/time";
import { formatEur } from "@/lib/students/constants";
import { formatPercent, gpmDeadline } from "@/lib/tax/constants";
import { card } from "@/lib/ui";
import { cn } from "@/lib/utils";

// Mokesčiai card (SPEC §1 Taxes, canvas "Finansai"): an estimate for the calendar year from money received
// (historical income + student payments). The one soft tint on the screen is the "Atidėk" callout (DESIGN.md §0.3).

const money = (n: number) => formatEur(Math.round(n));

export function TaxCard({ tax, compact = false }: { tax: TaxCardData; compact?: boolean }) {
  const { estimate: e, settings: s } = tax;
  const deadline = gpmDeadline(tax.year);
  const row = "flex items-baseline justify-between gap-3";
  const num = "shrink-0 tabular-nums";
  const gpmRate = e.taxable > 0 ? e.gpm / e.taxable : s.gpm_rate - s.credit_rate;

  return (
    <section
      id="mokesciai"
      aria-labelledby="mokesciai-title"
      className={cn(card, "flex min-w-0 scroll-mt-nav flex-col gap-3.5 p-6 max-md:p-4", compact ? "flex-[1_1_300px]" : "w-full")}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="mokesciai-title" className="font-serif text-2xl leading-[1.15] tracking-[-0.02em]">
          Mokesčiai · {tax.year}
        </h2>
        <span className="shrink-0 text-[13px] text-muted-foreground">IV pagal pažymą</span>
      </div>

      <div className="flex flex-col gap-1 rounded-tile bg-sand-tint p-4">
        <span className="text-sm text-sand-ink">{tax.current ? `Atidėk už ${tax.year} m. iki šiol` : `${tax.year} m. mokesčiai`}</span>
        <span className="font-serif text-4xl leading-none tabular-nums">≈ {money(e.total)}</span>
        <span className="text-[13px] text-sand-ink tabular-nums">
          ≈ {money(tax.perMonth)} per mėnesį · ≈ {formatPercent(e.effectiveRate)} nuo pajamų
        </span>
      </div>

      <div className="flex flex-col gap-2 text-sm">
        <div className={row}>
          <span className="text-muted-foreground">Pajamos {tax.current ? "iki šiandien" : ""}</span>
          <span className={num}>{formatEur(e.income)}</span>
        </div>
        {!compact && (tax.historical > 0 || tax.students > 0) && (
          <div className="-mt-1 flex flex-col gap-0.5 pl-3 text-[13px] text-muted-foreground">
            <div className={row}>
              <span>istorinės pajamos</span>
              <span className={num}>{formatEur(tax.historical)}</span>
            </div>
            <div className={row}>
              <span>mokinių mokėjimai Chalk&apos;e</span>
              <span className={num}>{formatEur(tax.students)}</span>
            </div>
          </div>
        )}
        <div className={row}>
          <span className="text-muted-foreground">{s.deduction === "norm" ? `Išlaidos (${formatPercent(s.norm_rate)} norma)` : "Faktinės išlaidos"}</span>
          <span className={num}>{e.deduction ? `−${formatEur(e.deduction)}` : "0 €"}</span>
        </div>
        <div className={cn(row, "border-b pb-2")}>
          <span className="text-muted-foreground">Apmokestinamos pajamos</span>
          <span className={cn(num, "font-medium")}>{formatEur(e.taxable)}</span>
        </div>
        <div className={row}>
          <span>
            VSD <span className="text-muted-foreground">{formatPercent(s.vsd_rate)} nuo {formatPercent(s.base_share)}</span>
          </span>
          <span className={num}>{money(e.vsd)}</span>
        </div>
        <div className={row}>
          <span>
            PSD <span className="text-muted-foreground">{s.min_psd ? `min. ${formatEur(s.min_psd_monthly)} / mėn.` : `${formatPercent(s.psd_rate)} nuo ${formatPercent(s.base_share)}`}</span>
          </span>
          <span className={num}>{money(e.psd)}</span>
        </div>
        <div className={row}>
          <span>
            GPM <span className="text-muted-foreground">≈ {formatPercent(gpmRate)}</span>
          </span>
          <span className={num}>{money(e.gpm)}</span>
        </div>
        <div className={cn(row, "border-t pt-2 font-medium")}>
          <span>Iš viso</span>
          <span className={num}>{money(e.total)}</span>
        </div>
      </div>

      {e.overCreditLimit && (
        <p className="flex gap-2 text-[13px] leading-[18px] text-coral-ink">
          <TriangleAlert aria-hidden="true" className="mt-px size-4 shrink-0" />
          Apmokestinamos pajamos viršija {formatEur(s.credit_zero_at)} – taikomi bendri GPM tarifai, tikras GPM bus didesnis. Pasitikrink VMI.
        </p>
      )}

      <p className="text-[13px] leading-[18px]">
        <span className="font-medium">GPM311</span> – iki {Number(deadline.slice(0, 4))} m. {formatDayMonth(deadline)}
        {tax.current ? "" : " (deklaracija už praėjusius metus)"}
      </p>

      <p className="mt-auto text-xs leading-4 text-muted-foreground">
        Įvertis, ne mokesčių konsultacija{s.rates_year !== tax.year ? `; skaičiuota ${s.rates_year} m. tarifais` : ""}. Tarifai –{" "}
        <Link href="/nustatymai#mokesciai" className="underline underline-offset-2 hover:text-foreground">
          Nustatymuose
        </Link>
        ; <span className="font-medium text-sand-ink">pasitikrink VMI / Sodra</span>.
        {compact && (
          <>
            {" "}
            <Link href={`/finansai/mokesciai?metai=${tax.year}`} className="font-medium text-foreground underline underline-offset-2">
              Apskaitos žurnalas →
            </Link>
          </>
        )}
      </p>
    </section>
  );
}
