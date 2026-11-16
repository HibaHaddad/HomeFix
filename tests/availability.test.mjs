import assert from "node:assert/strict";
import { test } from "node:test";
import { availabilityHours, availabilityState, splitHours, monthBounds, tunisDay, tunisTime } from "../src/lib/availability.ts";
import { reservationStatus } from "../src/lib/reservation-status.ts";

test("a Tunis workday becomes eight exact one-hour slots with adjacent boundaries", () => {
  const range = availabilityHours("2030-01-15", "09:00", "17:00", 0);
  const slots = splitHours(range.startsAt, range.endsAt);
  assert.equal(slots.length, 8);
  assert.equal(slots[0].startsAt.toISOString(), "2030-01-15T08:00:00.000Z");
  assert.equal(tunisTime(slots[7].endsAt), "17:00");
  slots.forEach((s, i) => { assert.equal(+s.endsAt - +s.startsAt, 3600000); if (i) assert.equal(+slots[i - 1].endsAt, +s.startsAt); });
});
test("invalid dates, past ranges, inverted times and partial hours are rejected", () => {
  for (const [day, start, end] of [["2030-02-30", "09:00", "17:00"], ["2030-01-15", "17:00", "09:00"], ["2030-01-15", "09:00", "09:30"], ["2030-01-15", "09:00", "24:00"], ["bad", "09:00", "17:00"]]) assert.throws(() => availabilityHours(day, start, end, 0));
  assert.throws(() => availabilityHours("2020-01-15", "09:00", "17:00"));
  assert.equal(splitHours(...["2030-01-15T09:30:00+01:00", "2030-01-15T11:30:00+01:00"].map((d) => new Date(d))).length, 2);
});
test("month bounds follow Tunis midnight, including the new year", () => {
  const { from, until } = monthBounds("2030-12");
  assert.equal(from.toISOString(), "2030-11-30T23:00:00.000Z");
  assert.equal(until.toISOString(), "2030-12-31T23:00:00.000Z");
  assert.equal(tunisDay(until), "2031-01-01");
  assert.throws(() => monthBounds("2030-13"));
});

test("20:30–21:30 Tunis remains ongoing until its end, independently of display timezone", () => {
  const slot = availabilityHours("2030-05-20", "20:30", "21:30", 0);
  assert.equal(tunisTime(slot.startsAt), "20:30");
  assert.equal(slot.startsAt.toISOString(), "2030-05-20T19:30:00.000Z");
  assert.equal(availabilityState(slot, +new Date("2030-05-20T20:29:59+01:00")), "upcoming");
  assert.equal(availabilityState(slot, +new Date("2030-05-20T20:30:00+01:00")), "ongoing");
  assert.equal(availabilityState(slot, +new Date("2030-05-20T21:29:59+01:00")), "ongoing");
  assert.equal(availabilityState(slot, +new Date("2030-05-20T21:30:00+01:00")), "past");
  assert.equal(reservationStatus("SENT", { ...slot, status: "PROPOSED" }, +new Date("2030-05-20T21:10:00+01:00")), "PROPOSED");
  assert.equal(reservationStatus("QUOTED", { ...slot, status: "ACCEPTED" }, +new Date("2030-05-20T21:30:00+01:00")), "EXPIRED");
});
