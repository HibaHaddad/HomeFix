import assert from "node:assert/strict";
import { test } from "node:test";
import { adminId, adminPage, adminObject, adminText, validateSanctions, sanctionDefaults } from "../src/lib/admin-validation.ts";
test("admin inputs reject malformed identifiers, unexpected fields and invalid pagination", () => {
  for (const value of ["0", "-1", "1e2", "1.5", "2147483648", "abc"]) assert.throws(() => adminId(value));
  assert.equal(adminId("2147483647"), 2147483647);
  assert.equal(adminPage("9999999999"), 1);
  assert.equal(adminPage(["2", "3"]), 2);
  assert.throws(() => adminObject({ role: "ADMIN" }, ["name"]));
  assert.throws(() => adminText("  ", "Motif"));
  assert.equal(adminText("  Valid reason  ", "Motif"), "Valid reason");
});
test("sanction rules remain bounded and reject any automatic-enforcement option", () => {
  assert.deepEqual(validateSanctions(sanctionDefaults), sanctionDefaults);
  assert.throws(() => validateSanctions({ ...sanctionDefaults, automaticEnforcement: true }));
  assert.throws(() => validateSanctions({ ...sanctionDefaults, reviewThreshold: 6 }));
  assert.throws(() => validateSanctions({ ...sanctionDefaults, paymentDelayDays: 0 }));
  assert.throws(() => validateSanctions({ ...sanctionDefaults, suspensionPoints: 1 }));
  assert.throws(() => validateSanctions({ ...sanctionDefaults, absenceThreshold: 1.5 }));
});
