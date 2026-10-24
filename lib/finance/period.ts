import { addDays, formatWeekRange, isDate, mondayOf } from "@/lib/lessons/time";

// Finansai period switch: Savaitė / Mėnuo / Metai with prev / next (?laikotarpis=…&nuo=YYYY-MM-DD).
// Shared by server and client code. Ranges are Vilnius dates: `from` inclusive, `to` exclusive.

export type PeriodKind = "savaite" | "menuo" | "metai";

export const PERIOD_KINDS: { value: PeriodKind; label: string }[] = [
  { value: "savaite", label: "Savaitė" },
  { value: "menuo", label: "Mėnuo" },
  { value: "metai", label: "Metai" },
];

/** Nothing before this – the oldest data is the historical income of 2025. */
export const FINANCE_START = "2025-01-01";

export const MONTHS_NOMINATIVE = ["Sausis", "Vasaris", "Kovas", "Balandis", "Gegužė", "Birželis", "Liepa", "Rugpjūtis", "Rugsėjis", "Spalis", "Lapkritis", "Gruodis"];
export const MONTHS_SHORT = ["Sau", "Vas", "Kov", "Bal", "Geg", "Bir", "Lie", "Rgp", "Rgs", "Spa", "Lap", "Grd"];

export type Period = { kind: PeriodKind; from: string; to: string; label: string; prev: string | null; next: string | null };

const firstOfNextMonth = (date: string) => `${addDays(`${date.slice(0, 7)}-28`, 4).slice(0, 7)}-01`;

/** The period of `kind` that contains `date`. */
function bounds(kind: PeriodKind, date: string) {
  if (kind === "savaite") {
    const from = mondayOf(date);
    return { from, to: addDays(from, 7) };
  }
  if (kind === "menuo") {
    const from = `${date.slice(0, 7)}-01`;
    return { from, to: firstOfNextMonth(from) };
  }
  const year = Number(date.slice(0, 4));
  return { from: `${year}-01-01`, to: `${year + 1}-01-01` };
}

export function periodLabel(kind: PeriodKind, from: string) {
  if (kind === "savaite") return formatWeekRange(from);
  if (kind === "menuo") return `${MONTHS_NOMINATIVE[Number(from.slice(5, 7)) - 1]} ${from.slice(0, 4)}`;
  return `${from.slice(0, 4)} m.`;
}

/** URL params → a period. Unknown values fall back to this month; nothing in the future, nothing before 2025. */
export function readPeriod(params: { laikotarpis?: unknown; nuo?: unknown }, today: string): Period {
  const kind = PERIOD_KINDS.some((p) => p.value === params.laikotarpis) ? (params.laikotarpis as PeriodKind) : "menuo";
  let anchor = isDate(params.nuo) ? params.nuo : today;
  if (anchor > today) anchor = today;
  if (anchor < FINANCE_START) anchor = FINANCE_START;
  const { from, to } = bounds(kind, anchor);
  const prevFrom = bounds(kind, addDays(from, -1)).from;
  return {
    kind,
    from,
    to,
    label: periodLabel(kind, from),
    prev: addDays(from, -1) >= FINANCE_START ? prevFrom : null,
    next: to <= today ? to : null,
  };
}

export function periodHref(kind: PeriodKind, from?: string, today?: string) {
  const params = new URLSearchParams();
  if (kind !== "menuo") params.set("laikotarpis", kind);
  // The current period needs no date – the link stays valid tomorrow.
  if (from && !(today && bounds(kind, today).from === from)) params.set("nuo", from);
  const q = params.toString();
  return q ? `/finansai?${q}` : "/finansai";
}
