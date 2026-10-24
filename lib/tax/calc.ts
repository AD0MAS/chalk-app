import type { TaxSettings } from "./constants.ts";

// IV tax estimate for one calendar year (docs/SPEC.md §1 Taxes). Pure: same input → same output, no I/O.
// Unit tests: lib/tax/calc.test.ts (npm test).
//
//   income       = money received in the year (cash accounting)
//   deduction    = 30 % of income, or "faktinės išlaidos" (a yearly amount, never more than income)
//   taxable      = income − deduction
//   GPM          = 20 % × taxable − credit, where the credit is 15 % × taxable up to 20 000 €, then shrinks linearly
//                  to 0 at 42 500 € (= taxable × (0.15 − 2/300 000 × (taxable − 20 000)) with 2026 values)
//   VSD / PSD    = 12.52 % / 6.98 % of 90 % of taxable; PSD at least the minimal monthly PSD × months if turned on
// Above 42 500 € taxable there is no credit and the general progressive rates apply – we only warn.

export type TaxEstimate = {
  income: number;
  deduction: number;
  taxable: number;
  credit: number;
  gpm: number;
  base: number; // VSD / PSD base
  vsd: number;
  psd: number;
  total: number;
  effectiveRate: number; // total / income (0 when no income)
  overCreditLimit: boolean; // taxable > credit_zero_at → general GPM rates, estimate is too low
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** `months` = how many months of the year the minimal PSD applies to (only used when min_psd is on). */
export function estimateTax(income: number, s: TaxSettings, months = 12): TaxEstimate {
  const gross = Math.max(0, income);
  const deduction = s.deduction === "actual" ? Math.min(gross, Math.max(0, s.actual_expenses)) : gross * s.norm_rate;
  const taxable = gross - deduction;

  let creditRate = s.credit_rate;
  if (taxable > s.credit_full_until) {
    const span = s.credit_zero_at - s.credit_full_until;
    creditRate = span > 0 ? Math.max(0, s.credit_rate * (1 - (taxable - s.credit_full_until) / span)) : 0;
  }
  const credit = taxable * creditRate;
  const gpm = Math.max(0, taxable * s.gpm_rate - credit);

  const base = taxable * s.base_share;
  const vsd = base * s.vsd_rate;
  const psd = s.min_psd ? Math.max(base * s.psd_rate, s.min_psd_monthly * months) : base * s.psd_rate;

  const total = round2(gpm) + round2(vsd) + round2(psd);
  return {
    income: round2(gross),
    deduction: round2(deduction),
    taxable: round2(taxable),
    credit: round2(credit),
    gpm: round2(gpm),
    base: round2(base),
    vsd: round2(vsd),
    psd: round2(psd),
    total: round2(total),
    effectiveRate: gross > 0 ? total / gross : 0,
    overCreditLimit: taxable > s.credit_zero_at,
  };
}
