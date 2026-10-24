// Europe/Vilnius date & time helpers, shared by server and client code.
// Dates are "YYYY-MM-DD" strings, times "HH:MM" (local Vilnius wall clock), instants ISO strings.
// The browser's own time zone never matters: everything goes through Intl with an explicit zone.

const TZ = "Europe/Vilnius";

const partsFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** An instant → its Vilnius date, time, ISO weekday (1 = Monday) and minutes since midnight. */
export function vilniusParts(instant: string | Date) {
  const parts = Object.fromEntries(partsFormat.formatToParts(new Date(instant)).map((p) => [p.type, p.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const time = `${parts.hour}:${parts.minute}`;
  return { date, time, weekday: weekdayOf(date), minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

/** Vilnius UTC offset in minutes at an instant: +180 in summer, +120 in winter. */
export function offsetMinutes(instant: Date) {
  const { date, minutes } = vilniusParts(instant);
  const asUtc = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) + minutes * 60_000;
  return Math.round((asUtc - Math.floor(instant.getTime() / 60_000) * 60_000) / 60_000);
}

/** Vilnius wall-clock date + time → ISO instant (correct on both sides of a DST change). */
export function vilniusToIso(date: string, time: string) {
  const naive = Date.parse(`${date}T${time}:00Z`);
  // Guess with the offset at that moment, then correct once with the offset at the result.
  let instant = naive - offsetMinutes(new Date(naive)) * 60_000;
  instant = naive - offsetMinutes(new Date(instant)) * 60_000;
  return new Date(instant).toISOString();
}

/** Today in Vilnius. Call only at request time (server) or after mount (client). */
export const todayVilnius = (now = new Date()) => vilniusParts(now).date;

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** ISO weekday of a date: 1 = Monday … 7 = Sunday. */
export function weekdayOf(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

export const mondayOf = (date: string) => addDays(date, 1 - weekdayOf(date));

export const isDate = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
export const isTime = (v: unknown): v is string => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

/** "HH:MM" → minutes since midnight, and back. */
export const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const fromMinutes = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/**
 * If the clocks change on this date, how: { from: "04:00", to: "03:00" } in autumn,
 * { from: "03:00", to: "04:00" } in spring. Otherwise null.
 */
export function clockChange(date: string): { from: string; to: string } | null {
  const before = offsetMinutes(new Date(`${date}T00:00:00Z`));
  const after = offsetMinutes(new Date(`${addDays(date, 1)}T00:00:00Z`));
  if (before === after) return null;
  // EU rule: the change happens at 01:00 UTC.
  const from = fromMinutes(60 + before);
  const to = fromMinutes(60 + after);
  return { from, to };
}

/* ---------------- Lithuanian formatting ---------------- */

const MONTHS_GENITIVE = [
  "sausio",
  "vasario",
  "kovo",
  "balandžio",
  "gegužės",
  "birželio",
  "liepos",
  "rugpjūčio",
  "rugsėjo",
  "spalio",
  "lapkričio",
  "gruodžio",
];

const MONTHS_ACCUSATIVE = ["sausį", "vasarį", "kovą", "balandį", "gegužę", "birželį", "liepą", "rugpjūtį", "rugsėjį", "spalį", "lapkritį", "gruodį"];

/** "spalį" (Spalį įvyko …) */
export const monthAccusative = (date: string) => MONTHS_ACCUSATIVE[Number(date.slice(5, 7)) - 1];

const month = (date: string) => MONTHS_GENITIVE[Number(date.slice(5, 7)) - 1];
const day = (date: string) => Number(date.slice(8, 10));

/** "spalio 22 d." */
export const formatDayMonth = (date: string) => `${month(date)} ${day(date)} d.`;

/** "Spalio 19–25 d." or "Spalio 26 – lapkričio 1 d." */
export function formatWeekRange(monday: string) {
  const sunday = addDays(monday, 6);
  const text =
    month(monday) === month(sunday)
      ? `${month(monday)} ${day(monday)}–${day(sunday)} d.`
      : `${month(monday)} ${day(monday)} – ${month(sunday)} ${day(sunday)} d.`;
  return text[0].toLocaleUpperCase("lt") + text.slice(1);
}

const WEEKDAY_ABBR = ["pirm.", "antr.", "treč.", "ketv.", "penkt.", "šešt.", "sekm."];

/** "ketv., spalio 22 d." */
export const formatDateLong = (date: string) => `${WEEKDAY_ABBR[weekdayOf(date) - 1]}, ${formatDayMonth(date)}`;

/** "šešt." */
export const weekdayAbbr = (date: string) => WEEKDAY_ABBR[weekdayOf(date) - 1];

const WEEKDAY_GENITIVE = ["pirmadienio", "antradienio", "trečiadienio", "ketvirtadienio", "penktadienio", "šeštadienio", "sekmadienio"];

/** "ketvirtadienio" (Kitos ketvirtadienio pamokos …) */
export const weekdayGenitive = (date: string) => WEEKDAY_GENITIVE[weekdayOf(date) - 1];

export const capitalize = (text: string) => text[0].toLocaleUpperCase("lt") + text.slice(1);
