"use client";

import { Equal, Minus, Plus, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Notice } from "@/components/notice";
import { formatDayMonth, weekdayAbbr } from "@/lib/lessons/time";
import { OPENING_BALANCE_DATE, SOURCE_LABEL, balanceColor, formatSignedEur } from "@/lib/payments/constants";
import type { LedgerRow, PaymentStudent } from "@/lib/payments/queries";
import { card } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { OpeningBalanceButton } from "./opening-balance";
import { NewPaymentButton, PaymentDialog, type PaymentDialogState } from "./payment-dialog";

// Profile "Mokėjimai": held lessons and payments mixed by date with a running balance, newest first.

export function Ledger({
  rows,
  student,
  opening,
  students,
}: {
  rows: LedgerRow[];
  student: { id: string; name: string };
  opening: number;
  students: PaymentStudent[];
}) {
  const [editing, setEditing] = useState<PaymentDialogState>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <section aria-labelledby="ledger-title" className={cn(card, "p-2")}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 pt-3 pb-2">
        <h2 id="ledger-title" className="font-serif text-2xl leading-[1.1] tracking-[-0.02em]">
          Sąskaitos išrašas
        </h2>
        <div className="flex flex-wrap gap-2">
          <OpeningBalanceButton studentId={student.id} studentName={student.name} current={opening} className="inline-flex h-10 shrink-0 items-center justify-center rounded-pill bg-card px-4 text-sm font-medium shadow-[inset_0_0_0_1px_var(--input)] transition-colors duration-200 hover:bg-background" />
          <NewPaymentButton
            students={students}
            studentId={student.id}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-pill bg-primary px-4 text-sm font-medium text-primary-foreground shadow-button transition-all duration-200 hover:opacity-90"
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          Dar nėra įvykusių pamokų ir mokėjimų. Jei mokinys turėjo skolą ar avansą iki {formatDayMonth(OPENING_BALANCE_DATE)}, įrašyk „Pradinis likutis“.
        </p>
      ) : (
        <div>
          <div aria-hidden="true" className="hidden items-center gap-4 px-3.5 py-2 text-[13px] font-medium text-muted-foreground md:flex">
            <span className="w-[92px] shrink-0">
              Data
            </span>
            <span className="flex-1">
              Įrašas
            </span>
            <span className="w-[100px] text-right">
              Suma
            </span>
            <span className="w-[110px] text-right">
              Balansas
            </span>
          </div>
          <ul>
          {rows.map((r) => (
            <Row key={r.key} row={r} onEdit={r.payment?.source === "manual" ? () => setEditing({ payment: r.payment! }) : undefined} />
          ))}
          </ul>
        </div>
      )}

      <PaymentDialog state={editing} students={students} onOpenChange={(open) => !open && setEditing(null)} onSaved={setNotice} />
      <Notice message={notice} onClear={() => setNotice(null)} />
    </section>
  );
}

function Row({ row, onEdit }: { row: LedgerRow; onEdit?: () => void }) {
  const icon = {
    opening: { el: <Equal className="size-3.5" strokeWidth={2.2} />, cls: "bg-muted text-foreground/80" },
    lesson: { el: <Minus className="size-3.5" strokeWidth={2.2} />, cls: "bg-muted text-foreground/80" },
    cancelled: { el: <X className="size-3.5" strokeWidth={2.2} />, cls: "bg-coral-tint text-coral-ink" },
    payment: { el: <Plus className="size-3.5" strokeWidth={2.2} />, cls: "bg-sage-tint text-sage-ink" },
  }[row.kind];

  const title = row.kind === "opening" ? "Pradinis likutis" : row.kind === "payment" ? "Mokėjimas" : `Pamoka · ${row.time}`;
  const sub =
    row.kind === "opening"
      ? "balansas, kai Chalk pradėjo skaičiuoti"
      : row.kind === "lesson"
        ? "Įvyko"
        : row.kind === "cancelled"
          ? ["Atšaukta – nemokama", row.note].filter(Boolean).join(" · ")
          : [SOURCE_LABEL[row.payment!.source], row.note ?? row.payment!.remittance].filter(Boolean).join(" · ");

  const amountClass =
    row.kind === "payment" ? "text-sage-ink" : row.kind === "cancelled" ? "text-muted-foreground" : row.kind === "opening" ? balanceColor(row.amount) : "";

  const content = (
    <>
      <span className="hidden w-[92px] shrink-0 flex-col md:flex">
        <span className="text-sm font-medium tabular-nums">{row.date}</span>
        <span className="text-xs text-muted-foreground">{weekdayAbbr(row.date)}</span>
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2.5">
        <span aria-hidden="true" className={cn("flex size-7 shrink-0 items-center justify-center rounded-pill", icon.cls)}>
          {icon.el}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate-name text-[15px] font-medium">{title}</span>
          <span className="truncate-name text-[13px] text-muted-foreground" title={sub}>
            <span className="tabular-nums md:hidden">{formatDayMonth(row.date)} · </span>
            {sub}
          </span>
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end tabular-nums md:flex-row md:gap-4">
        <span className={cn("font-medium whitespace-nowrap md:w-[100px] md:text-right", amountClass, row.kind === "cancelled" && "line-through")}>
          {row.kind === "cancelled" ? "0 €" : formatSignedEur(row.amount)}
        </span>
        <span className={cn("text-[13px] whitespace-nowrap md:w-[110px] md:text-right md:text-base", balanceColor(row.balance))}>
          <span className="md:hidden">likutis </span>
          {formatSignedEur(row.balance)}
        </span>
      </span>
    </>
  );

  const rowClass =
    "flex min-h-14 w-full items-center gap-4 rounded-tile border-t border-border/60 px-3.5 py-2 text-left outline-offset-2 max-md:gap-3 focus-visible:outline-2 focus-visible:outline-foreground/40";

  if (onEdit) {
    return (
      <li>
        <button type="button" onClick={onEdit} aria-label={`Redaguoti mokėjimą ${formatSignedEur(row.amount)}, ${formatDayMonth(row.date)}`} className={cn(rowClass, "transition-colors duration-150 hover:bg-background")}>
          {content}
        </button>
      </li>
    );
  }
  if (row.lessonId) {
    return (
      <li>
        <Link href={`/pamokos/${row.lessonId}`} className={cn(rowClass, "transition-colors duration-150 hover:bg-background")}>
          {content}
        </Link>
      </li>
    );
  }
  return (
    <li className={rowClass}>
      {content}
    </li>
  );
}
