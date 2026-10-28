import assert from "node:assert/strict";
import { test } from "node:test";
import { amount, deposit, bookingDates, coordinates, id, nextProfessionalStatus } from "../src/lib/client-domain.ts";
test("TND amounts use millimes and deposits never lose a millime", () => {
  assert.equal(amount("125.501"), 125501);
  assert.equal(deposit(125501), 62751);
  for (const v of ["1.0001", "-4", "NaN", Infinity, "1e4", {}, null]) assert.throws(() => amount(v));
});
test("booking times use Tunis time even when the server uses another timezone", () => {
  const dates = bookingDates("2030-01-15T10:00", "2030-01-15T11:00", 0);
  assert.equal(dates.startsAt.toISOString(), "2030-01-15T09:00:00.000Z");
  assert.throws(() => bookingDates("2030-01-15T11:00", "2030-01-15T10:00", 0));
  assert.throws(() => bookingDates("bad date!!", "2030-01-15T10:00", 0));
  assert.throws(() => bookingDates("2030-01-15T10:00", "2030-01-17T11:00", 0));
});
test("only ordered professional status transitions are accepted", () => {
  assert.equal(nextProfessionalStatus("BOOKED", "EN_ROUTE"), "EN_ROUTE");
  assert.equal(nextProfessionalStatus("EN_ROUTE", "IN_PROGRESS"), "IN_PROGRESS");
  assert.equal(nextProfessionalStatus("IN_PROGRESS", "COMPLETED"), "COMPLETED");
  assert.throws(() => nextProfessionalStatus("SENT", "COMPLETED"));
  assert.throws(() => nextProfessionalStatus("COMPLETED", "IN_PROGRESS"));
});
test("GPS and database IDs reject malformed and out-of-range values", () => {
  assert.deepEqual(coordinates(36.8065, 10.1815), { latitude: 36.8065, longitude: 10.1815 });
  for (const point of [[91, 10], [10, 181], [NaN, 10], ["36", 10]]) assert.throws(() => coordinates(...point));
  assert.equal(id("42"), 42);
  for (const value of [0, -1, "42xyz", 2 ** 40, {}, 1.5]) assert.throws(() => id(value));
});
