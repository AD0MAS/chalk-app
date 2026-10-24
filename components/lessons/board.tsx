"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { saveBoardUrl } from "@/lib/notes/actions";
import { btn, field } from "@/lib/ui";

// "Lenta" (SPEC §1 Student – permanent tldraw board link). If the student has no saved board yet,
// the button opens a new tldraw board and then offers to save its link to the student.

export const NEW_BOARD_URL = "https://www.tldraw.com/";

export type BoardStudent = { id: string; name: string };

export function BoardLink({
  url,
  onMissing,
  className,
  children,
}: {
  url: string | null;
  onMissing: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <button
      type="button"
      title="Lenta dar neišsaugota – atsidarys nauja"
      onClick={() => {
        window.open(NEW_BOARD_URL, "_blank", "noopener,noreferrer");
        onMissing();
      }}
      className={className}
    >
      {children}
    </button>
  );
}

/** "Išsaugoti lentos nuorodą?" – shown right after a new board was opened for a student without one. */
export function BoardSaveDialog({
  student,
  onOpenChange,
  onSaved,
}: {
  student: BoardStudent | null; // null = closed
  onOpenChange: (open: boolean) => void;
  onSaved?: (message: string) => void;
}) {
  return (
    <Dialog open={student !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        {student && (
          <BoardForm
            key={student.id}
            student={student}
            onDone={() => {
              onOpenChange(false);
              onSaved?.("Lentos nuoroda išsaugota");
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function BoardForm({ student, onDone }: { student: BoardStudent; onDone: () => void }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveBoardUrl(student.id, url);
      if (result.ok) onDone();
      else setError(result.message);
    });
  }

  return (
    <form onSubmit={submit} className="contents">
      <DialogHeader className="pr-12">
        <DialogTitle>Išsaugoti lentą?</DialogTitle>
        <DialogDescription className="text-sm leading-5">
          Nauja tldraw lenta atsidarė kitame skirtuke. Ten paspausk „Share“, nukopijuok nuorodą ir įklijuok čia – kitą kartą mokinio
          lenta atsidarys iškart.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="board-url" className="flex min-w-0 gap-1 text-sm font-medium">
          <span className="shrink-0">Lentos nuoroda ·</span>
          <span className="truncate-name">{student.name}</span>
        </label>
        <input
          id="board-url"
          inputMode="url"
          autoComplete="off"
          autoFocus
          required
          placeholder="https://www.tldraw.com/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-invalid={error ? true : undefined}
          className={field}
        />
        <span className="text-[13px] text-muted-foreground">Nuorodą visada gali pakeisti mokinio formoje.</span>
      </div>
      {error && (
        <p role="alert" className="text-sm text-coral-ink">
          {error}
        </p>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <button type="button" className={btn.ghost}>
            Ne dabar
          </button>
        </DialogClose>
        <button type="submit" disabled={pending || !url.trim()} className={btn.primary}>
          {pending ? "Saugoma…" : "Išsaugoti"}
        </button>
      </DialogFooter>
    </form>
  );
}

/** Lenta button with its own save dialog – for places outside the lesson dialogs (profile header). */
export function BoardButton({ student, url, className, children }: { student: BoardStudent; url: string | null; className?: string; children: React.ReactNode }) {
  const [asking, setAsking] = useState(false);
  return (
    <>
      <BoardLink url={url} onMissing={() => setAsking(true)} className={className}>
        {children}
      </BoardLink>
      <BoardSaveDialog student={asking ? student : null} onOpenChange={setAsking} />
    </>
  );
}
