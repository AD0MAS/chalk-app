"use client";

import { ChevronRight, Plus, Search, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { TruncatedText } from "@/components/truncated-text";
import { STATUSES, type StudentStatus, type StudentTone } from "@/lib/students/constants";
import { balanceColor, balanceMeta, formatSignedEur } from "@/lib/payments/constants";
import type { StudentCounts } from "@/lib/students/queries";
import { btn, card } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { StatusPill, StudentDot } from "./status-pill";

export type StudentRow = {
  id: string;
  name: string; // display name (first name, + surname initial if two share it)
  fullName: string;
  grade: string; // "12 kl B"
  status: StudentStatus;
  tone: StudentTone;
  schedule: string; // "Antr 18:00 · Ketv 18:00" or a hint
  hasSchedule: boolean;
  price: string;
  balance: number; // student_balances.balance – negative = debt
  unitPrice: number;
};

export type Tab = StudentStatus | "visi";

// Lowercase without diacritics, so "gabriele" finds "Gabrielė" and "sarunas" finds "Šarūnas".
function searchKey(text: string) {
  return text.toLocaleLowerCase("lt").normalize("NFD").replace(/\p{M}/gu, "");
}

const TABS: { value: Tab; label: string }[] = [{ value: "visi", label: "Visi" }, ...STATUSES.map((s) => ({ value: s.value, label: s.tab }))];

export function StudentsBrowser({ rows, counts, tab }: { rows: StudentRow[]; counts: StudentCounts; tab: Tab }) {
  const [query, setQuery] = useState("");

  const q = searchKey(query.trim());
  const visible = rows.filter(
    (r) =>
      (tab === "visi" ? r.status !== "archyvuotas" : r.status === tab) &&
      (!q || searchKey(r.fullName).includes(q))
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        {/* phone: one row that scrolls sideways (no visible scrollbar), chips never shrink */}
        <nav aria-label="Statusas" className="flex max-w-full gap-0.5 overflow-x-auto rounded-pill bg-muted p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => {
            const active = t.value === tab;
            const count = counts[t.value];
            return (
              <Link
                key={t.value}
                href={t.value === "visi" ? "/mokiniai" : `/mokiniai?statusas=${t.value}`}
                aria-current={active ? "page" : undefined}
                scroll={false}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill px-3.5 text-sm font-medium whitespace-nowrap transition-all duration-200 outline-offset-2 focus-visible:outline-2 focus-visible:outline-foreground/40",
                  active ? "bg-card text-foreground shadow-button" : "text-foreground/80 hover:text-foreground"
                )}
              >
                {t.label}
                {t.value === "derinama" && count > 0 ? (
                  <span className="inline-flex h-5 items-center rounded-pill bg-sand-tint px-1.5 text-xs text-sand-ink tabular-nums">{count}</span>
                ) : (
                  <span className="text-muted-foreground tabular-nums">{count}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <label className="flex h-11 min-w-[200px] flex-1 items-center max-md:min-w-0 gap-2 rounded-pill bg-card px-4 text-muted-foreground shadow-[inset_0_0_0_1px_var(--input)] focus-within:shadow-[inset_0_0_0_1px_rgba(3,3,2,.3),0_0_0_3px_rgba(3,3,2,.08)]">
          <Search aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={1.75} />
          <span className="sr-only">Ieškoti mokinio</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ieškoti mokinio…"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>

        {/* phone: a round black "+" right of the search */}
        <Link href="/mokiniai/naujas" aria-label="Naujas mokinys" className={cn(btn.primary, "max-md:size-11 max-md:px-0")}>
          <Plus aria-hidden="true" className="size-4 max-md:size-5" strokeWidth={2.2} />
          <span className="max-md:sr-only">Naujas mokinys</span>
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div className={cn(card, "p-2")}>
          <div
            aria-hidden="true"
            className="hidden grid-cols-[minmax(0,2fr)_128px_minmax(0,1.6fr)_72px_120px_16px] items-center gap-4 px-3.5 py-2.5 text-[13px] font-medium text-muted-foreground md:grid"
          >
            <span>Mokinys</span>
            <span>Statusas</span>
            <span>Tvarkaraštis</span>
            <span className="text-right">Kaina</span>
            <span className="text-right">Balansas</span>
            <span />
          </div>

          {visible.length === 0 ? (
            <p className="px-4 py-10 text-center text-muted-foreground">
              {q ? `Pagal „${query.trim()}“ nieko nerasta.` : "Šiame skirtuke mokinių nėra."}
            </p>
          ) : (
            <ul>
              {visible.map((r, i) => (
                <li key={r.id} className={cn(i > 0 && "border-t border-border/60")}>
                  <Link
                    href={`/mokiniai/${r.id}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-tile px-3.5 py-3 outline-offset-2 transition-colors duration-150 hover:bg-background focus-visible:outline-2 focus-visible:outline-foreground/40 md:min-h-[60px] md:grid-cols-[minmax(0,2fr)_128px_minmax(0,1.6fr)_72px_120px_16px] md:py-2"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <StudentDot tone={r.tone} />
                      <TruncatedText className="font-medium">{r.name}</TruncatedText>
                      <span className="shrink-0 text-sm whitespace-nowrap text-muted-foreground">{r.grade}</span>
                    </span>
                    <span className="justify-self-end md:justify-self-start">
                      <StatusPill status={r.status} />
                    </span>
                    <span className={cn("min-w-0 pl-5 text-sm tabular-nums md:pl-0", !r.hasSchedule && "text-muted-foreground")}>
                      <TruncatedText>{r.schedule}</TruncatedText>
                    </span>
                    <span className="text-right text-sm whitespace-nowrap tabular-nums">
                      {r.price}
                      {/* phone: the balance shares the price cell */}
                      <span className={cn("font-medium md:hidden", balanceColor(r.balance))}> · {formatSignedEur(r.balance)}</span>
                    </span>
                    <span
                      className={cn("hidden text-right font-medium whitespace-nowrap tabular-nums md:block", balanceColor(r.balance))}
                      title={balanceMeta(r.balance, r.unitPrice)}
                    >
                      {formatSignedEur(r.balance)}
                    </span>
                    <ChevronRight aria-hidden="true" className="hidden size-4 text-muted-foreground/70 md:block" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <section className={cn(card, "flex flex-col items-center gap-3 px-6 py-12 text-center")}>
      <span className="flex size-14 items-center justify-center rounded-pill border bg-background">
        <Users aria-hidden="true" className="size-6" strokeWidth={1.75} />
      </span>
      <h2 className="font-serif text-[22px] leading-[1.15]">
        Dar nėra <em>mokinių</em>
      </h2>
      <p className="max-w-[360px] text-sm leading-5 text-muted-foreground">
        Pridėk pirmą mokinį – vardą, klasę, kainą ir savaitinius laikus.
      </p>
      <Link href="/mokiniai/naujas" className={btn.primary}>
        <Plus aria-hidden="true" className="size-4" strokeWidth={2.2} />
        Naujas mokinys
      </Link>
    </section>
  );
}
