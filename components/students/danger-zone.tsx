"use client";

import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { deleteStudent, setArchived, type FormState } from "@/lib/students/actions";
import { btn, card, field } from "@/lib/ui";
import { cn } from "@/lib/utils";

/** Archive (keeps everything) and permanent delete (typed confirmation) – SPEC §1, §6. */
export function DangerZone({ studentId, firstName, archived }: { studentId: string; firstName: string; archived: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <section aria-labelledby="danger" className={cn(card, "mt-4 flex flex-col gap-4 p-6 max-sm:p-5")}>
      <h2 id="danger" className="font-serif text-2xl leading-[1.1] tracking-[-0.02em]">
        Archyvas ir ištrynimas
      </h2>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[220px] flex-1 flex-col">
          <span className="font-medium">{archived ? "Grąžinti iš archyvo" : "Archyvuoti"}</span>
          <span className="text-sm text-muted-foreground">
            {archived ? "Mokinys vėl bus sąraše su ankstesniu statusu." : "Viskas išsaugoma – užrašai, spragos, mokėjimai. Galima grąžinti bet kada."}
          </span>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => setArchived(studentId, !archived))}
          className={btn.secondary}
        >
          {archived ? <ArchiveRestore aria-hidden="true" className="size-4" strokeWidth={1.75} /> : <Archive aria-hidden="true" className="size-4" strokeWidth={1.75} />}
          {pending ? "Saugoma…" : archived ? "Grąžinti" : "Archyvuoti"}
        </button>
      </div>

      <div className="h-px bg-border" />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[220px] flex-1 flex-col">
          <span className="font-medium">Ištrinti visam laikui</span>
          <span className="text-sm text-muted-foreground">Ištrinami ir laikai, pamokos, užrašai, spragos. Mokėjimai lieka nepriskirti.</span>
        </div>
        <DeleteDialog studentId={studentId} firstName={firstName} />
      </div>
    </section>
  );
}

function DeleteDialog({ studentId, firstName }: { studentId: string; firstName: string }) {
  const [typed, setTyped] = useState("");
  const [state, formAction, pending] = useActionState<FormState, FormData>(deleteStudent.bind(null, studentId), {});
  const error = state && "errors" in state ? state.errors?.confirm : undefined;
  const message = state && "message" in state ? state.message : undefined;
  const matches = typed.trim() === firstName.trim();

  return (
    <Dialog onOpenChange={(open) => !open && setTyped("")}>
      <DialogTrigger asChild>
        <button type="button" className={btn.danger}>
          <Trash2 aria-hidden="true" className="size-4" strokeWidth={1.75} />
          Ištrinti…
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ištrinti visam laikui?</DialogTitle>
          <DialogDescription className="text-[15px] leading-[21px]">
            To atšaukti negalima. Jei mokinys tiesiog nebesimoko – geriau <b className="font-medium text-foreground">archyvuok</b>.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirm" className="text-sm font-medium">
              Įrašyk vardą <span className="font-semibold [overflow-wrap:anywhere]">{firstName}</span>, kad patvirtintum
            </label>
            <input
              id="confirm"
              name="confirm"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              aria-invalid={error ? true : undefined}
              className={field}
            />
            {error || message ? <span className="text-[13px] text-coral-ink">{error ?? message}</span> : null}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <button type="button" className={btn.ghost}>
                Atšaukti
              </button>
            </DialogClose>
            <button type="submit" disabled={!matches || pending} className={btn.dangerSolid}>
              {pending ? "Trinama…" : "Ištrinti visam laikui"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
