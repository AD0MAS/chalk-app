"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * One line of text that shrinks with "…" (DESIGN.md §9).
 * Only when it is actually cut off does it become focusable and show the full text
 * in a tooltip on hover and keyboard focus.
 *
 * Use inside flex/grid rows; keep meta (time, grade, amount) next to it with `shrink-0`.
 */
export function TruncatedText({
  children,
  className,
  as: Tag = "span",
}: {
  children: string;
  className?: string;
  as?: "span" | "p" | "div";
}) {
  const [isTruncated, setIsTruncated] = useState(false);
  const observer = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: HTMLElement | null) => {
    observer.current?.disconnect();
    if (!node) return;
    const check = () => setIsTruncated(node.scrollWidth > node.clientWidth + 1);
    const ro = new ResizeObserver(check);
    ro.observe(node);
    observer.current = ro;
    check();
  }, []);

  const text = (
    <Tag ref={ref} tabIndex={isTruncated ? 0 : undefined} className={cn("truncate-name block", className)}>
      {children}
    </Tag>
  );

  if (!isTruncated) return text;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{text}</TooltipTrigger>
      <TooltipContent>{children}</TooltipContent>
    </Tooltip>
  );
}
