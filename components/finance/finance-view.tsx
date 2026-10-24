import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import type { FinanceData } from "@/lib/finance/queries";
import { PERIOD_KINDS, periodHref, type Period } from "@/lib/finance/period";
import { formatDayMonth } from "@/lib/lessons/time";
import { plural } from "@/lib/plural";
import { formatEur } from "@/lib/students/constants";
import { card } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { MonthChart } from "./month-chart";
import { StudentsTable } from "./students-table";
import { TaxCard } from "./tax-card";

// Finansai (SPEC §3.8, approved canvas "Finansai"): period switch, four cards, monthly chart + tax card,
// per-student table. Skolos / Avansai are today's balances; the rest follows the chosen period.

const pill =
  "inline-flex h-9 shrink-0 items-center rounded-pill px-4 text-sm font-medium whitespace-nowrap transition-all duration-200 outline-offset-2 focus-visible:outline-2 focus-visible:outline-foreground/40";
const arrow =
  "flex size-9 items-center justify-center rounded-pill text-foreground transition-colors duration-200 hover:bg-muted outline-offset-2 focus-visible:outline-2 focus-visible:outline-foreground/40";

/** "Gabija 60 € · Matas 44 €" – at most three names. */
const nameList = (list: { name: string; amount: number }[]) =>
  list
    .slice(0, 3)
    .map((d) => `${d.name} ${formatEur(d.amount)}`)
    .join(" · ") + (list.length > 3 ? ` · +${list.length - 3}` : "");

export function FinanceView({ period, data, initialSort }: { period: Period; data: FinanceData; initialSort?: string }) {
  const { cards, today } = data;
  const box = cn(card, "@container flex min-w-0 flex-col gap-1.5 p-5 max-md:p-4");
  const label = "truncate-name text-sm text-muted-foreground max-md:text-[13px]";
  // One big-number style for all four cards in every period (DESIGN.md §4): 36px, or smaller only when the card
  // itself is narrow (phone) – by card width, never by the amount, so "23 687,50 €" fits and is never cut (§9).
  const value = "font-serif text-[length:min(36px,17.5cqi)] leading-none font-normal whitespace-nowrap tabular-nums";
  const meta = "truncate-name text-[13px] text-muted-foreground max-md:text-xs";
  const running = period.to > today; // the period has not ended yet

  return (
    <>
      <PageHeader title="Finansai" subtitle={`${period.label}${running ? ` · iki šiandien, ${formatDayMonth(today)}` : ""}`} />

      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <nav aria-label="Laikotarpis" className="flex rounded-pill bg-muted p-1">
            {PERIOD_KINDS.map((p) => (
              <Link
                key={p.value}
                href={periodHref(p.value)}
                scroll={false}
                aria-current={period.kind === p.value ? "page" : undefined}
                className={cn(pill, period.kind === p.value ? "bg-card text-foreground shadow-button" : "text-foreground/80 hover:text-foreground")}
              >
                {p.label}
              </Link>
            ))}
          </nav>
          <div className="flex h-11 items-center gap-0.5 rounded-pill bg-card px-1 shadow-[inset_0_0_0_1px_var(--input)]">
            {period.prev ? (
              <Link href={periodHref(period.kind, period.prev, today)} scroll={false} aria-label="Ankstesnis laikotarpis" className={arrow}>
                <ChevronLeft aria-hidden="true" className="size-4" />
              </Link>
            ) : (
              <span aria-hidden="true" className={cn(arrow, "text-foreground/25 hover:bg-transparent")}>
                <ChevronLeft className="size-4" />
              </span>
            )}
            <span className="min-w-[112px] px-1 text-center text-[15px] font-medium whitespace-nowrap tabular-nums">{period.label}</span>
            {period.next ? (
              <Link href={periodHref(period.kind, period.next, today)} scroll={false} aria-label="Kitas laikotarpis" className={arrow}>
                <ChevronRight aria-hidden="true" className="size-4" />
              </Link>
            ) : (
              <span aria-hidden="true" className={cn(arrow, "text-foreground/25 hover:bg-transparent")}>
                <ChevronRight className="size-4" />
              </span>
            )}
          </div>
        </div>

        <section aria-label="Suvestinė" className="grid grid-cols-4 gap-4 max-md:grid-cols-2 max-md:gap-2.5">
          <div className={box}>
            <span className={label}>Uždirbta</span>
            <span className={value}>{formatEur(cards.earned.total)}</span>
            <span className={meta}>{cards.earned.count ? plural(cards.earned.count, ["įvykusi pamoka", "įvykusios pamokos", "įvykusių pamokų"]) : "pamokų nebuvo"}</span>
            {cards.earned.forecast && (
              <span
                className={cn(meta, "tabular-nums")}
                title={`Uždirbta ${formatEur(cards.earned.forecast.earned)} + ${plural(cards.earned.forecast.planned.count, ["suplanuota pamoka", "suplanuotos pamokos", "suplanuotų pamokų"])} ${formatEur(cards.earned.forecast.planned.total)} iki mėnesio galo`}
              >
                Prognozė ≈ {formatEur(cards.earned.forecast.total)}
              </span>
            )}
          </div>
          <div className={box}>
            <span className={label}>Gauta</span>
            <span className={cn(value, cards.received.total > 0 && "text-sage-ink")}>{formatEur(cards.received.total)}</span>
            <span className={meta}>{cards.received.count ? plural(cards.received.count, ["mokėjimas", "mokėjimai", "mokėjimų"]) : "mokėjimų nėra"}</span>
          </div>
          <Link href="/finansai?rikiuoti=skolos#mokiniai" id="skolos" className={cn(box, "scroll-mt-nav transition-shadow duration-500 ease-soft hover:shadow-glass")}>
            <span className={label}>Skolos · šiandien</span>
            <span className={cn(value, cards.debts.total > 0 && "text-coral-ink")}>{formatEur(cards.debts.total)}</span>
            <span className={meta} title={nameList(cards.debts.names)}>
              {cards.debts.names.length ? nameList(cards.debts.names) : "skolų nėra"}
            </span>
          </Link>
          <div className={box}>
            <span className={label}>Avansai · šiandien</span>
            <span className={value}>{formatEur(cards.prepaid.total)}</span>
            <span className={meta} title={nameList(cards.prepaid.names)}>
              {cards.prepaid.names.length ? nameList(cards.prepaid.names) : "avansų nėra"}
            </span>
          </div>
        </section>

        <div className="flex flex-wrap items-stretch gap-4">
          <MonthChart year={data.year} months={data.months} />
          <TaxCard tax={data.tax} compact />
        </div>

        <StudentsTable key={initialSort ?? ""} rows={data.rows} periodLabel={period.label} initialSort={initialSort} />
      </div>
    </>
  );
}
