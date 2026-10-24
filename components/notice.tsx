"use client";

import { Check } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

/**
 * Small glass toast at the bottom of the screen; disappears after a few seconds.
 * Portaled to <body> so it is never trapped inside a glass (backdrop-filter) parent like the navbar.
 * Renders nothing on the server (there is no <body> to portal into) – safe to start with a message.
 */
export function Notice({ message, onClear }: { message: string | null; onClear: () => void }) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onClear, 4000);
    return () => clearTimeout(timer);
  }, [message, onClear]);

  if (!message || !mounted) return null;
  return createPortal(
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-6 z-[60] flex justify-center">
      <span
        className="glass-border flex max-w-full animate-enter items-center gap-2 rounded-pill py-2.5 pr-4 pl-3 text-[15px] shadow-glass backdrop-blur-[12px]"
        style={{ background: "var(--navbar-gradient)" }}
      >
        <Check aria-hidden="true" className="size-4 shrink-0 text-sage-ink" strokeWidth={2.2} />
        <span className="min-w-0 [overflow-wrap:anywhere]">{message}</span>
      </span>
    </div>,
    document.body
  );
}

const noop = () => () => {};
