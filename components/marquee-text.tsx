"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const GAP = 48; // px between the end of the text and its next copy
const SPEED = 30; // px per second – calm, like a bus departure board

/**
 * One line of text that, only when it doesn't fit, scrolls left endlessly in place
 * (two copies with a gap, the second one hidden from screen readers). Pauses on hover and focus.
 * With prefers-reduced-motion it doesn't move – the text wraps onto the next line instead (globals.css).
 */
export function MarqueeText({ children, className }: { children: string; className?: string }) {
  const [distance, setDistance] = useState(0); // 0 = fits, static
  const observer = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: HTMLElement | null) => {
    observer.current?.disconnect();
    if (!node) return;
    const first = node.querySelector<HTMLElement>("[data-marquee-copy]");
    if (!first) return;
    const check = () => {
      const textWidth = first.getBoundingClientRect().width;
      setDistance(textWidth > node.clientWidth + 1 ? Math.round(textWidth + GAP) : 0);
    };
    const ro = new ResizeObserver(check);
    ro.observe(node);
    ro.observe(first);
    observer.current = ro;
    check();
  }, []);

  const moving = distance > 0;

  return (
    <span
      ref={ref}
      tabIndex={moving ? 0 : undefined}
      data-moving={moving || undefined}
      className={cn("marquee block", className)}
      style={moving ? ({ "--marquee-distance": `${distance}px`, "--marquee-duration": `${distance / SPEED}s` } as React.CSSProperties) : undefined}
    >
      <span className="marquee-track">
        <span data-marquee-copy>{children}</span>
        {moving ? (
          <span aria-hidden="true" className="marquee-copy-2" style={{ paddingLeft: GAP }}>
            {children}
          </span>
        ) : null}
      </span>
    </span>
  );
}
