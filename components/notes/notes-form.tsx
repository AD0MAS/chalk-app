"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { saveLessonNote } from "@/lib/notes/actions";
import { EMPTY_NOTE, NOTE_LABELS, NOTE_MAX, type NoteFields } from "@/lib/notes/constants";
import { field, textarea } from "@/lib/ui";
import { cn } from "@/lib/utils";

// The 4-field notes form with autosave (SPEC §3 screen 2): saves ~0.7 s after typing stops,
// on leaving a field, and when the panel closes (flush). A small status says "Išsaugota".

const DEBOUNCE = 700;

/** flush() saves anything unsaved; false = it could not be saved. */
export type NotesFormHandle = { flush: () => Promise<boolean> };

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export function NotesForm({
  lessonId,
  initial,
  disabled,
  hint,
  onSaved,
  ref,
}: {
  lessonId: string;
  initial: NoteFields | null;
  disabled?: boolean;
  hint: string; // under "Kitą kartą pradėti nuo"
  onSaved: () => void;
  ref?: React.Ref<NotesFormHandle>;
}) {
  const [state, setState] = useState<SaveState>(initial ? "saved" : "idle");
  const [error, setError] = useState<string | null>(null);

  const latest = useRef<NoteFields>(initial ?? EMPTY_NOTE);
  const dirty = useRef(false);
  const running = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Saves the latest values. One save at a time: typing during a save is saved right after it.
  // Resolves to false if the values could not be saved.
  const save = useCallback(async (): Promise<boolean> => {
    clearTimeout(timer.current);
    for (;;) {
      while (running.current) await running.current;
      if (!dirty.current) return true;
      dirty.current = false;
      setState("saving");
      const run = (async () => {
        try {
          const result = await saveLessonNote(lessonId, latest.current);
          if (result.ok) {
            setError(null);
            setState(dirty.current ? "dirty" : "saved");
            onSaved();
            return true;
          }
          setError(result.message);
        } catch {
          setError("Nepavyko išsaugoti – patikrink ryšį.");
        }
        dirty.current = true;
        setState("error");
        return false;
      })();
      running.current = run;
      const ok = await run;
      running.current = null;
      if (!ok) return false;
    }
  }, [lessonId, onSaved]);

  useImperativeHandle(ref, () => ({ flush: save }), [save]);

  // Don't lose typing when the tab is closed mid-save.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current || running.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  // The fields are uncontrolled; one change/blur handler on the form serves all four (by `name`).
  function change(e: React.FormEvent<HTMLFormElement>) {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    if (!(target.name in NOTE_LABELS)) return;
    latest.current = { ...latest.current, [target.name]: target.value };
    dirty.current = true;
    setState("dirty");
    clearTimeout(timer.current);
    timer.current = setTimeout(save, DEBOUNCE);
  }

  const fieldProps = (key: keyof NoteFields) => ({
    id: `note-${key}`,
    name: key,
    defaultValue: initial?.[key] ?? "",
    maxLength: NOTE_MAX,
    disabled,
  });

  return (
    <form
      onChange={change}
      onBlur={() => {
        if (dirty.current) void save();
      }}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="flex min-w-0 flex-[2_1_480px] flex-col gap-4 rounded-card border bg-card p-6 shadow-glass max-sm:p-4"
    >
      <div className="flex items-center gap-2.5">
        <h3 className="font-serif text-2xl leading-[1.1] tracking-[-0.02em]">Šios pamokos užrašai</h3>
        <SaveStatus state={state} error={error} onRetry={() => void save()} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="note-done" className="text-sm font-medium">
          {NOTE_LABELS.done}
        </label>
        <textarea {...fieldProps("done")} rows={3} className={cn(textarea, "min-h-0")} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="note-stoppedAt" className="text-sm font-medium">
            {NOTE_LABELS.stoppedAt}
          </label>
          <input {...fieldProps("stoppedAt")} autoComplete="off" className={field} />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="note-homework" className="text-sm font-medium">
            {NOTE_LABELS.homework}
          </label>
          <input {...fieldProps("homework")} autoComplete="off" className={field} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5 border-t pt-4">
        <label htmlFor="note-nextStart" className="text-sm font-medium">
          {NOTE_LABELS.nextStart}
        </label>
        <textarea
          {...fieldProps("nextStart")}
          rows={2}
          className={cn(textarea, "min-h-0 px-4 py-3.5 font-serif text-2xl leading-[1.25] tracking-[-0.02em] max-sm:text-xl")}
        />
        <span className="text-[13px] text-muted-foreground">{hint}</span>
      </div>
    </form>
  );
}

function SaveStatus({ state, error, onRetry }: { state: SaveState; error: string | null; onRetry: () => void }) {
  return (
    <span role="status" aria-live="polite" className="ml-auto flex shrink-0 items-center gap-1.5 text-[13px] whitespace-nowrap">
      {state === "saved" && (
        <span className="flex items-center gap-1.5 text-sage-ink">
          <Check aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
          Išsaugota
        </span>
      )}
      {(state === "saving" || state === "dirty") && (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <LoaderCircle aria-hidden="true" className={cn("size-3.5", state === "saving" && "animate-spin motion-reduce:animate-none")} strokeWidth={2} />
          Saugoma…
        </span>
      )}
      {state === "error" && (
        <span className="flex items-center gap-1.5 text-coral-ink">
          {error}
          <button type="button" onClick={onRetry} className="font-medium underline underline-offset-2">
            Bandyti dar kartą
          </button>
        </span>
      )}
    </span>
  );
}
