import assert from "node:assert/strict";
import { test } from "node:test";
import { buildProfessionalFinance, financePeriod, financeMoney } from "../src/lib/professional-finance.ts";

const date = new Date("2026-11-06T10:00:00Z");
function invoice(overrides = {}) {
  return {
    id: 1, totalMillimes: 80501, paidMillimes: 0, status: "UNPAID", createdAt: date,
    receiptUrl: null, paymentReference: null,
    quote: { status: "ACCEPTED", request: { id: 11, title: "Réparation", status: "COMPLETED", client: { name: "Client" } } },
    payments: [], ...overrides,
  };
}
function payment(id, amountMillimes, updatedAt = date) {
  return { id, amountMillimes, updatedAt, paymentIntentId: `pi_${id}` };
}

test("confirmed installments count once in millimes, without adding the cumulative invoice balance", () => {
  const result = buildProfessionalFinance([invoice({ status: "PAID", paidMillimes: 80501, payments: [payment("deposit", 20000), payment("balance", 60501), payment("balance", 60501)] })], null);
  assert.equal(result.earnedMillimes, 80501);
  assert.equal(result.netMillimes, 80501);
  assert.equal(result.sanctionsMillimes, 0);
  assert.equal(result.pendingMillimes, 0);
  assert.equal(result.transactions.length, 2);
  assert.ok(result.transactions.every((row) => row.kind === "gain"));
});

test("partial invoices show the outstanding balance once; a PAID flag alone never creates a gain", () => {
  const partial = invoice({ paidMillimes: 20000, payments: [payment("deposit", 20000)] });
  const legacy = invoice({ id: 2, status: "PAID", paidMillimes: 80501 });
  const result = buildProfessionalFinance([partial, legacy], null);
  assert.equal(result.earnedMillimes, 20000);
  assert.equal(result.pendingMillimes, 60501);
  assert.equal(result.transactions.length, 2);
});

test("cancelled, rejected and superseded quotes do not create pending revenue", () => {
  const base = invoice();
  const cancelled = invoice({ quote: { ...base.quote, request: { ...base.quote.request, status: "CANCELLED" } } });
  const rejected = invoice({ quote: { ...base.quote, request: { ...base.quote.request, status: "REJECTED" } } });
  const superseded = invoice({ quote: { ...base.quote, status: "SUPERSEDED" } });
  const overpaid = invoice({ paidMillimes: 100000 });
  const result = buildProfessionalFinance([cancelled, rejected, superseded, overpaid], null);
  assert.deepEqual(result.transactions, []);
  assert.equal(result.pendingMillimes, 0);
});

test("period totals use confirmation date for gains and invoice creation for pending amounts", () => {
  const old = new Date("2026-10-01T10:00:00Z");
  const start = new Date("2026-10-31T23:00:00Z");
  const result = buildProfessionalFinance([
    invoice({ createdAt: old, paidMillimes: 30000, payments: [payment("old", 10000, old), payment("new", 20000)] }),
    invoice({ id: 2, totalMillimes: 10001 }),
  ], start);
  assert.equal(result.earnedMillimes, 20000);
  assert.equal(result.pendingMillimes, 10001);
  assert.equal(result.transactions.length, 2);
});

test("receipts belong only to the matching confirmed payment and require HTTPS", () => {
  const payments = [payment("deposit", 20000), payment("balance", 60501)];
  const result = buildProfessionalFinance([invoice({ status: "PAID", payments, paymentReference: "pi_balance", receiptUrl: "https://pay.stripe.com/receipts/example" })], null);
  assert.equal(result.transactions.find((row) => row.reference === "pi_deposit").receiptUrl, null);
  assert.equal(result.transactions.find((row) => row.reference === "pi_balance").receiptUrl, "https://pay.stripe.com/receipts/example");
  const unsafe = buildProfessionalFinance([invoice({ status: "PAID", payments, paymentReference: "pi_balance", receiptUrl: "javascript:alert(1)" })], null);
  assert.ok(unsafe.transactions.every((row) => row.receiptUrl === null));
});

test("calendar periods follow Tunis midnight, including the month and year boundaries", () => {
  const now = new Date("2026-12-31T23:30:00Z");
  assert.equal(financePeriod("month", now).start.toISOString(), "2026-12-31T23:00:00.000Z");
  assert.equal(financePeriod("year", now).start.toISOString(), "2026-12-31T23:00:00.000Z");
  assert.equal(+now - +financePeriod("30days", now).start, 30 * 86400000);
  assert.equal(+now - +financePeriod("90days", now).start, 90 * 86400000);
  assert.deepEqual(financePeriod("invalid", now), { key: "all", start: null });
  assert.equal(financeMoney(0), "0,000 DT");
  assert.match(financeMoney(80501), /80,501 DT/);
});

test("all invoices contribute to totals even beyond the former 100-row limit", () => {
  const invoices = Array.from({ length: 125 }, (_, index) => invoice({ id: index, status: "PAID", payments: [payment(String(index), 1001)] }));
  const result = buildProfessionalFinance(invoices, null);
  assert.equal(result.transactions.length, 125);
  assert.equal(result.earnedMillimes, 125125);
  assert.equal(result.netMillimes, result.earnedMillimes);
  assert.equal(result.sanctionsMillimes, 0);
});
