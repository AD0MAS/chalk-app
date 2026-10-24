"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TAX_DEFAULTS, type TaxSettings } from "./constants";

// Nustatymai → Mokesčiai: saves the tax rates (settings table, key "tax", owner only via RLS).

export type ActionResult = { ok: true } | { ok: false; message: string };

/** Limits that catch typos (e.g. 1252 instead of 12,52) – not tax rules. */
const RANGES: Partial<Record<keyof TaxSettings, [number, number]>> = {
  rates_year: [2025, 2100],
  norm_rate: [0, 1],
  actual_expenses: [0, 1_000_000],
  gpm_rate: [0, 1],
  credit_rate: [0, 1],
  credit_full_until: [0, 1_000_000],
  credit_zero_at: [0, 1_000_000],
  vsd_rate: [0, 1],
  psd_rate: [0, 1],
  base_share: [0, 1],
  min_psd_monthly: [0, 10_000],
};

export async function saveTaxSettings(input: TaxSettings | "defaults"): Promise<ActionResult> {
  const value: TaxSettings = input === "defaults" ? TAX_DEFAULTS : input;
  if (value.deduction !== "norm" && value.deduction !== "actual") return { ok: false, message: "Pasirink išlaidų būdą." };
  if (typeof value.min_psd !== "boolean") return { ok: false, message: "Neteisingas minimalaus PSD nustatymas." };
  for (const [key, [min, max]] of Object.entries(RANGES) as [keyof TaxSettings, [number, number]][]) {
    const n = value[key];
    if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max) return { ok: false, message: "Patikrink skaičius – kažkuris per didelis arba neteisingas." };
  }
  if (value.credit_zero_at <= value.credit_full_until) return { ok: false, message: "„Kreditas baigiasi ties“ turi būti daugiau nei „Pilnas kreditas iki“." };

  // Only known keys are stored.
  const clean = Object.fromEntries(Object.keys(TAX_DEFAULTS).map((k) => [k, value[k as keyof TaxSettings]]));
  const supabase = await createClient();
  const { error } = await supabase.from("settings").upsert({ key: "tax", value: clean }, { onConflict: "owner_id,key" });
  if (error) {
    console.error("saveTaxSettings:", error.message);
    return { ok: false, message: "Nepavyko išsaugoti. Pabandyk dar kartą." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
