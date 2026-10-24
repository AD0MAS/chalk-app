"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { assignPayment, hidePayment, unassignPayment, unhidePayment, type BankActionResult } from "@/lib/bank/actions";
import { fullNameKey, HIDE_REASONS } from "@/lib/bank/constants";
import { formatDayMonth } from "@/lib/lessons/time";
import { SOURCE_LABEL, formatSignedEur } from "@/lib/payments/constants";
import type { PaymentItem, PaymentStudent } from "@/lib/payments/queries";
import { btn, field, label } from "@/lib/ui";
import { cn } from "@/lib/utils";

// A bank payment (bank sync or uploaded statement): assign to a student ("Prisiminti šį mokėtoją"),
// re-assign, unassign or hide with a reason. Bank payments are never deleted and their data never changes
// (SPEC §1 Payments) – only who they belong to.

type Mode = "assign" | "unassign" | "hide";

export function BankPaymentDialog({
  payment,
  students,
  onOpenChange,
  onSaved,
}: {
  payment: PaymentItem | null;
  students: PaymentStudent[];
  onOpenChange: (open: boolean) => void;
  onSaved: (message: string) => void;
}) {
  return (
    <Dialog open={payment !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        {payment && (
          <BankPaymentForm
            key={payment.id}
            payment={payment}
            students={students}
            onDone={(message) => {
              onOpenChange(false);
              onSaved(message);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** "LT123456…" → "LT12 3456 …" */
const formatIban = (iban: string) => iban.replace(/(.{4})/g, "$1 ").trim();

function BankPaymentForm({ payment: p, students, onDone }: { payment: PaymentItem; students: PaymentStudent[]; onDone: (message: string) => void }) {
  const [mode, setMode] = useState<Mode>("assign");
  const [studentId, setStudentId] = useState(p.studentId ?? p.knownStudentId ?? "");
  const [remember, setRemember] = useState(true);
  const [forget, setForget] = useState(!!p.knownStudentId);
  const [reason, setReason] = useState(HIDE_REASONS[0]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const known = students.find((s) => s.id === p.knownStudentId);
  const canRemember = !!(p.payerIban || fullNameKey(p.payerName)); // never by initials alone

  const run = (action: () => Promise<BankActionResult>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) onDone(result.message);
      else setError(result.message);
    });
  };

  const details = (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 rounded-tile border px-4 py-3 text-sm">
      <dt className="text-muted-foreground">Mokėtojas</dt>
      <dd className="min-w-0 font-medium [overflow-wrap:anywhere]">{p.payerName ?? "–"}</dd>
      <dt className="text-muted-foreground">Sąskaita</dt>
      <dd className="min-w-0 tabular-nums [overflow-wrap:anywhere]">{p.payerIban ? formatIban(p.payerIban) : "–"}</dd>
      <dt className="text-muted-foreground">Paskirtis</dt>
      <dd className="min-w-0 [overflow-wrap:anywhere]">{p.remittance ?? "–"}</dd>
    </dl>
  );

  const errorLine = error && (
    <p role="alert" className="text-sm text-coral-ink">
      {error}
    </p>
  );

  const header = (
    <DialogHeader className="pr-12">
      <DialogTitle className="tabular-nums">{formatSignedEur(p.amount)}</DialogTitle>
      <DialogDescription>
        {formatDayMonth(p.date)} · {SOURCE_LABEL[p.source]} · {p.studentName ? `priskirta: ${p.studentName}` : p.hiddenReason ? "paslėpta" : "nepriskirta"}
      </DialogDescription>
    </DialogHeader>
  );

  const forgetBox = known && (
    <label className="flex items-start gap-2.5 text-sm">
      <input type="checkbox" checked={forget} onChange={(e) => setForget(e.target.checked)} className="mt-0.5 size-4 accent-foreground" />
      <span>
        Pamiršti šį mokėtoją <span className="text-muted-foreground">– kitaip jo mokėjimai ir toliau bus priskiriami: {known.name}</span>
      </span>
    </label>
  );

  if (p.hiddenReason) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        {details}
        <p className="text-sm text-muted-foreground">Paslėpta: {p.hiddenReason}. Į balansus neįskaičiuojama.</p>
        {errorLine}
        <DialogFooter>
          <DialogClose asChild>
            <button type="button" className={btn.ghost}>
              Uždaryti
            </button>
          </DialogClose>
          <button type="button" disabled={pending} onClick={() => run(() => unhidePayment(p.id))} className={btn.primary}>
            {pending ? "Saugoma…" : "Grąžinti į nepriskirtus"}
          </button>
        </DialogFooter>
      </div>
    );
  }

  if (mode === "unassign") {
    return (
      <div className="flex flex-col gap-5">
        <DialogHeader className="pr-12">
          <DialogTitle>Atsieti mokėjimą?</DialogTitle>
          <DialogDescription>
            {formatSignedEur(p.amount)} grįš į „Nepriskirti mokėjimai“, o mokinio balansas sumažės. Mokėjimas neištrinamas.
          </DialogDescription>
        </DialogHeader>
        {forgetBox}
        {errorLine}
        <DialogFooter>
          <button type="button" onClick={() => setMode("assign")} className={btn.ghost}>
            Atgal
          </button>
          <button type="button" disabled={pending} onClick={() => run(() => unassignPayment({ id: p.id, forget: !!known && forget }))} className={btn.primary}>
            {pending ? "Saugoma…" : "Atsieti"}
          </button>
        </DialogFooter>
      </div>
    );
  }

  if (mode === "hide") {
    return (
      <div className="flex flex-col gap-5">
        <DialogHeader className="pr-12">
          <DialogTitle>Paslėpti mokėjimą?</DialogTitle>
          <DialogDescription>Ne mokinio mokėjimas nebus rodomas tarp nepriskirtų ir neįsiskaičiuos į balansus. Jį visada galėsi grąžinti.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <label htmlFor="hide-reason" className={label}>
            Priežastis
          </label>
          <div className="flex flex-wrap gap-1.5">
            {HIDE_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                aria-pressed={reason === r}
                className={cn(btn.small, reason === r && "bg-primary text-primary-foreground shadow-button hover:bg-primary")}
              >
                {r}
              </button>
            ))}
          </div>
          <input id="hide-reason" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} className={field} />
        </div>
        {forgetBox}
        {errorLine}
        <DialogFooter>
          <button type="button" onClick={() => setMode("assign")} className={btn.ghost}>
            Atgal
          </button>
          <button type="button" disabled={pending || !reason.trim()} onClick={() => run(() => hidePayment({ id: p.id, reason, forget: !!known && forget }))} className={btn.primary}>
            {pending ? "Saugoma…" : "Paslėpti"}
          </button>
        </DialogFooter>
      </div>
    );
  }

  const changed = studentId !== (p.studentId ?? "");
  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!studentId) return setError("Pasirink mokinį.");
        run(() => assignPayment({ id: p.id, studentId, remember: canRemember && remember }));
      }}
    >
      {header}
      {details}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="bank-student" className={label}>
          Mokinys
        </label>
        <select id="bank-student" value={studentId} onChange={(e) => setStudentId(e.target.value)} className={cn(field, "px-3")}>
          <option value="" disabled>
            Pasirink mokinį…
          </option>
          {students
            .filter((s) => !s.archived || s.id === studentId)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.grade}
              </option>
            ))}
          {students.some((s) => s.archived && s.id !== studentId) && (
            <optgroup label="Archyvas">
              {students
                .filter((s) => s.archived && s.id !== studentId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.grade}
                  </option>
                ))}
            </optgroup>
          )}
        </select>
        {known && !p.studentId && <p className="text-[13px] text-muted-foreground">Šį mokėtoją Chalk žino: {known.name}.</p>}
      </div>

      {canRemember && (
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="mt-0.5 size-4 accent-foreground" />
          <span>
            Prisiminti šį mokėtoją <span className="text-muted-foreground">– kiti jo mokėjimai bus priskiriami automatiškai</span>
          </span>
        </label>
      )}

      {errorLine}

      <DialogFooter className="sm:items-center">
        <div className="flex gap-1 sm:mr-auto">
          {p.studentId && (
            <button type="button" onClick={() => setMode("unassign")} className={btn.ghost}>
              Atsieti
            </button>
          )}
          <button type="button" onClick={() => setMode("hide")} className={btn.danger}>
            Paslėpti
          </button>
        </div>
        <DialogClose asChild>
          <button type="button" className={btn.ghost}>
            Atšaukti
          </button>
        </DialogClose>
        <button type="submit" disabled={pending || (!changed && !!p.studentId && !remember)} className={btn.primary}>
          {pending ? "Saugoma…" : p.studentId ? "Išsaugoti" : "Priskirti"}
        </button>
      </DialogFooter>
    </form>
  );
}
