"use client";

import { Banknote, ChevronRight, EyeOff, Landmark } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Notice } from "@/components/notice";
import { TruncatedText } from "@/components/truncated-text";
import { formatDayMonth, weekdayAbbr } from "@/lib/lessons/time";
import { PERIODS, SOURCE_LABEL, formatSignedEur, type Period } from "@/lib/payments/constants";
import type { PaymentItem, PaymentStudent } from "@/lib/payments/queries";
import { formatEur, toneDot } from "@/lib/students/constants";
import { btn, card, field } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { BankPaymentDialog } from "./bank-payment-dialog";
import { NewPaymentButton, PaymentDialog, type PaymentDialogState } from "./payment-dialog";
import { StatementButton } from "./statement-dialog";

// Mokėjimai screen (SPEC §3.9): "Nepriskirti mokėjimai" (bank payments waiting for a student) on top,
// then the payments of students with period + student filters, and the hidden ones on request.
// Manual payments open the edit dialog; bank payments open the assign dialog (never deleted).

function href(period: Period, studentId: string, hidden = false) {
  const params = new URLSearchParams();
  if (period !== "visi") params.set("laikotarpis", period);
  if (studentId) params.set("mokinys", studentId);
  if (hidden) params.set("rodyti", "paslepti");
  const q = params.toString();
  return q ? `/mokejimai?${q}` : "/mokejimai";
}

export function PaymentsBrowser({
  payments,
  unassigned,
  hidden,
  hiddenCount,
  bankConnected,
  students,
  period,
  studentId,
}: {
  payments: PaymentItem[];
  unassigned: PaymentItem[];
  hidden: PaymentItem[] | null; // null = not shown (?rodyti=paslepti shows them)
  hiddenCount: number;
  bankConnected: boolean;
  students: PaymentStudent[];
  period: Period;
  studentId: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<PaymentDialogState>(null);
  const [bankPayment, setBankPayment] = useState<PaymentItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const filtered = period !== "visi" || studentId !== "";
  const open = (p: PaymentItem) => (p.source === "manual" ? setEditing({ payment: p }) : setBankPayment(p));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Laikotarpis" className="flex max-w-full gap-0.5 overflow-x-auto rounded-pill bg-muted p-1 [scrollbar-width:none]">
          {PERIODS.map((p) => (
            <Link
              key={p.value}
              href={href(p.value, studentId)}
              aria-current={period === p.value ? "page" : undefined}
              scroll={false}
              className={cn(
                "inline-flex h-9 shrink-0 items-center rounded-pill px-3.5 text-sm font-medium whitespace-nowrap transition-all duration-200 outline-offset-2 focus-visible:outline-2 focus-visible:outline-foreground/40",
                period === p.value ? "bg-card text-foreground shadow-button" : "text-foreground/80 hover:text-foreground"
              )}
            >
              {p.label}
            </Link>
          ))}
        </nav>

        <label className="flex min-w-[180px] flex-1">
          <span className="sr-only">Mokinys</span>
          <select
            value={studentId}
            onChange={(e) => router.push(href(period, e.target.value), { scroll: false })}
            className={cn(field, "h-11 rounded-pill bg-card px-4 text-[15px]")}
          >
            <option value="">Visi mokiniai</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.grade}
                {s.archived ? " (archyve)" : ""}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-2">
          <StatementButton />
          <NewPaymentButton students={students} studentId={undefined} />
        </div>
      </div>

      <Unassigned payments={unassigned} bankConnected={bankConnected} onOpen={open} />

      {payments.length === 0 ? (
        <section className={cn(card, "flex flex-col items-center gap-3 px-6 py-12 text-center")}>
          <span className="flex size-14 items-center justify-center rounded-pill border bg-background text-foreground/80">
            <Banknote aria-hidden="true" className="size-6" strokeWidth={1.75} />
          </span>
          <h2 className="font-serif text-[22px] leading-[1.15]">{filtered ? "Pagal filtrą mokėjimų nėra" : <>Dar nėra <em>mokėjimų</em></>}</h2>
          <p className="max-w-[380px] text-sm leading-5 text-muted-foreground">
            {filtered ? "Pabandyk kitą laikotarpį ar mokinį." : "Suvesk grynuosius ar pavedimą su „+ Mokėjimas“ – balansai persiskaičiuos iš karto."}
          </p>
          {filtered && (
            <Link href="/mokejimai" className="text-sm font-medium hover:underline">
              Rodyti visus
            </Link>
          )}
        </section>
      ) : (
        <section aria-label="Mokėjimai" className={cn(card, "p-2")}>
          <ul>
            {payments.map((p, i) => (
              <li key={p.id} className={cn(i > 0 && "border-t border-border/60")}>
                <PaymentRow payment={p} onEdit={() => open(p)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {hidden ? (
        <section aria-labelledby="hidden" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 px-1">
            <h2 id="hidden" className="font-medium">
              Paslėpti mokėjimai
            </h2>
            <Link href={href(period, studentId)} scroll={false} className="text-sm font-medium hover:underline">
              Slėpti sąrašą
            </Link>
          </div>
          {hidden.length ? (
            <div className={cn(card, "p-2")}>
              <ul>
                {hidden.map((p, i) => (
                  <li key={p.id} className={cn(i > 0 && "border-t border-border/60")}>
                    <PaymentRow payment={p} onEdit={() => open(p)} />
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="px-1 text-sm text-muted-foreground">Paslėptų mokėjimų nėra.</p>
          )}
        </section>
      ) : hiddenCount > 0 ? (
        <Link href={href(period, studentId, true)} scroll={false} className={cn(btn.ghost, "self-center text-sm text-muted-foreground")}>
          <EyeOff aria-hidden="true" className="size-4" strokeWidth={1.75} />
          Paslėpti mokėjimai · {hiddenCount}
        </Link>
      ) : null}

      <PaymentDialog state={editing} students={students} onOpenChange={(open) => !open && setEditing(null)} onSaved={setNotice} />
      <BankPaymentDialog payment={bankPayment} students={students} onOpenChange={(open) => !open && setBankPayment(null)} onSaved={setNotice} />
      <Notice message={notice} onClear={() => setNotice(null)} />
    </div>
  );
}

/** "Nepriskirti mokėjimai": bank payments from payers Chalk doesn't know yet – one click to assign. */
function Unassigned({ payments, bankConnected, onOpen }: { payments: PaymentItem[]; bankConnected: boolean; onOpen: (p: PaymentItem) => void }) {
  if (!payments.length) {
    return (
      <section id="nepriskirti" aria-labelledby="unassigned" className={cn(card, "flex scroll-mt-nav items-center gap-4 px-5 py-4")}>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-pill border bg-background text-foreground/80">
          <Landmark aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
        </span>
        <div className="flex min-w-0 flex-col">
          <h2 id="unassigned" className="font-medium">
            Nepriskirtų mokėjimų nėra
          </h2>
          <p className="text-sm leading-5 text-muted-foreground">
            {bankConnected ? (
              "Kai bankas atneš mokėjimą iš nežinomo mokėtojo, jis atsiras čia."
            ) : (
              <>
                <Link href="/nustatymai#bankas" className="font-medium text-foreground hover:underline">
                  Prijunk banką
                </Link>{" "}
                arba įkelk išrašą – nežinomų mokėtojų mokėjimai atsiras čia.
              </>
            )}
          </p>
        </div>
      </section>
    );
  }
  const total = payments.reduce((sum, p) => sum + p.amount, 0);
  return (
    <section id="nepriskirti" aria-labelledby="unassigned" className={cn(card, "scroll-mt-nav p-2")}>
      <div className="flex items-center gap-2.5 px-3.5 pt-2.5 pb-1.5">
        <h2 id="unassigned" className="font-medium">
          Nepriskirti mokėjimai
        </h2>
        <span className="inline-flex h-[22px] min-w-6 items-center justify-center rounded-pill bg-sand-tint px-2 text-[13px] font-medium text-sand-ink tabular-nums">
          {payments.length}
        </span>
        <span className="ml-auto shrink-0 text-sm text-muted-foreground tabular-nums">{formatEur(total)}</span>
      </div>
      <ul>
        {payments.map((p, i) => (
          <li key={p.id} className={cn(i > 0 && "border-t border-border/60")}>
            <PaymentRow payment={p} onEdit={() => onOpen(p)} action="Priskirti" />
          </li>
        ))}
      </ul>
    </section>
  );
}

function PaymentRow({ payment: p, onEdit, action }: { payment: PaymentItem; onEdit?: () => void; action?: string }) {
  const memo = p.hiddenReason ? `${p.hiddenReason}${p.payerName ? ` · ${p.payerName}` : ""}` : (p.note ?? p.remittance);
  // Not a student's yet: the payer is the title.
  const title = p.studentName ?? p.payerName ?? "Nežinomas mokėtojas";
  const content = (
    <>
      <span className="flex w-[84px] shrink-0 flex-col max-sm:w-[64px]">
        <span className="text-sm font-medium whitespace-nowrap tabular-nums">{formatDayMonth(p.date).replace(" d.", "")}</span>
        <span className="text-xs text-muted-foreground">
          {weekdayAbbr(p.date)} · {SOURCE_LABEL[p.source]}
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-pill", p.studentTone ? toneDot(p.studentTone) : "bg-muted-foreground/40")} />
          <TruncatedText className="font-medium">{title}</TruncatedText>
        </span>
        <TruncatedText className={cn("pl-4 text-sm", memo ? "text-muted-foreground" : "text-muted-foreground/70")}>{memo || (p.payerName ?? "be pastabos")}</TruncatedText>
      </span>
      <span className={cn("shrink-0 font-medium whitespace-nowrap tabular-nums", p.studentId ? "text-sage-ink" : "text-muted-foreground")}>{formatSignedEur(p.amount)}</span>
      {action ? (
        <span className={cn(btn.small, "pointer-events-none max-sm:hidden")}>{action}</span>
      ) : (
        onEdit && <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground/70 max-sm:hidden" />
      )}
    </>
  );
  const cls = "flex min-h-[60px] w-full items-center gap-4 rounded-tile px-3.5 py-2 text-left max-sm:gap-3";
  if (!onEdit) return <div className={cls}>{content}</div>;
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`${action ?? (p.source === "manual" ? "Redaguoti" : "Atidaryti")} mokėjimą: ${title}, ${formatSignedEur(p.amount)}, ${formatDayMonth(p.date)}`}
      className={cn(cls, "outline-offset-2 transition-colors duration-150 hover:bg-background focus-visible:outline-2 focus-visible:outline-foreground/40")}
    >
      {content}
    </button>
  );
}
