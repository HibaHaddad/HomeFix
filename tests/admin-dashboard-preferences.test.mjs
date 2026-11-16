import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dashboardKpis, dashboardWidgets, defaultDashboardPreferences,
  readDashboardPreferences, validateDashboardPreferences,
} from "../src/lib/admin-dashboard-preferences.ts";

test("new administrators receive an essential selection; an empty saved dashboard stays empty", () => {
  const defaults = defaultDashboardPreferences();
  assert.ok(defaults.kpis.length > 0 && defaults.kpis.length < dashboardKpis.length);
  assert.ok(defaults.widgets.length > 0 && defaults.widgets.length < dashboardWidgets.length);
  assert.deepEqual(readDashboardPreferences(null), defaults);
  assert.deepEqual(readDashboardPreferences({ kpis: null, widgets: [] }), defaults);
  assert.deepEqual(readDashboardPreferences({ kpis: [], widgets: [] }), { kpis: [], widgets: [] });
  defaults.kpis.length = 0;
  assert.ok(defaultDashboardPreferences().kpis.length > 0, "defaults must not share mutable arrays");
});

test("preferences accept every existing metric and widget, reject malformed input and foreign fields", () => {
  const all = { kpis: dashboardKpis.map(item => item.id), widgets: dashboardWidgets.map(item => item.id) };
  assert.equal(all.kpis.length, 12);
  assert.equal(all.widgets.length, 7);
  assert.deepEqual(validateDashboardPreferences(all), all);
  assert.deepEqual(validateDashboardPreferences({ kpis: [], widgets: [] }), { kpis: [], widgets: [] });
  for (const invalid of [
    null, [], {}, { kpis: [] }, { kpis: [], widgets: "all" },
    { kpis: ["unknown"], widgets: [] }, { kpis: [1], widgets: [] },
    { kpis: ["totalUsers", "totalUsers"], widgets: [] },
    { kpis: [], widgets: ["signups", "signups"] },
    { ...all, adminId: 42 }, { ...all, key: "GENERAL" },
  ]) assert.throws(() => validateDashboardPreferences(invalid));
});

test("stored selections tolerate retired IDs, remove duplicates and preserve catalog ordering", () => {
  assert.deepEqual(readDashboardPreferences({
    kpis: ["netTnd", "retiredKpi", "totalUsers", "totalUsers"],
    widgets: ["quickLinks", "retiredWidget", "signups"],
  }), { kpis: ["totalUsers", "netTnd"], widgets: ["signups", "quickLinks"] });
});
