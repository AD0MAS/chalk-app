// npm test – the IV tax estimate (lib/tax/calc.ts) with 2026 settings.
import assert from "node:assert/strict";
import { test } from "node:test";
import { estimateTax } from "./calc.ts";
import { TAX_DEFAULTS } from "./constants.ts";

/** Money is compared to the cent (floating point may land on either side of a half cent). */
function near(actual: number, expected: number, what: string) {
  assert.ok(Math.abs(actual - expected) <= 0.011, `${what}: ${actual} ≠ ${expected}`);
}

test("0 € – nothing to pay", () => {
  const t = estimateTax(0, TAX_DEFAULTS);
  assert.deepEqual([t.taxable, t.gpm, t.vsd, t.psd, t.total, t.effectiveRate], [0, 0, 0, 0, 0, 0]);
  assert.equal(t.overCreditLimit, false);
});

test("6 187,50 € (2026 m. iki rugsėjo) – GPM 5 %", () => {
  const t = estimateTax(6187.5, TAX_DEFAULTS);
  near(t.deduction, 1856.25, "atskaitymas");
  near(t.taxable, 4331.25, "apmokestinamos");
  near(t.gpm, 216.56, "GPM");
  near(t.vsd, 488.05, "VSD");
  near(t.psd, 272.09, "PSD");
  near(t.total, 976.7, "iš viso");
});

test("28 571 € – taxable ≈ 20 000 €, still the full 15 % credit", () => {
  const t = estimateTax(28571, TAX_DEFAULTS);
  near(t.taxable, 19999.7, "apmokestinamos");
  near(t.gpm, 999.99, "GPM");
  near(t.vsd, 2253.57, "VSD");
  near(t.psd, 1256.38, "PSD");
  near(t.total, 4509.94, "iš viso");
  // exactly 20 000 € taxable → GPM exactly 5 %
  near(estimateTax(20000 / 0.7, TAX_DEFAULTS).gpm, 1000, "GPM ties 20 000");
});

test("35 000 € – credit shrinks: 24 500 × (0,15 − 2/300 000 × 4 500)", () => {
  const t = estimateTax(35000, TAX_DEFAULTS);
  near(t.taxable, 24500, "apmokestinamos");
  near(t.credit, 2940, "kreditas");
  near(t.gpm, 1960, "GPM");
  near(t.vsd, 2760.66, "VSD");
  near(t.psd, 1539.09, "PSD");
  near(t.total, 6259.75, "iš viso");
  assert.equal(t.overCreditLimit, false);
});

test("60 000 € – taxable 42 000 €, almost no credit, no warning yet", () => {
  const t = estimateTax(60000, TAX_DEFAULTS);
  near(t.taxable, 42000, "apmokestinamos");
  near(t.credit, 140, "kreditas");
  near(t.gpm, 8260, "GPM");
  near(t.vsd, 4732.56, "VSD");
  near(t.psd, 2638.44, "PSD");
  assert.equal(t.overCreditLimit, false);
});

test("61 000 € – taxable 42 700 € > 42 500 €: no credit + warning", () => {
  const t = estimateTax(61000, TAX_DEFAULTS);
  near(t.taxable, 42700, "apmokestinamos");
  assert.equal(t.credit, 0);
  near(t.gpm, 8540, "GPM");
  assert.equal(t.overCreditLimit, true);
});

test("credit reaches 0 exactly at 42 500 € (no jump)", () => {
  near(estimateTax(42500 / 0.7, TAX_DEFAULTS).gpm, 8500, "GPM ties 42 500");
});

test("faktinės išlaidos instead of 30 %", () => {
  const t = estimateTax(10000, { ...TAX_DEFAULTS, deduction: "actual", actual_expenses: 2000 });
  near(t.taxable, 8000, "apmokestinamos");
  near(t.gpm, 400, "GPM");
  // expenses can never make taxable income negative
  assert.equal(estimateTax(1000, { ...TAX_DEFAULTS, deduction: "actual", actual_expenses: 5000 }).taxable, 0);
});

test("minimalus PSD – only when turned on", () => {
  near(estimateTax(1000, TAX_DEFAULTS).psd, 43.97, "PSD be minimumo");
  near(estimateTax(1000, { ...TAX_DEFAULTS, min_psd: true }).psd, 965.76, "PSD su minimumu (12 mėn.)");
  near(estimateTax(1000, { ...TAX_DEFAULTS, min_psd: true }, 10).psd, 804.8, "PSD su minimumu (10 mėn.)");
});
