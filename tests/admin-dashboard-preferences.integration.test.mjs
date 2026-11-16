// Real HTTP and PostgreSQL with isolated, automatically cleaned-up accounts.
import assert from "node:assert/strict";
import { test } from "node:test";
import { SignJWT } from "jose";
import { prisma } from "../src/app/lib/prisma.ts";
import { defaultDashboardPreferences, dashboardKpis, dashboardWidgets } from "../src/lib/admin-dashboard-preferences.ts";

const base = process.env.ADMIN_TEST_URL || "http://localhost:3000";

test("dashboard preferences: access control, ownership, persistence, rendering and reset", { timeout: 180000 }, async t => {
  const marker = `Dashboard preferences QA ${crypto.randomUUID()}`;
  const ids = [];
  async function session(user) {
    const token = await new SignJWT({ userId: user.id }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("10m").sign(new TextEncoder().encode(process.env.JWT_SECRET));
    return { Cookie: `session=${token}`, Origin: base, "Content-Type": "application/json" };
  }
  async function account(role, isSuspended = false) {
    const user = await prisma.user.create({ data: { name: marker, email: `${crypto.randomUUID()}@example.invalid`, password: "not-a-login", role, isSuspended, notificationEnabled: false } });
    ids.push(user.id);
    return { ...user, headers: await session(user) };
  }
  async function put(actor, body, expected = 200, extraHeaders = {}) {
    const response = await fetch(`${base}/api/admin/settings`, { method: "PUT", headers: { "Content-Type": "application/json", ...(actor?.headers || {}), ...extraHeaders }, body: JSON.stringify(body) });
    const data = await response.json();
    assert.equal(response.status, expected, JSON.stringify(data));
    return data;
  }
  async function page(actor, path = "/admin") {
    const response = await fetch(base + path, { headers: actor.headers, redirect: "manual" });
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.doesNotMatch(html, /Internal Server Error|Application error:/);
    return html;
  }
  const body = value => ({ key: "DASHBOARD_PREFERENCES", value });
  const stored = id => prisma.adminSetting.findUnique({ where: { key: `DASHBOARD_PREFERENCES:${id}` } });
  const cardCount = html => [...html.matchAll(/class="admin-kpi-card"/g)].length;
  try {
    const a = await account("ADMIN"), b = await account("ADMIN"), client = await account("CLIENT"), suspended = await account("ADMIN", true);
    const defaults = defaultDashboardPreferences();

    await t.test("only active administrators may save same-origin preferences", async () => {
      await put(null, body(defaults), 401);
      await put(client, body(defaults), 403);
      await put(suspended, body(defaults), 403);
      await put(a, body(defaults), 403, { Origin: "https://foreign.example" });
      assert.equal(await stored(a.id), null);
    });

    await t.test("first visit uses essential defaults and exposes all options in settings", async () => {
      assert.equal(cardCount(await page(a)), defaults.kpis.length);
      const settings = await page(a, "/admin/parametres");
      assert.match(settings, /Personnaliser mon dashboard/);
      assert.equal([...settings.matchAll(/name="kpis"/g)].length, 12);
      assert.equal([...settings.matchAll(/name="widgets"/g)].length, 7);
      assert.match(settings, /Enregistrer mes préférences/);
      assert.match(settings, /Réinitialiser par défaut/);
    });

    await t.test("server rejects unknown fields, IDs, duplicates and attempts to choose another owner", async () => {
      for (const invalid of [
        body({ kpis: ["unknown"], widgets: [] }), body({ kpis: [], widgets: ["unknown"] }),
        body({ kpis: ["totalUsers", "totalUsers"], widgets: [] }), body({ kpis: [], widgets: null }),
        body({ ...defaults, adminId: b.id }), { ...body(defaults), adminId: b.id },
        { key: `DASHBOARD_PREFERENCES:${b.id}`, value: defaults },
      ]) await put(a, invalid, 400);
      assert.equal(await stored(a.id), null);
      assert.equal(await stored(b.id), null);
    });

    const custom = { kpis: ["totalReviews"], widgets: ["statuses"] };
    await t.test("selection is stored for the signed-in administrator and survives fresh requests and sessions", async () => {
      await put(a, body(custom));
      assert.deepEqual((await stored(a.id)).value, custom);
      for (const headers of [a.headers, await session(a)]) {
        const html = await page({ headers });
        assert.equal(cardCount(html), 1);
        assert.match(html, /class="admin-kpi-label">Avis<\/span>/);
        assert.match(html, /<h2>Répartition par statut<\/h2>/);
        for (const title of ["Évolution des inscriptions", "Dernières actions Admin", "Dernières opérations", "Gestion de la plateforme"]) {
          assert.ok(!html.includes(`<h2>${title}</h2>`), `hidden widget: ${title}`);
        }
        assert.ok(!html.includes('class="admin-hero-priorities"'), "hidden metrics must not appear in hero counters");
      }
      const settings = await page(a, "/admin/parametres");
      assert.match(settings, /name="kpis"[^>]*checked=""[^>]*value="totalReviews"|name="kpis"[^>]*value="totalReviews"[^>]*checked=""/);
      assert.equal(cardCount(await page(b)), defaults.kpis.length);
      assert.equal(await stored(b.id), null);
    });

    await t.test("empty selections render a helpful state and every existing widget can be enabled", async () => {
      await put(a, body({ kpis: [], widgets: [] }));
      const empty = await page(a);
      assert.equal(cardCount(empty), 0);
      assert.match(empty, /Aucun indicateur ni widget sélectionné/);
      assert.ok(!empty.includes('class="admin-chart-grid"'));
      assert.ok(!empty.includes('<section class="admin-kpi-grid"'), "no metric section after streamed loading placeholders");
      const all = { kpis: dashboardKpis.map(item => item.id), widgets: dashboardWidgets.map(item => item.id) };
      await put(a, body(all));
      const full = await page(a);
      assert.equal(cardCount(full), 12);
      for (const title of ["Évolution des inscriptions", "Interventions terminées", "Par catégorie", "Répartition par statut", "Dernières actions Admin", "Dernières opérations", "Gestion de la plateforme"]) {
        assert.ok(full.includes(`<h2>${title}</h2>`), title);
      }
    });

    await t.test("reset persists defaults without modifying another administrator and writes an audit record", async () => {
      await put(b, body(custom));
      await put(a, body(defaults));
      assert.deepEqual((await stored(a.id)).value, defaults);
      assert.deepEqual((await stored(b.id)).value, custom);
      assert.equal(cardCount(await page(a)), defaults.kpis.length);
      assert.equal(cardCount(await page(b)), 1);
      assert.ok(await prisma.adminAuditLog.count({ where: { actorId: a.id, action: "SETTINGS_UPDATE", target: `settings:DASHBOARD_PREFERENCES:${a.id}` } }) > 0);
    });
  } finally {
    await prisma.clientNotification.deleteMany({ where: { OR: [{ userId: { in: ids } }, { title: { startsWith: `${marker} · ` }, href: "/admin/activites" }] } });
    await prisma.adminSetting.deleteMany({ where: { key: { in: ids.map(id => `DASHBOARD_PREFERENCES:${id}`) } } });
    await prisma.adminAuditLog.deleteMany({ where: { actorId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
});
