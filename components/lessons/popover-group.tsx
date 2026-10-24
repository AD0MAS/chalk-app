"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

// One shared controller for all lesson popovers in a group (a day strip, the week view), so
// only one popover is ever open (DESIGN.md §9):
// - click / tap → opens pinned; while pinned, hovering other blocks opens nothing;
//   clicking another block switches straight to it (still pinned);
// - hover (mouse) → opens after a short delay; hovering another block switches to it.
// A single timer for the whole group, so a pending open / close can never race another block.

const HOVER_DELAY = 120;
const LEAVE_DELAY = 150;

type State = { id: string | null; pinned: boolean };
const CLOSED: State = { id: null, pinned: false };

type Controller = {
  hoverIn: (id: string) => void;
  hoverOut: () => void; // pointer left a block or its popover
  keep: () => void; // pointer entered the open popover – cancel a pending close
  toggle: (id: string) => void; // click / tap / Enter
  close: (id?: string) => void; // this block's popover (if it is the open one), or whichever is open
};

const Group = createContext<(Controller & { state: State }) | null>(null);

export function LessonPopoverGroup({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(CLOSED);
  const current = useRef(state); // read synchronously in event handlers
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const controller = useMemo<Controller>(() => {
    const set = (next: State) => {
      current.current = next;
      setState(next);
    };
    const later = (ms: number, then: () => void) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(then, ms);
    };
    return {
      hoverIn(id) {
        clearTimeout(timer.current);
        const s = current.current;
        if (s.pinned || s.id === id) return;
        later(HOVER_DELAY, () => set({ id, pinned: false }));
      },
      hoverOut() {
        clearTimeout(timer.current);
        const s = current.current;
        if (s.id !== null && !s.pinned) later(LEAVE_DELAY, () => set(CLOSED));
      },
      keep() {
        clearTimeout(timer.current);
      },
      toggle(id) {
        clearTimeout(timer.current);
        const s = current.current;
        // A hover-opened popover gets pinned by a click; a pinned one closes.
        set(s.id === id && s.pinned ? CLOSED : { id, pinned: true });
      },
      close(id) {
        clearTimeout(timer.current);
        if (id === undefined || current.current.id === id) set(CLOSED);
      },
    };
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const value = useMemo(() => ({ ...controller, state }), [controller, state]);
  return <Group.Provider value={value}>{children}</Group.Provider>;
}

/** This lesson's popover state + the group's (stable) controller functions. */
export function useLessonPopover(id: string) {
  const group = useContext(Group);
  if (!group) throw new Error("LessonBlock must be inside <LessonPopoverGroup>");
  const { state, ...controller } = group;
  return { open: state.id === id, pinned: state.id === id && state.pinned, ...controller };
}
