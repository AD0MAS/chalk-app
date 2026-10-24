"use client";

import { useLessonDialogs } from "@/components/lessons/use-lesson-dialogs";
import type { LessonPanelData } from "@/lib/notes/queries";
import { LessonPanelView } from "./lesson-panel";

/** /pamokos/[id] – the Pamoka panel as a page (direct links, opening in a new tab). */
export function LessonPage({ data }: { data: LessonPanelData }) {
  const { openMove, openCancel, restore, dialogs } = useLessonDialogs();
  return (
    <section className="glass glass-border rounded-sheet [background:var(--panel-gradient)] p-7 shadow-modal max-sm:p-4">
      <LessonPanelView data={data} inDialog={false} onChanged={() => {}} actions={{ onMove: openMove, onCancel: openCancel, onRestore: restore }} />
      {dialogs}
    </section>
  );
}
