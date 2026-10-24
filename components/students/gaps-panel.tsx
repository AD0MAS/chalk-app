"use client";

import { Check, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useActionState, useRef, useState, useTransition } from "react";
import { addGap, deleteGap, setGapResolved, type FormState } from "@/lib/students/actions";
import { btn, card, field } from "@/lib/ui";
import { cn } from "@/lib/utils";

type Gap = { id: string; text: string; created_at: string; resolved_at: string | null };

const day = (iso: string) => iso.slice(0, 10);

/** Spragos: add, mark as resolved (and back), delete with a second click to confirm. */
export function GapsPanel({ studentId, gaps }: { studentId: string; gaps: Gap[] }) {
  const open = gaps.filter((g) => !g.resolved_at).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const resolved = gaps.filter((g) => g.resolved_at).sort((a, b) => b.resolved_at!.localeCompare(a.resolved_at!));

  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, adding] = useActionState<FormState, FormData>(async (prev, fd) => {
    const result = await addGap(studentId, prev, fd);
    if ("ok" in result && result.ok) formRef.current?.reset();
    return result;
  }, {});
  const error = state && "errors" in state ? state.errors?.text : state && "message" in state ? state.message : undefined;

  return (
    <section aria-labelledby="gaps" className={cn(card, "flex flex-col gap-3.5 p-6 max-sm:p-5")}>
      <h2 id="gaps" className="font-serif text-2xl leading-[1.1] tracking-[-0.02em]">
        Spragos
      </h2>

      {open.length === 0 ? (
        <p className="text-sm text-muted-foreground">Atvirų spragų nėra.</p>
      ) : (
        <ul className="flex flex-col">
          {open.map((g, i) => (
            <GapRow key={g.id} studentId={studentId} gap={g} first={i === 0} />
          ))}
        </ul>
      )}

      {/* @container: the "Pridėti" label hides when the column is narrow, so the placeholder always fits (DESIGN.md §9) */}
      <form ref={formRef} action={formAction} className="@container flex gap-2">
        <label htmlFor="gap-text" className="sr-only">
          Nauja spraga
        </label>
        <input id="gap-text" name="text" maxLength={200} placeholder="Nauja spraga, pvz. Lygtys" aria-invalid={error ? true : undefined} className={cn(field, "h-10")} />
        <button type="submit" disabled={adding} className={btn.small} aria-label="Pridėti spragą">
          <Plus aria-hidden="true" className="size-3.5" strokeWidth={2} />
          <span className="@max-[340px]:sr-only">Pridėti</span>
        </button>
      </form>
      {error ? <span className="-mt-2 text-[13px] text-coral-ink">{error}</span> : null}

      {resolved.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-[13px] font-medium text-muted-foreground select-none">Išspręstos ({resolved.length})</summary>
          <ul className="mt-2 flex flex-col">
            {resolved.map((g, i) => (
              <GapRow key={g.id} studentId={studentId} gap={g} first={i === 0} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function GapRow({ studentId, gap, first }: { studentId: string; gap: Gap; first: boolean }) {
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isResolved = !!gap.resolved_at;

  return (
    <li className={cn("flex items-center gap-2.5 py-2.5", !first && "border-t border-border/60", pending && "opacity-60")}>
      {isResolved ? (
        <Check aria-hidden="true" className="size-3.5 shrink-0 text-sage-ink" strokeWidth={2.5} />
      ) : (
        <span aria-hidden="true" className="size-2 shrink-0 rounded-pill bg-clay" />
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn("[overflow-wrap:anywhere]", isResolved ? "text-muted-foreground line-through" : "font-medium")}>{gap.text}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {isResolved ? `išspręsta ${day(gap.resolved_at!)}` : `nuo ${day(gap.created_at)}`}
        </span>
      </span>

      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => setGapResolved(studentId, gap.id, !isResolved))}
        aria-label={isResolved ? `Grąžinti „${gap.text}“ į atviras` : `Pažymėti „${gap.text}“ kaip išspręstą`}
        title={isResolved ? "Grąžinti į atviras" : "Išspręsta"}
        className={cn(btn.small, "size-9 px-0")}
      >
        {isResolved ? <RotateCcw aria-hidden="true" className="size-3.5" strokeWidth={2} /> : <Check aria-hidden="true" className="size-3.5" strokeWidth={2.5} />}
      </button>

      {confirmDelete ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => deleteGap(studentId, gap.id))}
          onBlur={() => setConfirmDelete(false)}
          autoFocus
          className={cn(btn.danger, "h-9 px-3 text-sm")}
        >
          Ištrinti?
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          aria-label={`Ištrinti „${gap.text}“`}
          title="Ištrinti"
          className={cn(btn.ghost, "size-9 px-0 text-muted-foreground")}
        >
          <Trash2 aria-hidden="true" className="size-3.5" strokeWidth={1.75} />
        </button>
      )}
    </li>
  );
}
