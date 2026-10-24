"use client";

import { Printer } from "lucide-react";
import { btn } from "@/lib/ui";

/** Opens the browser's print dialog – the journal prints on A4 (globals.css @page). */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={btn.small}>
      <Printer aria-hidden="true" className="size-4" strokeWidth={1.75} />
      Spausdinti
    </button>
  );
}
