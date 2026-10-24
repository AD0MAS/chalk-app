// npm test – the y axis of the Finansai month chart (lib/finance/axis.ts).
import assert from "node:assert/strict";
import { test } from "node:test";
import { axisScale, tickLabel } from "./axis.ts";

const labels = (max: number) => axisScale(max).ticks.map(tickLabel);

/** Every label is unique and the top tick covers the largest bar. */
function check(max: number) {
  const { top, ticks } = axisScale(max);
  const list = ticks.map(tickLabel);
  assert.equal(new Set(list).size, list.length, `${max}: labels repeat – ${list.join(", ")}`);
  assert.ok(top >= max, `${max}: top ${top} is below the largest value`);
  assert.ok(ticks.length <= 5, `${max}: too many gridlines`);
}

test("0 € – a calm 0–100 axis", () => {
  assert.deepEqual(labels(0), ["0", "25", "50", "75", "100"]);
});

test("180 €", () => {
  assert.deepEqual(labels(180), ["0", "50", "100", "150", "200"]);
});

test("1 320 € – 1 500 is 1,5k, not 2k", () => {
  assert.deepEqual(labels(1320), ["0", "500", "1k", "1,5k"]);
});

test("1 980 €", () => {
  assert.deepEqual(labels(1980), ["0", "500", "1k", "1,5k", "2k"]);
});

test("2 600 €", () => {
  assert.deepEqual(labels(2600), ["0", "1k", "2k", "3k"]);
});

test("7 187,50 €", () => {
  assert.deepEqual(labels(7187.5), ["0", "2k", "4k", "6k", "8k"]);
});

test("2,5 steps stay exact", () => {
  assert.deepEqual(labels(9000), ["0", "2,5k", "5k", "7,5k", "10k"]);
  assert.equal(tickLabel(1250), "1,25k");
});

test("labels are unique for any maximum", () => {
  for (let max = 1; max <= 100_000; max = Math.ceil(max * 1.07) + 3) check(max);
  [999, 1000, 1001, 4000, 4001, 25_000, 60_000, 123_456.78].forEach(check);
});
