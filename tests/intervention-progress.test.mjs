import assert from "node:assert/strict";
import { test } from "node:test";
import { getInterventionProgress, interventionSteps } from "../src/lib/intervention-progress.ts";

const request = (status, extra = {}) => ({ status, booking: null, quotes: [], events: [], ...extra });
test("each actual request status maps to its persisted milestone", () => {
  ["SENT", "QUOTED", "PRICE_ACCEPTED", "BOOKED", "EN_ROUTE", "IN_PROGRESS", "COMPLETED"].forEach((status, index) => {
    const progress = getInterventionProgress(request(status));
    assert.equal(progress.index, index); assert.equal(progress.label, interventionSteps[index]); assert.equal(progress.stopped, null); assert.equal(progress.finished, status === "COMPLETED");
  });
});
test("a rescheduled active request never inherits an obsolete confirmed milestone", () => {
  assert.equal(getInterventionProgress(request("PRICE_ACCEPTED", { events: [{ status: "BOOKED" }], booking: { status: "CANCELLED" }, quotes: [{ status: "ACCEPTED" }] })).index, 2);
  assert.equal(getInterventionProgress(request("QUOTED", { events: [{ status: "EN_ROUTE" }], quotes: [{ status: "PENDING" }] })).index, 1);
});
test("cancelled and rejected requests freeze on the last real milestone", () => {
  const cancelled = getInterventionProgress(request("CANCELLED", { events: [{ status: "SENT" }, { status: "QUOTED" }, { status: "BOOKED" }, { status: "CANCELLED" }], booking: { status: "CANCELLED" }, quotes: [{ status: "ACCEPTED" }] }));
  assert.equal(cancelled.index, 3); assert.equal(cancelled.label, "Annulée"); assert.equal(cancelled.stopped, "cancelled"); assert.equal(cancelled.finished, false);
  const refused = getInterventionProgress(request("REJECTED", { events: [{ status: "SENT" }, { status: "REJECTED" }] }));
  assert.equal(refused.index, 0); assert.equal(refused.stopped, "rejected"); assert.equal(refused.finished, false);
});
test("legacy records use quote/booking evidence without inventing progress", () => {
  assert.equal(getInterventionProgress(request("LEGACY")).index, 0);
  assert.equal(getInterventionProgress(request("LEGACY", { quotes: [{ status: "PENDING" }] })).index, 1);
  assert.equal(getInterventionProgress(request("LEGACY", { quotes: [{ status: "ACCEPTED" }] })).index, 2);
  assert.equal(getInterventionProgress(request("LEGACY", { booking: { status: "CONFIRMED" } })).index, 3);
});
