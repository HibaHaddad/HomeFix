import assert from "node:assert/strict";
import { test } from "node:test";
import { paymentSplit, refundSplit, validateCommissionBps } from "../src/lib/payment-allocation.ts";

test("TND splits conserve every millime, including rounding and boundary percentages", () => {
  assert.deepEqual(paymentSplit(100000, 1000), { grossMillimes: 100000, commissionMillimes: 10000, professionalMillimes: 90000 });
  for (const gross of [1, 2, 5, 101, 80501, 999999999]) for (const rate of [0, 1, 1000, 1250, 9999, 10000]) {
    const split = paymentSplit(gross, rate);
    assert.equal(split.commissionMillimes + split.professionalMillimes, gross);
    const partial = refundSplit(split, 1, 3), full = refundSplit(split, 3, 3);
    assert.equal(partial.refundedCommissionMillimes + partial.refundedProfessionalMillimes, partial.refundedMillimes);
    assert.equal(full.refundedMillimes, gross);
    assert.equal(full.refundedCommissionMillimes, split.commissionMillimes);
    assert.equal(full.refundedProfessionalMillimes, split.professionalMillimes);
  }
  for (const invalid of [-1, 10001, 1000.5, NaN, "1000", null]) assert.throws(() => validateCommissionBps(invalid));
  assert.throws(() => refundSplit(paymentSplit(1000, 1000), 301, 300));
});
