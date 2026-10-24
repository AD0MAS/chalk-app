// Y axis of the Finansai month chart. Pure, shared by the chart and its unit test (lib/finance/axis.test.ts).
// Steps are 1 / 2 / 2.5 / 5 × a power of ten, at most 4 gridlines above zero, so every tick is a round number.

const MAX_LINES = 4;

/** Axis maximum, step and ticks (0 … top) for the largest value on the chart. */
export function axisScale(max: number) {
  const value = max > 0 ? max : 100; // an empty year still gets a calm 0–100 axis
  const magnitude = Math.max(1, 10 ** Math.floor(Math.log10(value / MAX_LINES)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => value / s <= MAX_LINES)!;
  const top = Math.max(step, Math.ceil(value / step) * step);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  return { step, top, ticks };
}

/** Exact tick label: 500 → "500", 1 500 → "1,5k", 2 000 → "2k" (Lithuanian decimal comma, never rounded). */
export function tickLabel(value: number) {
  const exact = (n: number) => n.toLocaleString("lt-LT", { maximumFractionDigits: 3 });
  return value >= 1000 ? `${exact(value / 1000)}k` : exact(value);
}
