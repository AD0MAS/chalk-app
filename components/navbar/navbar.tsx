"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Banknote, ChevronDown, Menu, Plus, Users, Wrench, X } from "lucide-react";
import { Suspense, useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { NewLessonButton } from "@/components/lessons/new-lesson";
import type { BankInfo } from "@/lib/bank/constants";
import type { SyncInfo } from "@/lib/google/types";
import { cn } from "@/lib/utils";
import { activeKey, menus, topItems, type MenuKey, type NavCounts, type NavTile } from "./nav-data";
import { SyncDot } from "./sync-dot";
import { Wordmark } from "./wordmark";

// The floating glass pill navbar – docs/DESIGN.md §1. The bar itself morphs into the menu panel.

const BAR_HEIGHT = 52;
const HOVER_DELAY = 120; // ms before a hovered item opens its menu
const LEAVE_DELAY = 150; // ms before a hover-opened menu closes after the pointer leaves
const SPRING = { type: "spring", stiffness: 400, damping: 35 } as const;

type OpenState = MenuKey | "mobile" | null;

/** `counts` = live counts for menu tiles, `sync` / `bank` = Google Calendar / bank status (all loaded in app/(app)/layout.tsx). */
export function Navbar({ counts = {}, sync, bank }: { counts?: NavCounts; sync?: SyncInfo; bank?: BankInfo }) {
  // usePathname needs a Suspense boundary on routes with dynamic params (cacheComponents).
  return (
    <Suspense fallback={<NavbarView pathname={null} counts={counts} sync={sync} bank={bank} />}>
      <NavbarWithPathname counts={counts} sync={sync} bank={bank} />
    </Suspense>
  );
}

function NavbarWithPathname({ counts, sync, bank }: { counts: NavCounts; sync?: SyncInfo; bank?: BankInfo }) {
  const pathname = usePathname();
  return <NavbarView pathname={pathname} counts={counts} sync={sync} bank={bank} />;
}

function NavbarView({ pathname, counts, sync, bank }: { pathname: string | null; counts: NavCounts; sync?: SyncInfo; bank?: BankInfo }) {
  const [open, setOpen] = useState<OpenState>(null);
  const [openedByHover, setOpenedByHover] = useState(false);
  const [panelHeight, setPanelHeight] = useState(0);
  const reduceMotion = useReducedMotion();

  const navRef = useRef<HTMLElement>(null);
  const triggers = useRef<Partial<Record<Exclude<OpenState, null>, HTMLButtonElement | null>>>({});
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const resizeObserver = useRef<ResizeObserver | null>(null);
  const focusFirstOnMount = useRef(false);

  const current = activeKey(pathname);
  const isOpen = open !== null;

  const clearTimer = () => clearTimeout(hoverTimer.current);

  const close = useCallback((returnFocusTo?: Exclude<OpenState, null>) => {
    clearTimeout(hoverTimer.current);
    setOpen(null);
    setOpenedByHover(false);
    if (returnFocusTo) triggers.current[returnFocusTo]?.focus({ preventScroll: true });
  }, []);

  // Close on outside click and Esc.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) close();
    };
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") close(open);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  // Measure the panel so the bar can animate to exactly its height (also when switching menus).
  const panelRef = useCallback((node: HTMLDivElement | null) => {
    resizeObserver.current?.disconnect();
    if (!node) return;
    const ro = new ResizeObserver(() => setPanelHeight(node.offsetHeight));
    ro.observe(node);
    resizeObserver.current = ro;
    if (focusFirstOnMount.current) {
      focusFirstOnMount.current = false;
      node.querySelector<HTMLElement>("[data-menuitem]")?.focus({ preventScroll: true });
    }
  }, []);

  function toggle(key: Exclude<OpenState, null>) {
    clearTimer();
    if (open === key && !openedByHover) {
      close();
    } else {
      setOpen(key);
      setOpenedByHover(false); // a click "pins" the menu open
    }
  }

  function hoverOpen(key: MenuKey) {
    clearTimer();
    if (open === key) return;
    hoverTimer.current = setTimeout(() => {
      setOpen(key);
      // Switching from a click-pinned menu keeps it pinned.
      setOpenedByHover((prev) => (open === null ? true : prev));
    }, HOVER_DELAY);
  }

  function onNavPointerLeave(e: React.PointerEvent) {
    clearTimer();
    if (e.pointerType !== "mouse" || !openedByHover) return;
    hoverTimer.current = setTimeout(() => close(), LEAVE_DELAY);
  }

  function onTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>, key: MenuKey) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusFirstOnMount.current = true;
      if (open === key) {
        navRef.current?.querySelector<HTMLElement>("[role=menu] [data-menuitem]")?.focus({ preventScroll: true });
        focusFirstOnMount.current = false;
      } else {
        setOpen(key);
        setOpenedByHover(false);
      }
    }
  }

  // Arrow keys move between tiles inside the open panel.
  function onPanelKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(e.key)) return;
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[data-menuitem]"));
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (index === -1) return;
    e.preventDefault();
    let next = index;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (index + 1) % items.length;
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = items.length - 1;
    items[next]?.focus({ preventScroll: true });
  }

  // Close when keyboard focus moves to something outside the navbar (Tab).
  function onNavBlur(e: React.FocusEvent) {
    const next = e.relatedTarget as Node | null;
    if (open && next && !navRef.current?.contains(next)) close();
  }

  const itemColor = (key: string) =>
    isOpen && open !== key && open !== "mobile" ? "text-dimmed-foreground" : "text-foreground";

  const transition = reduceMotion ? { duration: 0 } : { ...SPRING, delay: isOpen ? 0 : 0.08 };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-8 z-50 px-12 max-md:top-4 max-md:px-4 print:hidden">
      <motion.nav
        ref={navRef}
        data-navbar
        aria-label="Pagrindinis meniu"
        onPointerLeave={onNavPointerLeave}
        onPointerEnter={() => openedByHover && clearTimer()}
        onBlur={onNavBlur}
        // overflow:hidden still scrolls when focus lands on a tile while the bar is growing – keep the top row in place.
        onScroll={(e) => {
          e.currentTarget.scrollTop = 0;
        }}
        initial={false}
        animate={{ height: isOpen ? BAR_HEIGHT + panelHeight : BAR_HEIGHT, borderRadius: isOpen ? 26 : 64 }}
        transition={transition}
        style={{ background: "var(--navbar-gradient)" }}
        className={cn(
          "glass-border pointer-events-auto relative mx-auto max-w-[920px] overflow-hidden shadow-glass transition-[backdrop-filter] duration-100",
          "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-white",
          isOpen ? "backdrop-blur-[12px]" : "backdrop-blur-[4px]"
        )}
      >
        {/* Top row – always in place */}
        <div className="relative flex h-[52px] items-center justify-between gap-4 py-2 pr-2 pl-4">
          <Wordmark onNavigate={() => close()} />

          <div className="hidden items-center gap-5 md:flex">
            {topItems.map((item) =>
              item.type === "link" ? (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => close()}
                  aria-current={current === item.key ? "page" : undefined}
                  className={cn(
                    "relative rounded-pill whitespace-nowrap outline-offset-4 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-foreground/40",
                    itemColor(item.key)
                  )}
                >
                  {item.label}
                  <ActiveDot show={!isOpen && current === item.key} />
                </Link>
              ) : (
                <button
                  key={item.key}
                  ref={(el) => {
                    triggers.current[item.key] = el;
                  }}
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={open === item.key}
                  aria-controls={open === item.key ? `nav-menu-${item.key}` : undefined}
                  onClick={() => toggle(item.key)}
                  onPointerEnter={(e) => e.pointerType === "mouse" && hoverOpen(item.key)}
                  onPointerLeave={clearTimer}
                  onKeyDown={(e) => onTriggerKeyDown(e, item.key)}
                  className={cn(
                    "relative flex items-center gap-[3px] rounded-pill whitespace-nowrap outline-offset-4 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-foreground/40",
                    itemColor(item.key)
                  )}
                >
                  {item.label}
                  <ChevronDown
                    aria-hidden="true"
                    className={cn("size-3.5 transition-transform duration-200", open === item.key && "rotate-180")}
                  />
                  <ActiveDot show={!isOpen && current === item.key} className="-ml-[9px]" />
                </button>
              )
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2 lg:gap-3.5">
            <SyncDot initial={sync} bank={bank} />
            <Link
              href="/nustatymai"
              onClick={() => close()}
              aria-current={current === "nustatymai" ? "page" : undefined}
              className={cn(
                "hidden rounded-pill whitespace-nowrap outline-offset-4 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-foreground/40 lg:inline",
                itemColor("nustatymai"),
                current === "nustatymai" && !isOpen && "font-medium"
              )}
            >
              Nustatymai
            </Link>
            <NewLessonButton
              ariaLabel="Nauja pamoka"
              className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-pill bg-primary text-base font-medium text-primary-foreground shadow-button transition-all duration-200 outline-offset-2 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-foreground/40 max-lg:w-10 md:h-9 lg:px-3.5"
            >
              <Plus aria-hidden="true" className="size-4" strokeWidth={2.2} />
              <span className="hidden lg:inline">Pamoka</span>
            </NewLessonButton>
            <button
              ref={(el) => {
                triggers.current.mobile = el;
              }}
              type="button"
              aria-label={open === "mobile" ? "Uždaryti meniu" : "Atidaryti meniu"}
              aria-expanded={open === "mobile"}
              aria-controls={open === "mobile" ? "nav-menu-mobile" : undefined}
              onClick={() => toggle("mobile")}
              className="flex size-10 items-center justify-center rounded-pill bg-white/70 text-foreground outline-offset-2 focus-visible:outline-2 focus-visible:outline-foreground/40 md:hidden dark:bg-white/10"
            >
              {open === "mobile" ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
            </button>
          </div>
        </div>

        {/* Panel – fades in while the bar grows, fades out before it shrinks */}
        <AnimatePresence mode="wait" initial={false}>
          {open && (
            <motion.div
              key={open}
              ref={panelRef}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: reduceMotion ? 0 : 0.2, delay: reduceMotion ? 0 : 0.05 } }}
              exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : 0.08 } }}
              onKeyDown={onPanelKeyDown}
              className="relative"
            >
              {open === "mobile" ? (
                <MobilePanel current={current} counts={counts} onNavigate={() => close()} />
              ) : (
                <MenuPanel menuKey={open} counts={counts} onNavigate={() => close()} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>
    </div>
  );
}

function ActiveDot({ show, className }: { show: boolean; className?: string }) {
  if (!show) return null;
  return (
    <span
      aria-hidden="true"
      className={cn("absolute -bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-pill bg-foreground", className)}
    />
  );
}

/* ---------------- Desktop panel: 2×2 large tiles + compact right column ---------------- */

function MenuPanel({ menuKey, counts, onNavigate }: { menuKey: MenuKey; counts: NavCounts; onNavigate: () => void }) {
  const menu = menus[menuKey];
  return (
    <div role="menu" id={`nav-menu-${menu.key}`} aria-label={menu.label} className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-2 p-2">
      <div className="grid grid-cols-2 gap-2">
        {menu.tiles.map((tile) => (
          <TileLink
            key={tile.label}
            tile={tile}
            onNavigate={onNavigate}
            className="flex h-[98px] flex-col justify-between rounded-tile bg-tile p-3 transition-transform duration-200 ease-standard hover:scale-105"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <tile.icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.75} />
              <span className="truncate-name font-medium">{tile.label}</span>
              <TileCount tile={tile} counts={counts} />
            </span>
            <span className="truncate-name text-sm leading-[16.8px] tracking-[-0.2px] text-muted-foreground">{tile.description}</span>
          </TileLink>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {menu.compact.map((tile) => (
          <TileLink
            key={tile.label}
            tile={tile}
            onNavigate={onNavigate}
            className="flex min-h-[46px] flex-1 items-center gap-2.5 rounded-tile bg-tile px-3 font-medium transition-transform duration-200 ease-standard hover:scale-105"
          >
            <tile.icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.75} />
            <span className="truncate-name">{tile.label}</span>
            <TileCount tile={tile} counts={counts} />
          </TileLink>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Mobile panel: same tiles stacked in one column ---------------- */

const mobileSections: { key: MenuKey; icon: typeof Users }[] = [
  { key: "mokiniai", icon: Users },
  { key: "finansai", icon: Banknote },
  { key: "irankiai", icon: Wrench },
];

function MobilePanel({ current, counts, onNavigate }: { current: string | null; counts: NavCounts; onNavigate: () => void }) {
  // All sections start collapsed; one at a time is open.
  const [expanded, setExpanded] = useState<MenuKey | null>(null);
  const mobileTile = "flex items-center gap-3 rounded-tile bg-tile px-3 transition-transform duration-200 ease-standard hover:translate-x-2";

  return (
    <div role="menu" id="nav-menu-mobile" aria-label="Meniu" className="flex flex-col gap-2 px-2 pt-1 pb-2">
      <div className="grid grid-cols-2 gap-2">
        <Link href="/" role="menuitem" data-menuitem onClick={onNavigate} aria-current={current === "siandien" ? "page" : undefined} className={cn(mobileTile, "h-12 font-medium", current === "siandien" && "bg-card")}>
          Šiandien
        </Link>
        <Link href="/tvarkarastis" role="menuitem" data-menuitem onClick={onNavigate} aria-current={current === "tvarkarastis" ? "page" : undefined} className={cn(mobileTile, "h-12 font-medium", current === "tvarkarastis" && "bg-card")}>
          Tvarkaraštis
        </Link>
      </div>

      {mobileSections.map(({ key, icon: Icon }) => {
        const menu = menus[key];
        const isExpanded = expanded === key;
        return (
          <div key={key} className="flex flex-col gap-2">
            <button
              type="button"
              data-menuitem
              aria-expanded={isExpanded}
              onClick={() => setExpanded(isExpanded ? null : key)}
              className="flex h-[52px] items-center gap-3 rounded-tile bg-tile px-3 text-left font-medium"
            >
              <Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.75} />
              <span className="truncate-name">{menu.label}</span>
              <ChevronDown aria-hidden="true" className={cn("ml-auto size-4 shrink-0 transition-transform duration-200", isExpanded && "rotate-180")} />
            </button>
            {isExpanded && (
              <>
                {menu.tiles.map((tile) => (
                  <TileLink key={tile.label} tile={tile} onNavigate={onNavigate} className={cn(mobileTile, "py-2.5")}>
                    <tile.icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={1.75} />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate-name font-medium">{tile.label}</span>
                      <span className="truncate-name text-[13px] leading-4 text-muted-foreground">{tile.description}</span>
                    </span>
                    <TileCount tile={tile} counts={counts} />
                  </TileLink>
                ))}
                <div className="flex flex-wrap gap-2">
                  {menu.compact.map((tile) => (
                    <TileLink key={tile.label} tile={tile} onNavigate={onNavigate} className="flex h-11 grow items-center justify-center rounded-tile bg-tile px-3 text-sm font-medium">
                      <span className="truncate-name">{tile.label}</span>
                    </TileLink>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Shared bits ---------------- */

function TileLink({
  tile,
  onNavigate,
  className,
  children,
}: {
  tile: NavTile;
  onNavigate: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const common = {
    role: "menuitem",
    "data-menuitem": true,
    title: tile.description ? `${tile.label} – ${tile.description}` : tile.label,
    onClick: onNavigate,
    className: cn(
      "min-w-0 text-foreground outline-offset-2 focus-visible:outline-2 focus-visible:outline-foreground/40",
      className
    ),
  } as const;

  if (tile.external) {
    return (
      <a href={tile.href} target="_blank" rel="noopener noreferrer" {...common}>
        {children}
      </a>
    );
  }
  return (
    <Link href={tile.href} {...common}>
      {children}
    </Link>
  );
}

/** Live count on a tile: Derinama / Laukia užrašų / Nepriskirti mokėjimai (waiting) is a small Sand pill, others a quiet number (DESIGN.md §1.3). */
function TileCount({ tile, counts }: { tile: NavTile; counts: NavCounts }) {
  const count = tile.countKey ? counts[tile.countKey] : undefined;
  if (count === undefined) return null;
  if ((tile.countKey === "nepriskirti" || tile.countKey === "skolos") && count === 0) return null; // only when something waits / someone owes
  if ((tile.countKey === "derinama" || tile.countKey === "uzrasai" || tile.countKey === "nepriskirti") && count > 0) {
    return (
      <span className="ml-auto inline-flex h-[22px] min-w-6 shrink-0 items-center justify-center rounded-pill bg-sand-tint px-2 text-[13px] font-medium text-sand-ink tabular-nums">
        {count}
      </span>
    );
  }
  return <span className="ml-auto shrink-0 text-[13px] font-medium text-muted-foreground tabular-nums">{count}</span>;
}
