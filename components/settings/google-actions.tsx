"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Notice } from "@/components/notice";
import { disconnectGoogle, resyncGoogle } from "@/lib/google/actions";
import { btn } from "@/lib/ui";

/** "Sinchronizuoti iš naujo" and "Atjungti" (with a second click to confirm). Also shows the connect result. */
export function GoogleActions({ result, connected = true }: { result: string | null; connected?: boolean }) {
  const [notice, setNotice] = useState<string | null>(result);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const clear = useCallback(() => setNotice(null), []);

  // Drop ?google=… from the address bar so a reload does not show the message again.
  useEffect(() => {
    if (result) window.history.replaceState(null, "", "/nustatymai#google");
  }, [result]);

  const resync = () =>
    startTransition(async () => {
      try {
        const info = await resyncGoogle();
        setNotice(info.state === "synced" ? "Visos pamokos sinchronizuotos." : "Sinchronizuota ne viskas – Chalk bandys dar kartą.");
      } catch {
        setNotice("Nepavyko sinchronizuoti. Bandyk dar kartą.");
      }
    });

  const disconnect = () =>
    startTransition(async () => {
      try {
        await disconnectGoogle();
        setConfirming(false);
        setNotice("Google Calendar atjungtas. Kalendorius „Pamokos“ liko Google'e.");
      } catch {
        setNotice("Nepavyko atjungti. Bandyk dar kartą.");
      }
    });

  return (
    <>
      {connected ? (
        confirming ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Atjungti? Įvykiai kalendoriuje „Pamokos“ liks, bet nebebus atnaujinami.</span>
            <button type="button" onClick={disconnect} disabled={pending} className={btn.dangerSolid}>
              Atjungti
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={pending} className={btn.ghost}>
              Atšaukti
            </button>
          </div>
        ) : (
          <>
            <button type="button" onClick={resync} disabled={pending} className={btn.secondary}>
              {pending ? "Sinchronizuojama…" : "Sinchronizuoti iš naujo"}
            </button>
            <button type="button" onClick={() => setConfirming(true)} disabled={pending} className={btn.danger}>
              Atjungti
            </button>
          </>
        )
      ) : null}
      <Notice message={notice} onClear={clear} />
    </>
  );
}
