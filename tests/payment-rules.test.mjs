import { test } from "node:test";
import assert from "node:assert/strict";
import { testCurrencyPlan, paymentMatches } from "../src/lib/payment-rules.ts";
test("test currency conversion preserves millimes, deducts deposits before conversion and rounds once", () => {
  assert.deepEqual(testCurrencyPlan(["eur"], 80501 - 20000), { currency: "eur", stripeAmount: 1815, exchangeRatePpm: 300000 });
  assert.equal(testCurrencyPlan(["eur"], 80167).stripeAmount, 2405);
  assert.equal(testCurrencyPlan(["usd"], 100000, { currency: "usd", rate: "0.33" }).stripeAmount, 3300);
  assert.deepEqual(testCurrencyPlan(["tnd", "eur"], 80501), { currency: "tnd", stripeAmount: 80501, exchangeRatePpm: 1000000 });
  assert.throws(() => testCurrencyPlan(["usd"], 80000), /acceptée/);
  assert.throws(() => testCurrencyPlan(["eur"], 1000), /minimum/);
  assert.throws(() => testCurrencyPlan(["eur"], 0), /solde/);
  assert.throws(() => testCurrencyPlan(["eur"], 80000, { rate: "-1" }), /taux/);
  assert.throws(() => testCurrencyPlan(["eur"], 80000, { rate: "1e3" }), /taux/);
});
test("settlement verifies the stored converted amount, currency and strict test mode", () => {
  const payment = { amountMillimes: 60501, stripeAmount: 1815, currency: "eur", livemode: false };
  const session = { amount_total: 1815, currency: "eur", livemode: false };
  assert.equal(paymentMatches(payment, session), true);
  assert.equal(paymentMatches(payment, { ...session, amount_total: 60501 }), false);
  assert.equal(paymentMatches(payment, { ...session, currency: "usd" }), false);
  assert.equal(paymentMatches(payment, { ...session, livemode: true }), false);
  assert.equal(paymentMatches({ ...payment, livemode: true }, { ...session, livemode: true }), false);
});
