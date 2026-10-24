import { Download } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import type { JournalData } from "@/lib/finance/queries";
import { plural } from "@/lib/plural";
import { formatEur } from "@/lib/students/constants";
import { ACTIVITY, formatPercent } from "@/lib/tax/constants";
import { btn, card } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { PrintButton } from "./print-button";
import { TaxCard } from "./tax-card";

// Finansai → Mokesčiai (SPEC §1 Taxes): the tax card for a year + the apskaitos žurnalas
// (legally required IV income/expense journal), with CSV export and an A4 print view.
// Printing shows only the journal (everything else is print:hidden; the navbar too – app/(app)/layout.tsx).

const pill =
  "inline-flex h-9 shrink-0 items-center rounded-pill px-4 text-sm font-medium transition-all duration-200 outline-offset-2 focus-visible:outline-2 focus-visible:outline-foreground/40";

/** 1234.5 → "1 234,50" (dates stay YYYY-MM-DD, as on VMI forms). */
const amount = (n: number) => n.toLocaleString("lt-LT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function Journal({ data, years }: { data: JournalData; years: number[] }) {
  const { rows, totals, tax, year } = data;
  const norm = tax.settings.deduction === "norm";
  const cell = "px-3 py-2 text-right tabular-nums print:px-2 print:py-1";

  return (
    <>
      <PageHeader title="Mokesčiai" subtitle="IV mokesčių įvertis ir apskaitos žurnalas" className="print:hidden" />

      <div className="flex flex-col gap-5 print:gap-0">
        <nav aria-label="Metai" className="mx-auto flex rounded-pill bg-muted p-1 print:hidden">
          {years.map((y) => (
            <Link
              key={y}
              href={`/finansai/mokesciai?metai=${y}`}
              scroll={false}
              aria-current={y === year ? "page" : undefined}
              className={cn(pill, y === year ? "bg-card text-foreground shadow-button" : "text-foreground/80 hover:text-foreground")}
            >
              {y}
            </Link>
          ))}
        </nav>

        <div className="print:hidden">
          <TaxCard tax={tax} />
        </div>

        <section aria-labelledby="zurnalas" className={cn(card, "flex flex-col gap-4 p-6 max-md:p-4 print:rounded-none print:border-0 print:p-0 print:shadow-none")}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <h2 id="zurnalas" className="font-serif text-2xl leading-[1.15] tracking-[-0.02em] print:text-xl">
                Pajamų ir išlaidų apskaitos žurnalas · {year} m.
              </h2>
              <p className="text-sm text-muted-foreground print:text-foreground">
                Individuali veikla pagal pažymą · veikla: {ACTIVITY} · pinigų apskaitos principas
              </p>
            </div>
            <div className="flex shrink-0 gap-2 print:hidden">
              <a href={`/api/export?failas=zurnalas&metai=${year}`} download className={btn.small}>
                <Download aria-hidden="true" className="size-4" strokeWidth={1.75} />
                CSV
              </a>
              <PrintButton />
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">{year} m. gautų pajamų nėra.</p>
          ) : (
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full min-w-[560px] border-collapse text-[15px] print:min-w-0 print:text-[10pt]">
                <thead>
                  <tr className="border-b text-[13px] text-muted-foreground print:text-[9pt] print:text-foreground">
                    <th scope="col" className="px-3 py-2 text-left font-medium whitespace-nowrap print:px-2">
                      Eilės nr.
                    </th>
                    <th scope="col" className="px-3 py-2 text-left font-medium whitespace-nowrap print:px-2">
                      Data
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium print:px-2">
                      Pajamų suma, €
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium print:px-2">
                      Išlaidos / leidžiami atskaitymai{norm ? ` (${formatPercent(tax.settings.norm_rate)})` : ""}, €
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium print:px-2">
                      Pelnas, €
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.nr} className="border-b border-foreground/[.05] break-inside-avoid">
                      <td className="px-3 py-2 tabular-nums print:px-2 print:py-1">{r.nr}</td>
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums print:px-2 print:py-1">{r.date}</td>
                      <td className={cell}>{amount(r.income)}</td>
                      <td className={cell}>{r.deduction === null ? "–" : amount(r.deduction)}</td>
                      <td className={cell}>{amount(r.profit)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-foreground/20 font-medium">
                    <th scope="row" colSpan={2} className="px-3 py-2.5 text-left font-medium print:px-2">
                      Iš viso{norm ? "" : " (faktinės išlaidos per metus)"}
                    </th>
                    <td className={cell}>{amount(totals.income)}</td>
                    <td className={cell}>{amount(totals.deduction)}</td>
                    <td className={cell}>{amount(totals.profit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <p className="text-[13px] leading-[18px] text-muted-foreground print:text-[8pt]">
            Viena eilutė – vienas gautas mokėjimas: istorinės pajamos ir mokinių mokėjimai (paslėpti „ne mokinio“ mokėjimai neįtraukti).
            {rows.length > 0 ? ` Iš viso ${plural(rows.length, ["įrašas", "įrašai", "įrašų"])}, pajamos ${formatEur(totals.income)}.` : ""}
          </p>
        </section>
      </div>
    </>
  );
}
