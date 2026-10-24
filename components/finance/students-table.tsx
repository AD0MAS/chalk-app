"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { TruncatedText } from "@/components/truncated-text";
import type { FinanceStudentRow } from "@/lib/finance/queries";
import { balanceColor, formatSignedEur } from "@/lib/payments/constants";
import { formatEur, toneDot } from "@/lib/students/constants";
import { card } from "@/lib/ui";
import { cn } from "@/lib/utils";

// "Pagal mokinius" (canvas "Finansai"): held lessons, earned and received in the period, today's balance.
// Click a column header to sort; again to reverse. ?rikiuoti=skolos opens it sorted by debt (navbar "Skolos").

type Key = "name" | "held" | "earned" | "received" | "balance";

const COLUMNS: { key: Key; label: string }[] = [
  { key: "name", label: "Mokinys" },
  { key: "held", label: "Pamokos" },
  { key: "earned", label: "Uždirbta" },
  { key: "received", label: "Gauta" },
  { key: "balance", label: "Balansas" },
];

const grid = "grid grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))] gap-4 max-md:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))] max-md:gap-2";

export function StudentsTable({ rows, periodLabel, initialSort }: { rows: FinanceStudentRow[]; periodLabel: string; initialSort?: string }) {
  // Debts first = balance ascending; every other column starts with the biggest number.
  const [sort, setSort] = useState<{ key: Key; asc: boolean }>(initialSort === "skolos" ? { key: "balance", asc: true } : { key: "earned", asc: false });

  const sorted = [...rows].sort((a, b) => {
    const diff = sort.key === "name" ? a.name.localeCompare(b.name, "lt") : a[sort.key] - b[sort.key];
    return (sort.asc ? diff : -diff) || a.name.localeCompare(b.name, "lt");
  });
  const total = (k: "held" | "earned" | "received" | "balance") => rows.reduce((s, r) => s + r[k], 0);
  const toggle = (key: Key) => setSort((s) => (s.key === key ? { key, asc: !s.asc } : { key, asc: key === "name" }));

  return (
    <section id="mokiniai" aria-labelledby="mokiniai-title" className={cn(card, "scroll-mt-nav p-2")}>
      <div className="flex items-baseline justify-between gap-3 px-3.5 pt-3.5 pb-1.5">
        <h2 id="mokiniai-title" className="font-serif text-2xl leading-[1.15] tracking-[-0.02em]">
          Pagal mokinius
        </h2>
        <span className="text-[13px] text-muted-foreground">{periodLabel}</span>
      </div>

      {rows.length === 0 ? (
        <p className="px-3.5 pt-2 pb-5 text-muted-foreground">Šiuo laikotarpiu pamokų ir mokėjimų nebuvo.</p>
      ) : (
        <div className="overflow-x-auto [scrollbar-width:thin]">
          <table className="w-full min-w-[560px] border-separate border-spacing-0 tabular-nums">
            <caption className="sr-only">Finansai pagal mokinius, {periodLabel}. Rikiuoti galima paspaudus stulpelio pavadinimą.</caption>
            <thead>
              <tr className={cn(grid, "px-3.5 py-2")}>
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={sort.key === c.key ? (sort.asc ? "ascending" : "descending") : undefined}
                    className={cn("p-0 text-[13px] font-medium text-muted-foreground", c.key === "name" ? "text-left" : "text-right")}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(c.key)}
                      className={cn(
                        "inline-flex h-7 items-center gap-1 rounded-pill px-1.5 transition-colors duration-150 hover:text-foreground outline-offset-2 focus-visible:outline-2 focus-visible:outline-foreground/40",
                        c.key === "name" ? "-ml-1.5" : "-mr-1.5 flex-row-reverse",
                        sort.key === c.key && "text-foreground"
                      )}
                    >
                      {c.label}
                      {sort.key === c.key ? (
                        sort.asc ? <ArrowUp aria-hidden="true" className="size-3.5" /> : <ArrowDown aria-hidden="true" className="size-3.5" />
                      ) : (
                        <span aria-hidden="true" className="size-3.5" />
                      )}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className={cn(grid, "min-h-12 items-center rounded-tile px-3.5 py-1 transition-colors duration-150 hover:bg-muted")}>
                  <td className="flex min-w-0 items-center gap-2.5 p-0">
                    <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-pill", toneDot(r.tone))} />
                    <Link href={`/mokiniai/${r.id}?skirtukas=mokejimai`} className="flex min-w-0 items-center gap-2.5 rounded-pill outline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-foreground/40">
                      <TruncatedText className="font-medium">{r.name}</TruncatedText>
                    </Link>
                    <span className="shrink-0 text-[13px] whitespace-nowrap text-muted-foreground max-md:hidden">{r.grade}</span>
                  </td>
                  <td className="p-0 text-right">{r.held}</td>
                  <td className="p-0 text-right">{formatEur(r.earned)}</td>
                  <td className="p-0 text-right">{formatEur(r.received)}</td>
                  <td className={cn("p-0 text-right font-medium", balanceColor(r.balance))}>{formatSignedEur(r.balance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className={cn(grid, "mt-1 min-h-12 items-center border-t px-3.5 py-1 font-medium")}>
                <th scope="row" className="p-0 text-left font-medium">
                  Iš viso
                </th>
                <td className="p-0 text-right">{total("held")}</td>
                <td className="p-0 text-right">{formatEur(Math.round(total("earned") * 100) / 100)}</td>
                <td className="p-0 text-right">{formatEur(Math.round(total("received") * 100) / 100)}</td>
                <td className={cn("p-0 text-right", balanceColor(total("balance")))}>{formatSignedEur(Math.round(total("balance") * 100) / 100)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
