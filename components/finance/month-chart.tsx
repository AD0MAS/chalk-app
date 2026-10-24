"use client";

import { useState } from "react";
import { axisScale, tickLabel } from "@/lib/finance/axis";
import type { FinanceData } from "@/lib/finance/queries";
import { formatEur } from "@/lib/students/constants";
import { card } from "@/lib/ui";
import { cn } from "@/lib/utils";

// "Gauta pagal mėnesius": one Sage bar per month of the year = money received (payments assigned to students +
// historical income – the same base as the tax card). No legend: the title says what the bars are.
// Future months stay empty. Hover / focus a month → glass tooltip; a hidden table repeats the data for screen readers.

type Month = FinanceData["months"][number];

export function MonthChart({ year, months }: { year: number; months: Month[] }) {
  const [active, setActive] = useState<number | null>(null);
  const { top, ticks } = axisScale(Math.max(0, ...months.map((m) => m.received ?? 0)));
  const pct = (v: number) => `${(v / top) * 100}%`;
  const total = months.reduce((s, m) => s + (m.received ?? 0), 0);

  return (
    <section aria-labelledby="menesiai" className={cn(card, "flex min-w-0 flex-[2_1_520px] flex-col gap-4 p-6 max-md:p-4")}>
      <h2 id="menesiai" className="font-serif text-2xl leading-[1.15] tracking-[-0.02em]">
        Gauta pagal mėnesius · {year}
      </h2>

      <div className="relative min-h-[240px] flex-1 pl-10 max-md:min-h-[200px] max-md:pl-8">
        {/* gridlines + axis labels */}
        <div aria-hidden="true" className="absolute top-0 bottom-7 left-10 right-0 max-md:left-8">
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-foreground/[.07]" style={{ bottom: pct(t) }}>
              <span className="absolute -left-10 w-8 -translate-y-1/2 text-right text-[11px] text-muted-foreground tabular-nums max-md:-left-8 max-md:w-6 max-md:text-[10px]">
                {tickLabel(t)}
              </span>
            </div>
          ))}
        </div>

        <div className="absolute inset-0 left-10 grid grid-cols-12 gap-2 max-md:left-8 max-md:gap-1" onMouseLeave={() => setActive(null)}>
          {months.map((m, i) => {
            const empty = m.received === null;
            return (
              <button
                key={m.short}
                type="button"
                aria-label={empty ? `${m.name} – dar nėra` : `${m.name}: gauta ${formatEur(m.received ?? 0)}`}
                disabled={empty}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="relative flex min-w-0 flex-col items-center gap-2 rounded-tile outline-offset-2 focus-visible:outline-2 focus-visible:outline-foreground/40 disabled:cursor-default"
              >
                <span className="flex w-full flex-1 items-end justify-center">
                  {m.received !== null && (
                    <span
                      className={cn("block w-[56%] max-w-7 rounded-t-[4px] bg-sage transition-opacity duration-150", active !== null && active !== i && "opacity-40")}
                      style={{ height: pct(m.received) }}
                    />
                  )}
                </span>
                <span className={cn("h-5 text-xs leading-5 max-md:text-[10px]", m.current ? "font-semibold text-foreground" : "text-muted-foreground", empty && "opacity-60")}>{m.short}</span>
                {active === i && !empty && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "glass-border pointer-events-none absolute top-0 z-10 flex w-max flex-col gap-0.5 rounded-tile px-3 py-2 text-left text-[13px] shadow-glass backdrop-blur-[12px]",
                      i < 3 ? "left-0" : i > 8 ? "right-0" : "left-1/2 -translate-x-1/2"
                    )}
                    style={{ background: "var(--navbar-gradient)" }}
                  >
                    <span className="font-medium">
                      {m.name} {year}
                    </span>
                    <span className="tabular-nums text-sage-ink">Gauta {formatEur(m.received ?? 0)}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <table className="sr-only">
        <caption>Gauta pagal mėnesius, {year}</caption>
        <thead>
          <tr>
            <th scope="col">Mėnuo</th>
            <th scope="col">Gauta</th>
          </tr>
        </thead>
        <tbody>
          {months
            .filter((m) => m.received !== null)
            .map((m) => (
              <tr key={m.short}>
                <th scope="row">{m.name}</th>
                <td>{formatEur(m.received ?? 0)}</td>
              </tr>
            ))}
        </tbody>
      </table>

      <p className="text-[13px] leading-[18px] text-muted-foreground">
        Iš viso gauta {formatEur(total)} – mokinių mokėjimai ir istorinės pajamos, ta pati suma kaip mokesčiams.
      </p>
    </section>
  );
}
