"use client";

import { useState, useTransition } from "react";
import { Notice } from "@/components/notice";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDayMonth } from "@/lib/lessons/time";
import { setOpeningBalance } from "@/lib/payments/actions";
import { OPENING_BALANCE_DATE, amountInput, parseAmount } from "@/lib/payments/constants";
import { btn, field, label, segment, segmentItem } from "@/lib/ui";
import { cn } from "@/lib/utils";

// "Pradinis likutis" – the balance a student had on 2026-10-21, when Chalk started counting lessons.
// Skola (owed money) is stored negative, Avansas (paid ahead) positive, nothing = 0.

type Kind = "none" | "debt" | "prepaid";

export function OpeningBalanceButton({
  studentId,
  studentName,
  current,
  className = btn.secondary,
}: {
  studentId: string;
  studentName: string;
  current: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        Pradinis likutis
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[480px]">
          {open && (
            <OpeningForm
              studentId={studentId}
              studentName={studentName}
              current={current}
              onDone={(message) => {
                setOpen(false);
                setNotice(message);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
      <Notice message={notice} onClear={() => setNotice(null)} />
    </>
  );
}

function OpeningForm({
  studentId,
  studentName,
  current,
  onDone,
}: {
  studentId: string;
  studentName: string;
  current: number;
  onDone: (message: string) => void;
}) {
  const [kind, setKind] = useState<Kind>(current < 0 ? "debt" : current > 0 ? "prepaid" : "none");
  const [amount, setAmount] = useState(current ? amountInput(Math.abs(current)) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    let value = "0";
    if (kind !== "none") {
      const n = parseAmount(amount);
      if (!Number.isFinite(n) || n <= 0) return setError("Įrašyk sumą, pvz. 50 arba 22,50.");
      value = String(kind === "debt" ? -n : n);
    }
    setError(null);
    startTransition(async () => {
      const result = await setOpeningBalance(studentId, value);
      if (result.ok) onDone("Pradinis likutis išsaugotas");
      else setError(result.message);
    });
  }

  const options: { value: Kind; label: string }[] = [
    { value: "none", label: "Nėra" },
    { value: "debt", label: "Skola" },
    { value: "prepaid", label: "Avansas" },
  ];

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <DialogHeader className="pr-12">
        <DialogTitle>
          Pradinis <em>likutis</em>
        </DialogTitle>
        <DialogDescription>
          {studentName} balansas {formatDayMonth(OPENING_BALANCE_DATE)}, kai Chalk pradėjo skaičiuoti pamokas. Ankstesnės
          pamokos ir mokėjimai čia nesuvedami – tik jų likutis.
        </DialogDescription>
      </DialogHeader>

      <fieldset className="flex flex-col gap-1.5">
        <legend className={cn(label, "mb-1.5")}>Tą dieną</legend>
        <div className={segment}>
          {options.map((o) => (
            <label key={o.value} className={segmentItem}>
              <input type="radio" name="opening-kind" value={o.value} checked={kind === o.value} onChange={() => setKind(o.value)} className="sr-only" />
              {o.label}
            </label>
          ))}
        </div>
        <span className="text-[13px] text-muted-foreground">
          {kind === "debt" && "Mokinys buvo skolingas – balansas prasidės nuo minuso."}
          {kind === "prepaid" && "Mokinys buvo sumokėjęs į priekį – balansas prasidės nuo pliuso."}
          {kind === "none" && "Atsiskaityta – balansas prasideda nuo 0 €."}
        </span>
      </fieldset>

      {kind !== "none" && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="opening-amount" className={label}>
            Suma
          </label>
          <div className={cn(field, "flex items-center gap-2 focus-within:shadow-[inset_0_0_0_1px_rgba(3,3,2,.3),0_0_0_3px_rgba(3,3,2,.08)]")}>
            <input
              id="opening-amount"
              inputMode="decimal"
              autoComplete="off"
              autoFocus
              placeholder="50"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="min-w-0 flex-1 bg-transparent font-medium tabular-nums outline-none placeholder:font-normal placeholder:text-muted-foreground/70"
            />
            <span className="shrink-0 text-muted-foreground">€</span>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-coral-ink">
          {error}
        </p>
      )}

      <DialogFooter>
        <DialogClose asChild>
          <button type="button" className={btn.ghost}>
            Atšaukti
          </button>
        </DialogClose>
        <button type="submit" disabled={pending} className={btn.primary}>
          {pending ? "Saugoma…" : "Išsaugoti"}
        </button>
      </DialogFooter>
    </form>
  );
}
