import assert from "node:assert/strict";
import { test } from "node:test";
import { paymentPeriod } from "../src/lib/admin-payment-filters.ts";

test("payment period includes the entire selected Tunis calendar day", () => {
  const { createdAt } = paymentPeriod("2026-11-17", "2026-11-17");
  const includes = date => new Date(date) >= createdAt.gte && new Date(date) < createdAt.lt;
  assert.equal(includes("2026-11-16T22:59:59.999Z"), false);
  assert.equal(includes("2026-11-16T23:00:00.000Z"), true);
  assert.equal(includes("2026-11-17T22:59:59.999Z"), true);
  assert.equal(includes("2026-11-17T23:00:00.000Z"), false);
});

test("payment period ignores malformed and impossible dates", () => {
  for (const value of ["2026-02-30", "2026-13-01", "2026-11", "invalid", "2026-11-17T00:00:00Z"]) {
    assert.deepEqual(paymentPeriod(value, value), { from: "", to: "", createdAt: {} });
  }
});

test("payment period supports open bounds, reversed ranges and leap years", () => {
  assert.deepEqual(paymentPeriod(), { from: "", to: "", createdAt: {} });
  assert.equal(paymentPeriod("2028-02-29").from, "2028-02-29");
  assert.equal(paymentPeriod("2028-02-29").createdAt.lt, undefined);
  assert.equal(paymentPeriod("", "2028-02-29").createdAt.gte, undefined);
  const range = paymentPeriod("2026-11-30", "2026-11-01");
  assert.equal(range.from, "2026-11-01");
  assert.equal(range.to, "2026-11-30");
});
