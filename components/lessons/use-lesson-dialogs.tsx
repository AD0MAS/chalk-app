"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { Notice } from "@/components/notice";
import { LessonPanelDialog } from "@/components/notes/lesson-panel";
import { restoreLesson } from "@/lib/lessons/actions";
import type { LessonItem } from "@/lib/lessons/queries";
import { BoardSaveDialog, type BoardStudent } from "./board";
import { CancelDialog } from "./cancel-dialog";
import type { BlockActions } from "./lesson-block";
import { MoveDialog, type MovePreset } from "./move-dialog";

/**
 * Pamoka (notes) / Perkelti / Atšaukti / Atkurti / Lenta for any list of lessons
 * (Šiandien, Tvarkaraštis, profile, Laukia užrašų). Render `dialogs` once; call the openers from rows or blocks.
 */
export function useLessonDialogs() {
  const router = useRouter();
  const [moving, setMoving] = useState<{ lesson: LessonItem; preset?: MovePreset } | null>(null);
  const [cancelling, setCancelling] = useState<LessonItem | null>(null);
  const [notesFor, setNotesFor] = useState<string | null>(null);
  const [boardFor, setBoardFor] = useState<BoardStudent | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [restoring, startRestore] = useTransition();
  const clearNotice = useCallback(() => setNotice(null), []);

  const openMove = useCallback((lesson: LessonItem, preset?: MovePreset) => setMoving({ lesson, preset }), []);
  const openCancel = useCallback((lesson: LessonItem) => setCancelling(lesson), []);
  const openNotes = useCallback((lesson: LessonItem) => setNotesFor(lesson.id), []);
  const askBoard = useCallback((lesson: LessonItem) => setBoardFor({ id: lesson.studentId, name: lesson.name }), []);
  const restore = useCallback((lesson: LessonItem) => {
    startRestore(async () => {
      const result = await restoreLesson(lesson.id);
      setNotice(result.ok ? "Pamoka atkurta" : result.message);
    });
  }, []);

  /** Everything a lesson block's popover needs. */
  const blockActions = useCallback(
    (lesson: LessonItem): BlockActions => ({
      onMove: () => openMove(lesson),
      onCancel: () => openCancel(lesson),
      onRestore: () => restore(lesson),
      onNotes: () => openNotes(lesson),
      onBoardMissing: () => askBoard(lesson),
    }),
    [openMove, openCancel, restore, openNotes, askBoard]
  );

  const panelActions = useMemo(() => ({ onMove: openMove, onCancel: openCancel, onRestore: restore }), [openMove, openCancel, restore]);

  const dialogs = (
    <>
      <LessonPanelDialog
        lessonId={notesFor}
        onClose={(changed) => {
          setNotesFor(null);
          if (changed) router.refresh();
        }}
        actions={panelActions}
      />
      <MoveDialog lesson={moving?.lesson ?? null} preset={moving?.preset} onOpenChange={(open) => !open && setMoving(null)} onSaved={setNotice} />
      <CancelDialog
        lesson={cancelling}
        onOpenChange={(open) => !open && setCancelling(null)}
        onMoveInstead={(lesson) => {
          setCancelling(null);
          setMoving({ lesson });
        }}
        onSaved={setNotice}
      />
      <BoardSaveDialog student={boardFor} onOpenChange={(open) => !open && setBoardFor(null)} onSaved={setNotice} />
      <Notice message={notice} onClear={clearNotice} />
    </>
  );

  return { openMove, openCancel, openNotes, askBoard, restore, restoring, blockActions, dialogs };
}
