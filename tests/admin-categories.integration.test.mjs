import assert from "node:assert/strict";
import { test } from "node:test";
import { SignJWT } from "jose";
import { prisma } from "../src/app/lib/prisma.ts";
import { findAssistantProfessionals } from "../src/app/lib/assistant-directory.ts";

const base = process.env.ADMIN_TEST_URL || "http://localhost:3000";
test("dynamic category catalog: permissions, registration, associations, search and lifecycle", { timeout: 180000 }, async t => {
  const marker = `Catalogue QA ${crypto.randomUUID()}`;
  const ids = [], categoryIds = [], requestIds = [];
  let category, professional, client;
  async function session(user) {
    const token = await new SignJWT({ userId: user.id }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("10m").sign(new TextEncoder().encode(process.env.JWT_SECRET));
    return { Cookie: `session=${token}`, Origin: base, "Content-Type": "application/json" };
  }
  async function account(role, isSuspended = false) {
    const user = await prisma.user.create({ data: { name: marker, email: `${crypto.randomUUID()}@example.invalid`, password: "not-a-login", role, status: "ACTIVE", isSuspended, notificationEnabled: false } });
    ids.push(user.id);
    return { ...user, headers: await session(user) };
  }
  async function call(actor, path, method = "GET", body, expected = 200, headers = {}) {
    const response = await fetch(base + path, { method, headers: { ...(actor?.headers ?? {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await response.json();
    assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(data)}`);
    return data;
  }
  async function register(name, expected) {
    const form = new FormData();
    const email = `${crypto.randomUUID()}@example.invalid`;
    for (const [key, value] of Object.entries({ firstName: "Test", lastName: "Catalogue", email, password: "Fixture-only-2026", passwordConfirmation: "Fixture-only-2026", termsAccepted: "true", role: "PROFESSIONAL", phone: "+21655123456", businessName: marker, specialty: name, experience: "3 ans", serviceCity: "Tunis", coveredAreas: "Tunis" })) form.set(key, value);
    const response = await fetch(base + "/api/auth/register", { method: "POST", body: form });
    const data = await response.json();
    if (data.id) ids.push(data.id);
    assert.equal(response.status, expected, JSON.stringify(data));
    return data;
  }
  async function inventory(admin, id) {
    return (await call(admin, "/api/admin/categories")).categories.find(category => category.id === id);
  }
  try {
    const admin = await account("ADMIN"), suspended = await account("ADMIN", true);
    client = await account("CLIENT");
    const value = { name: marker, description: "Une nouvelle expertise", icon: "leaf", isActive: true };
    await t.test("catalog mutations enforce authentication, role, suspension and origin", async () => {
      for (const [path, method] of [["/api/admin/categories", "POST"], ["/api/admin/categories/1", "PUT"], ["/api/admin/categories/1", "PATCH"], ["/api/admin/categories/1", "DELETE"]]) {
        await call(null, path, method, value, 401);
        await call(client, path, method, value, 403);
        await call(suspended, path, method, value, 403);
      }
      await call(admin, "/api/admin/categories", "POST", value, 403, { Origin: "https://foreign.invalid" });
      await call(client, "/api/admin/categories", "GET", undefined, 403);
      await call(admin, "/api/admin/categories", "POST", { ...value, icon: "unknown" }, 400);
    });
    await t.test("unused categories are listed and immediately offered at registration and in directory facets", async () => {
      category = (await call(admin, "/api/admin/categories", "POST", value, 201)).category;
      categoryIds.push(category.id);
      await call(admin, "/api/admin/categories", "POST", { ...value, name: `  ${marker.toUpperCase()}  ` }, 409);
      const item = await inventory(admin, category.id);
      assert.equal(item.professionals, 0); assert.equal(item.approved, 0); assert.equal(item.interventions, 0);
      assert.ok((await call(null, "/api/categories")).categories.some(item => item.id === category.id));
      const registration = await fetch(base + "/register");
      assert.equal(registration.status, 200);
      assert.ok((await registration.text()).includes(`<option value="${marker}">${marker}</option>`));
      const directory = await call(client, "/api/client/professionnels");
      assert.ok(directory.specialties.includes(marker));
      const page = await fetch(base + "/admin/categories", { headers: admin.headers });
      assert.equal(page.status, 200);
      const html = await page.text();
      assert.ok(html.includes(marker)); assert.match(html, /Ajouter une catégorie/);
    });
    await t.test("registration links the selected category and rejects invented specialties", async () => {
      await register("Invented category outside the catalog", 400);
      const result = await register(marker, 201);
      professional = await prisma.user.findUniqueOrThrow({ where: { id: result.id } });
      assert.equal(professional.categoryId, category.id);
      assert.equal(professional.specialty, marker);
      assert.equal(professional.status, "PENDING_VERIFICATION");
      await prisma.user.update({ where: { id: professional.id }, data: { status: "APPROVED", isPublic: true, verifiedAt: new Date(), priceMin: 25 } });
      const item = await inventory(admin, category.id);
      assert.equal(item.professionals, 1); assert.equal(item.approved, 1);
      const found = await call(client, `/api/client/professionnels?specialty=${encodeURIComponent(marker)}`);
      assert.ok(found.professionals.some(person => person.id === professional.id));
      assert.ok((await findAssistantProfessionals({ category: marker, city: "Tunis", budget: 50 })).some(person => person.id === professional.id));
    });
    await t.test("new interventions use the catalog association and current profiles remain editable", async () => {
      const startsAt = new Date(Date.now() + 2 * 86400000); startsAt.setUTCMinutes(0, 0, 0);
      const slot = await prisma.availabilitySlot.create({ data: { professionalId: professional.id, startsAt, endsAt: new Date(+startsAt + 3600000) } });
      const result = await call(client, "/api/client/espace", "POST", { action: "request.create", source: "PROFILE", professionalId: professional.id, slotId: slot.id, message: "Entretien du jardin et des plantations", address: "Adresse de test à Tunis" });
      requestIds.push(result.id);
      const request = await prisma.serviceRequest.findUniqueOrThrow({ where: { id: result.id } });
      assert.equal(request.categoryId, category.id); assert.equal(request.category, marker);
      const profile = { ...professional, headers: await session(professional) };
      await call(profile, "/api/professionnel/profil", "PUT", { name: professional.name, businessName: marker, email: professional.email, phone: professional.phone, specialty: marker, experience: "3 ans", serviceCity: "Tunis", coveredAreas: "Tunis", priceRange: "", description: "Description actualisée" });
      assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: professional.id } })).categoryId, category.id);
    });
    await t.test("renames preserve stable associations, historic labels and professional filtering", async () => {
      const request = await prisma.serviceRequest.create({ data: { clientId: client.id, professionalId: professional.id, categoryId: category.id, category: marker, kind: "INTERVENTION", title: marker, message: "Fixture history" } });
      requestIds.push(request.id);
      await prisma.equipment.create({ data: { clientId: client.id, categoryId: category.id, category: marker, name: marker } });
      const renamed = marker + " modifiée";
      await call(admin, `/api/admin/categories/${category.id}`, "PUT", { ...value, name: renamed, icon: "wrench" });
      const user = await prisma.user.findUniqueOrThrow({ where: { id: professional.id } });
      assert.equal(user.categoryId, category.id); assert.equal(user.specialty, renamed);
      const history = await prisma.serviceRequest.findUniqueOrThrow({ where: { id: request.id } });
      assert.equal(history.categoryId, category.id); assert.equal(history.category, marker);
      const item = await inventory(admin, category.id);
      assert.equal(item.professionals, 1); assert.equal(item.interventions, 2); assert.equal(item.equipment, 1);
      const filtered = await fetch(`${base}/admin/professionnels?specialty=${encodeURIComponent(renamed)}`, { headers: admin.headers });
      assert.equal(filtered.status, 200); assert.ok((await filtered.text()).includes(professional.email));
      await call(admin, "/api/admin/categories", "POST", value, 409, {});
      category.name = renamed;
    });
    await t.test("used categories are deactivated instead of deleted; public choices and recommendations update", async () => {
      const result = await call(admin, `/api/admin/categories/${category.id}`, "DELETE");
      assert.equal(result.deactivated, true);
      assert.equal((await prisma.serviceCategory.findUniqueOrThrow({ where: { id: category.id } })).isActive, false);
      assert.equal((await inventory(admin, category.id)).interventions, 2);
      assert.ok(!(await call(null, "/api/categories")).categories.some(item => item.id === category.id));
      assert.ok(!(await call(client, "/api/client/professionnels")).specialties.includes(category.name));
      assert.deepEqual(await findAssistantProfessionals({ category: category.name, city: "Tunis", budget: 50 }), []);
      await register(category.name, 400);
      const future = new Date(Date.now() + 3 * 86400000); future.setUTCMinutes(0, 0, 0);
      const slot = await prisma.availabilitySlot.create({ data: { professionalId: professional.id, startsAt: future, endsAt: new Date(+future + 3600000) } });
      await call(client, "/api/client/espace", "POST", { action: "request.create", source: "PROFILE", professionalId: professional.id, slotId: slot.id, message: "Nouvelle intervention dans une catégorie inactive", address: "Adresse de test à Tunis" }, 409);
      const profile = { ...professional, headers: await session(professional) };
      await call(profile, "/api/professionnel/profil", "PUT", { name: professional.name, businessName: marker, email: professional.email, phone: professional.phone, specialty: category.name, experience: "3 ans", serviceCity: "Tunis", coveredAreas: "Tunis", priceRange: "", description: "Coordonnées toujours modifiables" });
      const request = await fetch(base + `/admin/demandes/${requestIds[0]}`, { headers: admin.headers });
      assert.equal(request.status, 200);
      await call(admin, `/api/admin/categories/${category.id}`, "PATCH", { isActive: true });
      assert.ok((await call(null, "/api/categories")).categories.some(item => item.id === category.id));
    });
    await t.test("unused deletion removes the category and all operations are audited", async () => {
      const unused = (await call(admin, "/api/admin/categories", "POST", { ...value, name: marker + " inutilisée" }, 201)).category;
      categoryIds.push(unused.id);
      assert.equal((await call(admin, `/api/admin/categories/${unused.id}`, "DELETE")).deactivated, false);
      assert.equal(await prisma.serviceCategory.findUnique({ where: { id: unused.id } }), null);
      await call(admin, `/api/admin/categories/${unused.id}`, "PUT", value, 404);
      assert.ok(await prisma.adminAuditLog.count({ where: { actorId: admin.id, action: { startsWith: "CATEGORY_" } } }) >= 6);
    });
  } finally {
    await prisma.serviceRequest.deleteMany({ where: { id: { in: requestIds } } });
    await prisma.serviceRequest.deleteMany({ where: { clientId: { in: ids }, kind: "MESSAGE" } });
    await prisma.equipment.deleteMany({ where: { clientId: { in: ids } } });
    await prisma.clientNotification.deleteMany({ where: { OR: [{ userId: { in: ids } }, { title: { startsWith: marker } }] } });
    await prisma.adminAuditLog.deleteMany({ where: { actorId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.serviceCategory.deleteMany({ where: { id: { in: categoryIds } } });
    await prisma.$disconnect();
  }
});
