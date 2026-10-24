"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Notice } from "@/components/notice";
import { disconnectBank, syncBankNow } from "@/lib/bank/actions";
import { plural } from "@/lib/plural";
import { btn } from "@/lib/ui";

/** "Sinchronizuoti dabar", "Pratęsti" and "Atjungti" (with a second click to confirm). Also shows the connect result. */
export function BankActions({
  result,
  connected,
  canSync = true,
  limitedUntil = null,
  renewPrimary = false,
}: {
  result: string | null;
  connected: boolean;
  canSync?: boolean;
  limitedUntil?: string | null; // the bank asked to wait – "~14:30"
  renewPrimary?: boolean;
}) {
  const [notice, setNotice] = useState<string | null>(result);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const clear = useCallback(() => setNotice(null), []);

  // Drop ?bankas=… from the address bar so a reload does not show the message again.
  useEffect(() => {
    if (result) window.history.replaceState(null, "", "/nustatymai#bankas");
  }, [result]);

  const sync = () =>
    startTransition(async () => {
      try {
        const info = await syncBankNow();
        if (info.state === "error" || info.state === "expired") setNotice(info.message ?? "Nepavyko sinchronizuoti.");
        else if (info.retryAfter) setNotice(info.message ?? "Bankas laikinai riboja užklausas – bandysiu vėliau.");
        else if (info.skipped === "no-budget") setNotice("Foninių užklausų bankui per 24 val. nebeliko – bandyk vėliau.");
        else setNotice(info.imported ? `Nauji mokėjimai: ${plural(info.imported, ["mokėjimas", "mokėjimai", "mokėjimų"])}` : "Naujų mokėjimų nėra.");
      } catch {
        setNotice("Nepavyko sinchronizuoti. Bandyk dar kartą.");
      }
    });

  const disconnect = () =>
    startTransition(async () => {
      try {
        await disconnectBank();
        setConfirming(false);
        setNotice("Bankas atjungtas. Įkelti mokėjimai liko.");
      } catch {
        setNotice("Nepavyko atjungti. Bandyk dar kartą.");
      }
    });

  return (
    <>
      {connected &&
        (confirming ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Atjungti? Įkelti mokėjimai liks, bet nauji nebeateis.</span>
            <button type="button" onClick={disconnect} disabled={pending} className={btn.dangerSolid}>
              Atjungti
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={pending} className={btn.ghost}>
              Atšaukti
            </button>
          </div>
        ) : (
          <>
            <a href="/api/bank/connect" className={renewPrimary ? btn.primary : btn.secondary}>
              Pratęsti
            </a>
            {canSync && (
              <button
                type="button"
                onClick={sync}
                disabled={pending || !!limitedUntil}
                title={limitedUntil ? `Bankas laikinai riboja užklausas – kitas bandymas ${limitedUntil}` : undefined}
                className={btn.secondary}
              >
                {pending ? "Sinchronizuojama…" : "Sinchronizuoti dabar"}
              </button>
            )}
            <button type="button" onClick={() => setConfirming(true)} disabled={pending} className={btn.danger}>
              Atjungti
            </button>
          </>
        ))}
      <Notice message={notice} onClear={clear} />
    </>
  );
}
