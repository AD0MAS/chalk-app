// npm test – how often Chalk may ask the bank (lib/bank/budget.ts): ≤ 4 background requests per rolling 24 h
// per account, app-open sync at most every 2 h, nothing at all while rate-limited.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  APP_OPEN_SYNC_MS,
  budgetFor,
  budgetFreesAt,
  budgetLeft,
  decideSync,
  RATE_LIMIT_BACKOFF_MS,
  retryAfterFrom,
  spendCall,
  UNATTENDED_LIMIT,
  type BankCall,
} from "./budget.ts";

const NOW = Date.parse("2026-10-22T12:00:00Z");
const H = 60 * 60_000;
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const call = (msAgo: number, attended = false, account = "acc-1"): BankCall => ({ at: ago(msAgo), account, attended });
const base = { accounts: ["acc-1"], calls: [] as BankCall[], retryAfter: null, lastAttemptAt: null, now: NOW };

test("budget: 4 background calls per rolling 24 h, attended calls don't count", () => {
  assert.equal(UNATTENDED_LIMIT, 4);
  assert.equal(budgetFor([], "acc-1", NOW), 4);
  assert.equal(budgetFor([call(1 * H), call(2 * H), call(3 * H, true)], "acc-1", NOW), 2);
  assert.equal(budgetFor([call(1 * H), call(2 * H), call(3 * H), call(4 * H)], "acc-1", NOW), 0);
  // 24 h old → free again
  assert.equal(budgetFor([call(24 * H), call(25 * H), call(2 * H)], "acc-1", NOW), 3);
  // per account
  assert.equal(budgetFor([call(1 * H, false, "acc-2")], "acc-1", NOW), 4);
  assert.equal(budgetLeft([call(1 * H, false, "acc-2")], ["acc-1", "acc-2"], NOW), 3);
  assert.equal(budgetLeft(null, ["acc-1"], NOW), 4);
});

test("budget used up: the oldest call in the window says when one frees", () => {
  const calls = [call(23 * H), call(5 * H), call(2 * H), call(1 * H)];
  assert.equal(budgetFreesAt(calls, ["acc-1"], NOW), new Date(NOW + 1 * H).toISOString());
  assert.equal(budgetFreesAt(calls.slice(1), ["acc-1"], NOW), null); // 1 left → null
});

test("spendCall: background stops at the limit, attended always records", () => {
  let calls: BankCall[] = [];
  for (let i = 0; i < 4; i++) {
    const next = spendCall(calls, "acc-1", false, NOW + i);
    assert.ok(next, `call ${i + 1} allowed`);
    calls = next;
  }
  assert.equal(spendCall(calls, "acc-1", false, NOW + 5), null); // 5th background call refused
  const attended = spendCall(calls, "acc-1", true, NOW + 6);
  assert.ok(attended);
  assert.equal(attended.length, 5);
  // old calls are pruned when saving
  assert.equal(spendCall([call(30 * H)], "acc-1", false, NOW)?.length, 1);
});

test("cron: runs within the budget, never without it", () => {
  assert.deepEqual(decideSync({ ...base, mode: "cron", attended: false }), { run: true });
  const full = [call(1 * H), call(2 * H), call(3 * H), call(4 * H)];
  assert.deepEqual(decideSync({ ...base, mode: "cron", attended: false, calls: full }), { run: false, reason: "no-budget" });
  // the cron ignores the 2-hour app-open throttle
  assert.deepEqual(decideSync({ ...base, mode: "cron", attended: false, lastAttemptAt: ago(10 * 60_000) }), { run: true });
});

test("app open: attended only, at most every 2 h", () => {
  assert.equal(APP_OPEN_SYNC_MS, 2 * H);
  assert.deepEqual(decideSync({ ...base, mode: "app-open", attended: true }), { run: true });
  assert.deepEqual(decideSync({ ...base, mode: "app-open", attended: true, lastAttemptAt: ago(119 * 60_000) }), { run: false, reason: "throttled" });
  assert.deepEqual(decideSync({ ...base, mode: "app-open", attended: true, lastAttemptAt: ago(2 * H) }), { run: true });
  // no PSU headers (localhost) → never a background request from opening the app
  assert.deepEqual(decideSync({ ...base, mode: "app-open", attended: false }), { run: false, reason: "not-attended" });
  // attended doesn't need the background budget
  const full = [call(1 * H), call(2 * H), call(3 * H), call(4 * H)];
  assert.deepEqual(decideSync({ ...base, mode: "app-open", attended: true, calls: full }), { run: true });
});

test("manual button: attended runs any time; without PSU headers it uses the budget", () => {
  assert.deepEqual(decideSync({ ...base, mode: "manual", attended: true, lastAttemptAt: ago(60_000) }), { run: true });
  const full = [call(1 * H), call(2 * H), call(3 * H), call(4 * H)];
  assert.deepEqual(decideSync({ ...base, mode: "manual", attended: false, calls: full }), { run: false, reason: "no-budget" });
});

test("rate-limited: no mode calls the bank until retry_after", () => {
  const retryAfter = new Date(NOW + 30 * 60_000).toISOString();
  for (const mode of ["app-open", "manual", "cron"] as const) {
    for (const attended of [true, false]) {
      assert.deepEqual(decideSync({ ...base, mode, attended, retryAfter }), { run: false, reason: "rate-limited" });
    }
  }
  // past retry_after → allowed again
  assert.deepEqual(decideSync({ ...base, mode: "cron", attended: false, retryAfter: ago(1) }), { run: true });
});

test("retryAfterFrom: the bank's Retry-After, else 6 h, clamped to 1 min … 24 h", () => {
  assert.equal(RATE_LIMIT_BACKOFF_MS, 6 * H);
  assert.equal(retryAfterFrom(null, NOW), new Date(NOW + 6 * H).toISOString());
  assert.equal(retryAfterFrom("3600", NOW), new Date(NOW + 1 * H).toISOString());
  assert.equal(retryAfterFrom("5", NOW), new Date(NOW + 60_000).toISOString());
  assert.equal(retryAfterFrom("999999", NOW), new Date(NOW + 24 * H).toISOString());
  assert.equal(retryAfterFrom(new Date(NOW + 2 * H).toUTCString(), NOW), new Date(NOW + 2 * H).toISOString());
  assert.equal(retryAfterFrom("nonsense", NOW), new Date(NOW + 6 * H).toISOString());
});
