import type { Database } from "@/lib/supabase/database.types";
import { formatEur } from "@/lib/students/constants";
import { plural } from "@/lib/plural";

// Shared by server and client code: how money is shown (SPEC §1 Money, DESIGN.md §5).

export type PaymentSource = Database["public"]["Enums"]["payment_source"];

/** "Pradinis likutis" is the balance on this day – the day Chalk starts counting lessons. */
export const OPENING_BALANCE_DATE = "2026-10-21";

export const SOURCE_LABEL: Record<PaymentSource, string> = {
  manual: "Rankinis",
  bank: "Bankas",
  csv: "Išrašas",
};

/** Mokėjimai screen period filter (?laikotarpis=). */
export const PERIODS = [
  { value: "visi", label: "Visi" },
  { value: "savaite", label: "Ši savaitė" },
  { value: "menuo", label: "Šis mėnuo" },
  { value: "praeitas", label: "Praėjęs mėnuo" },
  { value: "metai", label: "Šie metai" },
] as const;

export type Period = (typeof PERIODS)[number]["value"];

/** 50 → "+50 €", −50 → "−50 €" (a real minus sign), 0 → "0 €". */
export function formatSignedEur(amount: number) {
  if (amount === 0) return "0 €";
  return `${amount > 0 ? "+" : "−"}${formatEur(Math.abs(amount))}`;
}

/** Debt = Coral ink, prepaid = Sage ink, settled = muted. */
export function balanceColor(balance: number) {
  if (balance < 0) return "text-coral-ink";
  if (balance > 0) return "text-sage-ink";
  return "text-muted-foreground";
}

/** The small line under a balance: "skola · ≈ 2 pamokos", "≈ 3 pamokos į priekį", "atsiskaityta". */
export function balanceMeta(balance: number, price: number) {
  if (balance === 0) return "atsiskaityta";
  const lessons = price > 0 ? Math.abs(balance) / price : 0;
  if (balance < 0) {
    const n = Math.round(lessons);
    return n >= 1 ? `skola · ≈ ${plural(n, ["pamoka", "pamokos", "pamokų"])}` : "skola";
  }
  const n = Math.floor(lessons);
  return n >= 1 ? `≈ ${plural(n, ["pamoka", "pamokos", "pamokų"])} į priekį` : "avansas";
}

/** "22,50" or "22.5" → 22.5; anything else → NaN. At most 2 decimals. */
export function parseAmount(text: string) {
  const clean = text.replace(/\s/g, "").replace("−", "-").replace(",", ".").replace(/€$/, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(clean)) return NaN;
  return Number(clean);
}

/** 22.5 → "22,50", 25 → "25" – for amount inputs. */
export const amountInput = (amount: number) =>
  Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace(".", ",");
