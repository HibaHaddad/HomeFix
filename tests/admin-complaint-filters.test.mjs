import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAdminComplaintFilters, complaintDateRange } from "../src/lib/admin-complaint-filters.ts";

test("complaint filters bound input, preserve combinations and reject invalid dates", () => {
  const filters = parseAdminComplaintFilters({ q: "  REC-0052  ", status: "IN_PROGRESS", priority: "URGENT", role: "PROFESSIONAL", from: "2026-11-01", to: "2026-11-10", sort: "oldest", page: "2" });
  assert.equal(filters.q, "REC-0052"); assert.equal(filters.priority, "URGENT"); assert.equal(filters.role, "PROFESSIONAL"); assert.equal(filters.page, 2);
  const invalid = parseAdminComplaintFilters({ priority: "invented", role: "UNKNOWN", from: "2026-02-30", to: "2026-13-01", page: "100000000000000000000", q: "a".repeat(200) });
  assert.equal(invalid.priority, "ALL"); assert.equal(invalid.role, "ALL"); assert.equal(invalid.from, ""); assert.equal(invalid.to, ""); assert.equal(invalid.page, 1); assert.equal(invalid.q.length, 120);
  assert.equal(parseAdminComplaintFilters({ from: "2026-11-10", to: "2026-11-01" }).to, "2026-11-10");
});
test("date ranges include the complete final day in Tunis local time", () => {
  const range = complaintDateRange({ from: "2026-11-01", to: "2026-11-01" });
  assert.equal(range.gte.toISOString(), "2026-10-31T23:00:00.000Z");
  assert.equal(range.lt.toISOString(), "2026-11-01T23:00:00.000Z");
  assert.deepEqual(complaintDateRange({ from: "", to: "" }), {});
});
