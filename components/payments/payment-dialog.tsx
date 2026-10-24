"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { Notice } from "@/components/notice";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDayMonth, todayVilnius } from "@/lib/lessons/time";
import { deletePayment, savePayment } from "@/lib/payments/actions";
import { amountInput } from "@/lib/payments/constants";
import type { PaymentItem, PaymentStudent } from "@/lib/payments/queries";
import { formatEur, toneDot } from "@/lib/students/constants";
import { btn, field, label } from "@/lib/ui";
import { cn } from "@/lib/utils";

// Manual payment (SPEC §1 Payments, Phase 1): student, amount, date (default today), optional note.
// Edit and delete (with confirmation) for manual payments only.

/** null = closed; { studentId } = new (optionally for a fixed student); { payment } = edit. */
export type PaymentDialogState = { studentId?: string } | { payment: PaymentItem } | null;

export function PaymentDialog({
  state,
  students,
  onOpenChange,
  onSaved,
}: {
  state: PaymentDialogState;
  students: PaymentStudent[];
  onOpenChange: (open: boolean) => void;
  onSaved: (message: string) => void;
}) {
  const editing = state && "payment" in state ? state.payment : null;
  return (
    <Dialog open={state !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        {state && (
          <PaymentForm
            key={editing?.id ?? "new"}
            payment={editing}
            fixedStudentId={!editing && "studentId" in state ? state.studentId : undefined}
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

function PaymentForm({
  payment,
  fixedStudentId,
  students,
  onDone,
}: {
  payment: PaymentItem | null;
  fixedStudentId?: string;
  students: PaymentStudent[];
  onDone: (message: string) => void;
}) {
  const [studentId, setStudentId] = useState(payment?.studentId ?? fixedStudentId ?? "");
  const [amount, setAmount] = useState(payment ? amountInput(payment.amount) : "");
  const [date, setDate] = useState(payment?.date ?? todayVilnius());
  const [note, setNote] = useState(payment?.note ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const student = students.find((s) => s.id === studentId);
  const locked = !!fixedStudentId; // opened from a profile: the student is given

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!student) return setError("Pasirink mokinį.");
    setError(null);
    startTransition(async () => {
      const result = await savePayment({ id: payment?.id, studentId, amount, date, note });
      if (result.ok) onDone(payment ? "Mokėjimas pakeistas" : `Mokėjimas pridėtas: ${student.name}, ${amount.trim()} €`);
      else setError(result.message);
    });
  }

  function remove() {
    if (!payment) return;
    setError(null);
    startTransition(async () => {
      const result = await deletePayment(payment.id);
      if (result.ok) onDone("Mokėjimas ištrintas");
      else setError(result.message);
    });
  }

  if (confirmDelete && payment) {
    return (
      <>
        <DialogHeader className="pr-12">
          <DialogTitle>Ištrinti mokėjimą?</DialogTitle>
          <DialogDescription>
            {payment.studentName ?? "Nepriskirtas"} · {formatEur(payment.amount)} · {formatDayMonth(payment.date)} Mokinio balansas sumažės{" "}
            {formatEur(payment.amount)}. Šio veiksmo atšaukti negalima.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-sm text-coral-ink">
            {error}
          </p>
        )}
        <DialogFooter>
          <button type="button" onClick={() => setConfirmDelete(false)} className={btn.ghost}>
            Palikti
          </button>
          <button type="button" disabled={pending} onClick={remove} className={btn.dangerSolid}>
            {pending ? "Trinama…" : "Ištrinti"}
          </button>
        </DialogFooter>
      </>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <DialogHeader className="pr-12">
        <DialogTitle>{payment ? <>Redaguoti <em>mokėjimą</em></> : <>Naujas <em>mokėjimas</em></>}</DialogTitle>
        <DialogDescription>Rankinis mokėjimas – grynieji ar pavedimas, kurį suvedi pats.</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="pay-student" className={label}>
          Mokinys
        </label>
        {locked && student ? (
          <span id="pay-student" className={cn(field, "flex items-center gap-2.5 bg-muted")}>
            <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-pill", toneDot(student.tone))} />
            <span className="truncate-name font-medium">{student.name}</span>
            <span className="shrink-0 text-sm text-muted-foreground">{student.grade}</span>
          </span>
        ) : (
          <select id="pay-student" value={studentId} onChange={(e) => setStudentId(e.target.value)} className={cn(field, "px-3")}>
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
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pay-amount" className={label}>
            Suma
          </label>
          <div className={cn(field, "flex items-center gap-2 focus-within:shadow-[inset_0_0_0_1px_rgba(3,3,2,.3),0_0_0_3px_rgba(3,3,2,.08)]")}>
            <input
              id="pay-amount"
              inputMode="decimal"
              autoComplete="off"
              autoFocus={!payment}
              placeholder={student ? amountInput(student.price) : "25"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="min-w-0 flex-1 bg-transparent font-medium tabular-nums outline-none placeholder:font-normal placeholder:text-muted-foreground/70"
            />
            <span className="shrink-0 text-muted-foreground">€</span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pay-date" className={label}>
            Data
          </label>
          <input id="pay-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={cn(field, "tabular-nums")} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="pay-note" className={label}>
          Pastaba <span className="font-normal text-muted-foreground">· neprivaloma</span>
        </label>
        <input
          id="pay-note"
          maxLength={300}
          autoComplete="off"
          placeholder="pvz. grynieji po pamokos"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={field}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-coral-ink">
          {error}
        </p>
      )}

      <DialogFooter className="sm:items-center">
        {payment && (
          <button type="button" onClick={() => setConfirmDelete(true)} className={cn(btn.danger, "sm:mr-auto")}>
            Ištrinti
          </button>
        )}
        <DialogClose asChild>
          <button type="button" className={btn.ghost}>
            Atšaukti
          </button>
        </DialogClose>
        <button type="submit" disabled={pending} className={btn.primary}>
          {pending ? "Saugoma…" : payment ? "Išsaugoti" : "Pridėti"}
        </button>
      </DialogFooter>
    </form>
  );
}

/** "+ Mokėjimas" button with its own dialog and toast. */
export function NewPaymentButton({
  students,
  studentId,
  className = btn.primary,
  children,
}: {
  students: PaymentStudent[];
  studentId?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [state, setState] = useState<PaymentDialogState>(null);
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <>
      <button type="button" onClick={() => setState({ studentId })} className={className}>
        {children ?? (
          <>
            <Plus aria-hidden="true" className="size-4" strokeWidth={2.2} />
            Mokėjimas
          </>
        )}
      </button>
      <PaymentDialog state={state} students={students} onOpenChange={(open) => !open && setState(null)} onSaved={setNotice} />
      <Notice message={notice} onClear={() => setNotice(null)} />
    </>
  );
}
