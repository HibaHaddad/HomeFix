import assert from "node:assert/strict";
import { test } from "node:test";
import { reservationStatus } from "./reservation-status";

const startsAt = "2026-11-01T14:00:00+01:00";
const after = +new Date("2026-11-03T10:00:00+01:00");

test("unconfirmed reservations expire when their slot starts", () => {
  for (const request of ["SENT", "QUOTED", "PRICE_ACCEPTED"]) {
    for (const status of ["PROPOSED", "COUNTER_PROPOSED", "ACCEPTED"]) {
      assert.equal(reservationStatus(request, { status, startsAt }, after), "EXPIRED");
      assert.equal(reservationStatus(request, { status, startsAt }, +new Date(startsAt)), "EXPIRED");
      assert.equal(reservationStatus(request, { status, startsAt }, +new Date(startsAt) - 1), status);
    }
  }
});

test("preserves confirmed, completed, cancelled and rejected reservations", () => {
  for (const status of ["CONFIRMED", "CANCELLED", "REJECTED"]) {
    assert.equal(reservationStatus("SENT", { status, startsAt }, after), status);
  }
  assert.equal(reservationStatus("BOOKED", { status: "PROPOSED", startsAt }, after), "CONFIRMED");
  for (const request of ["EN_ROUTE", "IN_PROGRESS", "COMPLETED", "CANCELLED", "REJECTED"]) {
    for (const status of ["PROPOSED", "CONFIRMED"]) {
      assert.equal(reservationStatus(request, { status, startsAt }, after), request);
    }
  }
});
