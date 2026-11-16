import assert from "node:assert/strict";
import { test } from "node:test";
import { validateSupportComplaint } from "../src/lib/support-complaints.ts";
const input = { type: "complaint", category: "intervention", requestId: "52", subject: "  Problème après intervention  ", message: "L’intervention réalisée ne correspond pas au devis accepté." };
test("support inputs preserve content and include the selected topic without trusting ownership or status", () => {
  const parsed = validateSupportComplaint(input);
  assert.equal(parsed.requestId, 52); assert.equal(parsed.subject, "Problème après intervention");
  assert.ok(parsed.message.startsWith("Réclamation · Intervention ou réservation\n\n"));
  assert.ok(parsed.message.endsWith(input.message));
  for (const value of [null, {}, { ...input, clientId: 5 }, { ...input, status: "RESOLVED" }, { ...input, priority: "URGENT" }, { ...input, type: "unknown" }, { ...input, category: "unknown" }, { ...input, requestId: "1e3" }, { ...input, requestId: 0 }, { ...input, requestId: 2147483648 }, { ...input, requestId: "" }, { ...input, subject: "ab" }, { ...input, subject: "a".repeat(151) }, { ...input, message: "too short" }, { ...input, message: "a".repeat(3001) }]) assert.throws(() => validateSupportComplaint(value));
});
test("general help is optional to an intervention and legacy workspace submissions remain compatible", () => {
  assert.equal(validateSupportComplaint({ ...input, type: "help", category: "technical", requestId: "" }).requestId, null);
  const legacy = { subject: input.subject, message: input.message, requestId: 52 };
  assert.equal(validateSupportComplaint(legacy).message, input.message);
});
