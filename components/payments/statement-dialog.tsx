"use client";

import { FileUp } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { Notice } from "@/components/notice";
import { TruncatedText } from "@/components/truncated-text";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { importStatement, type StatementResult } from "@/lib/bank/actions";
import { formatDayMonth } from "@/lib/lessons/time";
import { formatSignedEur } from "@/lib/payments/constants";
import { plural } from "@/lib/plural";
import { formatEur } from "@/lib/students/constants";
import { btn } from "@/lib/ui";
import { cn } from "@/lib/utils";

// Mokėjimai → "Įkelti išrašą" – the fallback when the bank sync isn't available (SPEC §1 Payments).
// Two steps: choose the file → see exactly what would be imported → "Importuoti". Nothing is written before that.
// Same rules as the bank sync: incoming EUR from 2026-10-21, no duplicates, known payers assigned.

type Preview = Extract<StatementResult, { ok: true }>;

export function StatementButton() {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btn.secondary}>
        <FileUp aria-hidden="true" className="size-4" strokeWidth={1.75} />
        Įkelti išrašą
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[560px]">
          {open && (
            <StatementForm
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

function StatementForm({ onDone }: { onDone: (message: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const send = (f: File, apply: boolean) => {
    const form = new FormData();
    form.set("file", f);
    setError(null);
    startTransition(async () => {
      const result = await importStatement(form, apply);
      if (!result.ok) return setError(result.message);
      if (apply) onDone(result.imported ? `Importuota: ${plural(result.imported, ["mokėjimas", "mokėjimai", "mokėjimų"])}` : "Naujų mokėjimų nebuvo");
      else setPreview(result);
    });
  };

  const fresh = preview?.rows.filter((r) => !r.duplicate) ?? [];
  const dupes = (preview?.rows.length ?? 0) - fresh.length;
  const total = fresh.reduce((s, r) => s + r.amount, 0);
  const skipped = preview ? preview.skipped.outgoing + preview.skipped.early : 0;

  return (
    <div className="flex flex-col gap-5">
      <DialogHeader className="pr-12">
        <DialogTitle>
          Įkelti <em>išrašą</em>
        </DialogTitle>
        <DialogDescription>
          Internetinėje bankininkystėje atsisiųsk sąskaitos išrašą ir išsaugok jį kaip „CSV UTF-8“.
          Chalk paims tik gautus mokėjimus nuo 2026-10-21; jau esami nebus įkelti antrą kartą.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv,.xls,.xlsx"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            setPreview(null);
            if (f) send(f, false);
          }}
        />
        <button type="button" onClick={() => input.current?.click()} disabled={pending} className={btn.secondary}>
          <FileUp aria-hidden="true" className="size-4" strokeWidth={1.75} />
          {file ? "Kitas failas" : "Pasirinkti failą"}
        </button>
        {file && <TruncatedText className="text-sm text-muted-foreground">{file.name}</TruncatedText>}
      </div>

      {pending && !preview && <div className="h-24 animate-pulse rounded-tile bg-muted" aria-label="Skaitoma" />}

      {preview && (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            {fresh.length ? (
              <>
                <span className="font-medium">
                  {plural(fresh.length, ["naujas mokėjimas", "nauji mokėjimai", "naujų mokėjimų"])} · {formatEur(total)}
                </span>
                {fresh.some((r) => !r.studentName) && <span className="text-muted-foreground"> · nežinomi mokėtojai pateks į „Nepriskirti“</span>}
              </>
            ) : (
              <span className="font-medium">Naujų mokėjimų nėra</span>
            )}
            {(dupes > 0 || skipped > 0) && (
              <span className="block text-muted-foreground">
                {[
                  dupes ? `${dupes} jau yra Chalk'e` : null,
                  preview.skipped.outgoing ? plural(preview.skipped.outgoing, ["išlaida praleista", "išlaidos praleistos", "išlaidų praleista"]) : null,
                  preview.skipped.early ? `${plural(preview.skipped.early, ["senesnis", "senesni", "senesnių"])} nei 2026-10-21` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            )}
          </p>
          {preview.rows.length > 0 && (
            <ul className="max-h-[300px] overflow-y-auto rounded-tile border p-1.5">
              {preview.rows.map((r, i) => (
                <li key={i} className={cn("flex min-h-11 items-center gap-3 rounded-tile px-2.5 py-1.5 text-sm", r.duplicate && "text-muted-foreground")}>
                  <span className="w-[68px] shrink-0 whitespace-nowrap tabular-nums">{formatDayMonth(r.date).replace(" d.", "")}</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <TruncatedText className="font-medium">{r.payerName ?? "Nežinomas mokėtojas"}</TruncatedText>
                    <TruncatedText className="text-[13px] text-muted-foreground">
                      {`${r.duplicate ? "jau yra Chalk'e" : r.studentName ? `→ ${r.studentName}` : "→ nepriskirtas"}${r.remittance ? ` · ${r.remittance}` : ""}`}
                    </TruncatedText>
                  </span>
                  <span className={cn("shrink-0 font-medium tabular-nums", !r.duplicate && "text-sage-ink", r.duplicate && "line-through")}>{formatSignedEur(r.amount)}</span>
                </li>
              ))}
            </ul>
          )}
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
        <button type="button" disabled={pending || !file || !fresh.length} onClick={() => file && send(file, true)} className={btn.primary}>
          {pending && preview ? "Importuojama…" : fresh.length ? `Importuoti ${fresh.length}` : "Importuoti"}
        </button>
      </DialogFooter>
    </div>
  );
}
