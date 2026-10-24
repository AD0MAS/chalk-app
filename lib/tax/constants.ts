// IV tax settings (docs/SPEC.md §1 Taxes). Stored in the settings table under key "tax" (prefilled by the
// 20261022120000 migration, editable in Nustatymai); these defaults are only the fallback when the row is missing.
// Shared by server, client and tests – relative imports only.

export type TaxSettings = {
  rates_year: number; // the year these rates are for (shown as "2026 m. tarifai")
  deduction: "norm" | "actual"; // 30 % norm or "faktinės išlaidos"
  norm_rate: number; // 0.30
  actual_expenses: number; // € per year, used when deduction = "actual"
  gpm_rate: number; // 0.20
  credit_rate: number; // 0.15 – full credit up to credit_full_until
  credit_full_until: number; // 20 000 €
  credit_zero_at: number; // 42 500 € – no credit above (general progressive rates)
  vsd_rate: number; // 0.1252
  psd_rate: number; // 0.0698
  base_share: number; // 0.90 – VSD/PSD are paid on 90 % of taxable income
  min_psd: boolean; // minimal monthly PSD (off while a full-time student)
  min_psd_monthly: number; // € per month when min_psd is on
};

export const TAX_DEFAULTS: TaxSettings = {
  rates_year: 2026,
  deduction: "norm",
  norm_rate: 0.3,
  actual_expenses: 0,
  gpm_rate: 0.2,
  credit_rate: 0.15,
  credit_full_until: 20_000,
  credit_zero_at: 42_500,
  vsd_rate: 0.1252,
  psd_rate: 0.0698,
  base_share: 0.9,
  min_psd: false,
  min_psd_monthly: 80.48,
};

const NUMBER_KEYS = [
  "rates_year",
  "norm_rate",
  "actual_expenses",
  "gpm_rate",
  "credit_rate",
  "credit_full_until",
  "credit_zero_at",
  "vsd_rate",
  "psd_rate",
  "base_share",
  "min_psd_monthly",
] as const;

/** Whatever is stored (possibly old or partial JSON) → complete settings; unknown or broken values fall back to defaults. */
export function readTaxSettings(value: unknown): TaxSettings {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const out: TaxSettings = { ...TAX_DEFAULTS };
  for (const key of NUMBER_KEYS) {
    const n = Number(v[key]);
    if (v[key] !== undefined && v[key] !== null && Number.isFinite(n) && n >= 0) out[key] = n;
  }
  if (v.deduction === "norm" || v.deduction === "actual") out.deduction = v.deduction;
  if (typeof v.min_psd === "boolean") out.min_psd = v.min_psd;
  return out;
}

/** GPM311 (yearly IV income declaration) is due by May 1 of the next year. */
export const gpmDeadline = (year: number) => `${year + 1}-05-01`;

/** 0.1252 → "12,52 %" */
export const formatPercent = (rate: number) =>
  `${(Math.round(rate * 10_000) / 100).toLocaleString("lt-LT", { maximumFractionDigits: 2 })} %`;

/** Activity line in the apskaitos žurnalas header. */
export const ACTIVITY = "Kitas, niekur nepriskirtas, švietimas";
