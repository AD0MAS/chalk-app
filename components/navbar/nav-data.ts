import {
  Archive,
  Banknote,
  BookOpen,
  Calendar,
  CalendarCheck,
  CalendarPlus,
  CalendarRange,
  ChartLine,
  CircleAlert,
  CirclePause,
  Download,
  Landmark,
  NotebookPen,
  MessageCircleMore,
  MessageSquare,
  Pencil,
  Percent,
  Repeat,
  SlidersHorizontal,
  Sparkles,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

// Menu content from docs/DESIGN.md §1.3.

export type MenuKey = "mokiniai" | "finansai" | "irankiai";

export type CountKey = "visi" | "derinama" | "pastovus" | "nepastovus" | "pauze" | "archyvuotas" | "uzrasai" | "nepriskirti" | "skolos";
export type NavCounts = Partial<Record<CountKey, number>>;

export type NavTile = {
  label: string;
  description?: string;
  href: string;
  icon: LucideIcon;
  external?: boolean;
  countKey?: CountKey; // shows a live count (e.g. "Derinama 3")
};

export type NavMenu = {
  key: MenuKey;
  label: string;
  tiles: NavTile[]; // 2×2 large tiles
  compact: NavTile[]; // right column
};

export type NavLink = { label: string; href: string };

// External tools – one source of truth for the Įrankiai menu and Nustatymai → Greitosios nuorodos.
const tools = {
  eduka: { label: "Eduka", description: "Vadovėliai ir medžiaga", href: "https://eduka.lt/", icon: BookOpen, external: true },
  tldraw: { label: "tldraw", description: "Nauja lenta", href: "https://www.tldraw.com/", icon: Pencil, external: true },
  chatgpt: { label: "ChatGPT", description: "Uždavinių sprendimas", href: "https://chatgpt.com/", icon: MessageSquare, external: true },
  claude: { label: "Claude", description: "Uždavinių kūrimas", href: "https://claude.ai/new", icon: Sparkles, external: true },
  googleCalendar: { label: "Google Calendar", description: "Kalendorius", href: "https://calendar.google.com/", icon: CalendarCheck, external: true },
} satisfies Record<string, NavTile>;

export const quickLinks: NavTile[] = [tools.eduka, tools.tldraw, tools.chatgpt, tools.claude, tools.googleCalendar];

export const menus: Record<MenuKey, NavMenu> = {
  mokiniai: {
    key: "mokiniai",
    label: "Mokiniai",
    tiles: [
      { label: "Visi mokiniai", description: "Visas sąrašas ir balansai", href: "/mokiniai", icon: Users, countKey: "visi" },
      { label: "Pastovūs", description: "Savaitinės pamokos", href: "/mokiniai?statusas=pastovus", icon: Repeat, countKey: "pastovus" },
      { label: "Nepastovūs", description: "Pamokos pagal poreikį", href: "/mokiniai?statusas=nepastovus", icon: CalendarPlus, countKey: "nepastovus" },
      { label: "Derinama", description: "Laukia sutarimo", href: "/mokiniai?statusas=derinama", icon: MessageCircleMore, countKey: "derinama" },
    ],
    compact: [
      { label: "Naujas mokinys", href: "/mokiniai/naujas", icon: UserPlus },
      { label: "Laukia užrašų", href: "/laukia-uzrasu", icon: NotebookPen, countKey: "uzrasai" },
      { label: "Pauzė", href: "/mokiniai?statusas=pauze", icon: CirclePause, countKey: "pauze" },
      { label: "Archyvas", href: "/mokiniai?statusas=archyvuotas", icon: Archive, countKey: "archyvuotas" },
    ],
  },
  finansai: {
    key: "finansai",
    label: "Finansai",
    tiles: [
      { label: "Apžvalga", description: "Uždirbta, gauta, skolos", href: "/finansai", icon: ChartLine },
      { label: "Mokėjimai", description: "Banko įplaukos ir priskyrimas", href: "/mokejimai", icon: Banknote, countKey: "nepriskirti" },
      { label: "Skolos", description: "Kas ir kiek skolingas", href: "/finansai?rikiuoti=skolos#mokiniai", icon: CircleAlert, countKey: "skolos" },
      { label: "Mokesčiai", description: "IV: GPM, VSD, PSD, žurnalas", href: "/finansai/mokesciai", icon: Percent },
    ],
    compact: [
      { label: "Šis mėnuo", href: "/finansai", icon: Calendar },
      { label: "Ši savaitė", href: "/finansai?laikotarpis=savaite", icon: CalendarRange },
      { label: "Eksportas", href: "/nustatymai#eksportas", icon: Download },
    ],
  },
  irankiai: {
    key: "irankiai",
    label: "Įrankiai",
    tiles: [tools.eduka, tools.tldraw, tools.chatgpt, tools.claude],
    compact: [
      { label: "Google Calendar", href: "/nustatymai#google", icon: CalendarCheck },
      { label: "Bankas", href: "/nustatymai#bankas", icon: Landmark },
      { label: "Nustatymai", href: "/nustatymai", icon: SlidersHorizontal },
    ],
  },
};

// Top-level order in the bar: Šiandien · Mokiniai ▾ · Tvarkaraštis · Finansai ▾ · Įrankiai ▾
export const topItems: ({ type: "link"; key: string } & NavLink | { type: "menu"; key: MenuKey; label: string })[] = [
  { type: "link", key: "siandien", label: "Šiandien", href: "/" },
  { type: "menu", key: "mokiniai", label: "Mokiniai" },
  { type: "link", key: "tvarkarastis", label: "Tvarkaraštis", href: "/tvarkarastis" },
  { type: "menu", key: "finansai", label: "Finansai" },
  { type: "menu", key: "irankiai", label: "Įrankiai" },
];

/** Which top item is the current page (for the small active dot). */
export function activeKey(pathname: string | null): string | null {
  if (!pathname) return null;
  if (pathname === "/") return "siandien";
  if (pathname.startsWith("/mokiniai") || pathname.startsWith("/laukia-uzrasu")) return "mokiniai";
  if (pathname.startsWith("/tvarkarastis")) return "tvarkarastis";
  if (pathname.startsWith("/finansai") || pathname.startsWith("/mokejimai")) return "finansai";
  if (pathname.startsWith("/nustatymai")) return "nustatymai";
  return null;
}
