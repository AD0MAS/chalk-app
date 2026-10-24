"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { BankInfo } from "@/lib/bank/constants";
import type { SyncInfo, SyncState } from "@/lib/google/types";

type DotState = SyncState | "warning";

const dots: Record<DotState, string> = {
  synced: "bg-sage shadow-[0_0_0_3px_color-mix(in_srgb,var(--sage)_30%,transparent)]",
  syncing: "bg-sand animate-pulse",
  warning: "bg-sand", // bank consent ends soon
  error: "bg-coral",
  off: "bg-muted-foreground/40",
};

function bankLabel(bank: BankInfo | undefined) {
  switch (bank?.state) {
    case undefined:
    case "off":
      return "Bankas neprijungtas";
    case "review":
      return "Bankas prijungtas · pirmas importas laukia patvirtinimo";
    case "ok":
      return "Bankas sinchronizuotas";
    case "warning":
      return `Banko sutikimas baigsis po ${bank?.daysLeft} d. – pratęsk Nustatymuose`;
    case "limited":
      return bank?.message ?? "Bankas laikinai riboja užklausas – bandysiu vėliau";
    default:
      return bank?.message ?? "Nepavyko sinchronizuoti su banku";
  }
}

/** One dot for both: the worst state wins (error > syncing > warning > synced > off). */
function combined(google: SyncState | undefined, bank: BankInfo | undefined): DotState {
  const b = bank?.state;
  if (google === "error" || b === "error" || b === "expired") return "error";
  if (google === "syncing") return "syncing";
  if (b === "warning") return "warning";
  // A bank rate limit is a calm pause, not an error – the dot stays Sage.
  if (google === "synced" || b === "ok" || b === "review" || b === "limited") return "synced";
  return "off";
}

function label(info: SyncInfo | null) {
  if (!info) return "Tikrinama Google Calendar būsena…";
  switch (info.state) {
    case "synced":
      return "Sinchronizuota su Google Calendar";
    case "syncing":
      return `Sinchronizuojama su Google Calendar… (${info.pending})`;
    case "error":
      return info.message ?? `Nesinchronizuota pamokų: ${info.failed}. Bandysiu dar kartą.`;
    case "off":
      return "Google Calendar neprijungtas";
  }
}

// How long to wait before asking the server again (ms). Syncing → quick, error → retry each minute.
const NEXT_CHECK: Record<SyncState, number> = { syncing: 1500, error: 60_000, synced: 60_000, off: 5 * 60_000 };

/**
 * Sync-status dot in the navbar (DESIGN.md §1.1): Sage = synced, Sand = syncing, Coral = error – for
 * Google Calendar and the bank together. `initial` / `bank` come from the server layout (fresh after every
 * Server Action). While something is pending or failed, the dot itself asks the server to sync Google –
 * that is the "retry later" for failed lessons. Opening Chalk also asks for new bank payments (attended, the server
 * does it at most every 2 h – lib/bank/budget.ts; the minute poll above is Google only); if any arrived, the page refreshes so the counts are right.
 */
export function SyncDot({ initial, bank: bankInitial }: { initial?: SyncInfo; bank?: BankInfo }) {
  const router = useRouter();
  const [info, setInfo] = useState<SyncInfo | null>(initial ?? null);
  const [seen, setSeen] = useState(initial);
  if (initial !== seen) {
    setSeen(initial);
    if (initial) setInfo(initial);
  }
  const [bank, setBank] = useState(bankInitial);
  const [seenBank, setSeenBank] = useState(bankInitial);
  if (bankInitial !== seenBank) {
    setSeenBank(bankInitial);
    setBank(bankInitial);
  }
  // Opening Chalk retries a failed sync right away; after that, once a minute.
  const retriedOnLoad = useRef(false);

  useEffect(() => {
    const state = info?.state;
    // Pending or failed → POST runs a sync (returns at once if one is already running).
    const method = state === "syncing" || state === "error" ? "POST" : "GET";
    const delay = !state ? 0 : state === "error" && !retriedOnLoad.current ? 0 : NEXT_CHECK[state];
    const timer = setTimeout(
      async () => {
        retriedOnLoad.current = true;
        try {
          const res = await fetch("/api/sync", { method, cache: "no-store" });
          if (res.ok) setInfo((await res.json()) as SyncInfo);
          else setInfo((prev) => (prev ? { ...prev } : prev)); // keep polling
        } catch {
          setInfo((prev) => (prev ? { ...prev } : prev));
        }
      },
      delay
    );
    return () => clearTimeout(timer);
  }, [info]);

  // Bank: once when Chalk opens (the navbar lives in the layout, so not again on every page).
  const bankAsked = useRef(false);
  const bankConnected = !!bankInitial && bankInitial.state !== "off";
  useEffect(() => {
    if (!bankConnected || bankAsked.current) return;
    bankAsked.current = true;
    fetch("/api/bank/sync", { method: "POST", cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<BankInfo>) : null))
      .then((next) => {
        if (!next) return;
        setBank(next);
        if (next.imported) router.refresh();
      })
      .catch(() => undefined); // never in the way – the status shows on the next load
  }, [bankConnected, router]);

  const state = combined(info?.state, bank);
  const text = `${label(info)} · ${bankLabel(bank)}`;
  const bankFirst = !!bank && ["error", "expired", "warning", "review", "limited"].includes(bank.state) && info?.state !== "error";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={bankFirst ? "/nustatymai#bankas" : "/nustatymai#google"}
          aria-label={text}
          className="flex size-7 shrink-0 items-center justify-center rounded-pill outline-offset-2 focus-visible:outline-2 focus-visible:outline-foreground/40"
        >
          <span aria-hidden="true" className={cn("size-2 rounded-pill", dots[state])} />
        </Link>
      </TooltipTrigger>
      <TooltipContent className="max-w-[260px]">
        <span className="block">{label(info)}</span>
        <span className="block">{bankLabel(bank)}</span>
      </TooltipContent>
    </Tooltip>
  );
}
