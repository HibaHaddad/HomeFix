import assert from "node:assert/strict";
import { test } from "node:test";
import { SignJWT } from "jose";
import { prisma } from "../src/app/lib/prisma.ts";
const base = process.env.ADMIN_TEST_URL || "http://localhost:3000";

test("client complaint submission reaches Admin and the reply returns to its owner", { timeout: 180000 }, async t => {
  const marker = `Support QA ${crypto.randomUUID()}`;
  const ids = [], requestIds = [];
  let created;
  async function account(role, isSuspended = false) {
    const user = await prisma.user.create({ data: { name: marker + " " + role, email: `${crypto.randomUUID()}@example.invalid`, password: "not-a-login", role, status: "ACTIVE", isSuspended, notificationEnabled: true } });
    ids.push(user.id);
    const token = await new SignJWT({ userId: user.id }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("10m").sign(new TextEncoder().encode(process.env.JWT_SECRET));
    return { ...user, headers: { Cookie: `session=${token}`, Origin: base } };
  }
  async function json(actor, path, method = "GET", value, expected = 200) {
    const response = await fetch(base + path, { method, headers: { ...(actor?.headers ?? {}), "Content-Type": "application/json" }, ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
    const data = await response.json();
    assert.equal(response.status, expected, JSON.stringify(data)); return data;
  }
  function form(values = {}, files = []) {
    const body = new FormData();
    for (const [key, value] of Object.entries({ type: "complaint", category: "other", subject: marker, message: "Veuillez examiner le problème rencontré avec ce professionnel.", ...values })) body.set(key, String(value));
    for (const file of files) body.append("files", file);
    return body;
  }
  async function submit(actor, body, expected = 201, extraHeaders = {}) {
    const response = await fetch(base + "/api/client/reclamations", { method: "POST", headers: { ...(actor?.headers ?? {}), ...extraHeaders }, body });
    const data = await response.json(); assert.equal(response.status, expected, JSON.stringify(data)); return data;
  }
  try {
    const client = await account("CLIENT"), other = await account("CLIENT"), suspended = await account("CLIENT", true), professional = await account("PROFESSIONAL"), admin = await account("ADMIN"), inactiveAdmin = await account("ADMIN", true);
    async function request(owner, title, kind = "INTERVENTION") {
      const item = await prisma.serviceRequest.create({ data: { clientId: owner.id, professionalId: professional.id, kind, title, message: "Intervention fixture", category: "Plomberie" } });
      requestIds.push(item.id); return item;
    }
    const own = await request(client, marker + " intervention personnelle"), foreign = await request(other, "OTHER_CLIENT_INTERVENTION_PRIVATE"), conversation = await request(client, marker + " conversation", "MESSAGE");
    const png = new File([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlS8AAAAASUVORK5CYII=", "base64")], "preuve.png", { type: "image/png" });
    await t.test("only active clients may submit same-origin complaints about their own interventions", async () => {
      for (const actor of [null, professional, admin, suspended]) await submit(actor, form(), 401);
      await submit(client, form(), 403, { Origin: "https://foreign.invalid" });
      await submit(client, form({ requestId: foreign.id }), 404);
      await submit(client, form({ requestId: conversation.id }), 404);
      await submit(client, form({ requestId: own.id, clientId: other.id }), 400);
      await submit(client, form({ status: "RESOLVED" }), 400);
      await submit(client, form({ category: "intervention", requestId: "" }), 400);
      assert.equal(await prisma.complaint.count({ where: { clientId: client.id } }), 0);
    });
    await t.test("the page preselects owned interventions, shows their professional and enables sending", async () => {
      const response = await fetch(`${base}/dashboard/reclamations?demande=${own.id}`, { headers: client.headers });
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.ok(html.includes(own.title)); assert.ok(!html.includes(foreign.title));
      assert.ok(html.includes("Professionnel concerné")); assert.ok(html.includes("Mes demandes et réclamations"));
      assert.match(html, /<option value="\d+" selected="">/);
      const submitButton = html.match(/<button[^>]*type="submit"[^>]*>[\s\S]*?Envoyer la demande<\/button>/)?.[0];
      assert.ok(submitButton); assert.ok(!submitButton.includes('disabled=""'));
    });
    await t.test("invalid or oversized files are rejected atomically", async () => {
      await submit(client, form({}, [new File(["not an image"], "fake.png", { type: "image/png" })]), 400);
      await submit(client, form({}, [png, png, png, png]), 400);
      await submit(client, form({}, [new File([new Uint8Array(5 * 1024 * 1024 + 1)], "too-large.pdf", { type: "application/pdf" })]), 400);
      assert.equal(await prisma.complaint.count({ where: { clientId: client.id } }), 0);
    });
    await t.test("submission persists the real client, intervention and proof, and notifies active administrators", async () => {
      created = await submit(client, form({ category: "intervention", requestId: own.id }, [png]));
      const complaint = await prisma.complaint.findUniqueOrThrow({ where: { id: created.id }, include: { attachments: true } });
      assert.equal(complaint.clientId, client.id); assert.equal(complaint.requestId, own.id); assert.equal(complaint.status, "OPEN"); assert.equal(complaint.priority, "NORMAL");
      assert.equal(complaint.attachments.length, 1); assert.equal(complaint.attachments[0].mime, "image/png");
      assert.ok(await prisma.clientNotification.count({ where: { userId: admin.id, href: `/admin/reclamations/${created.id}` } }) > 0);
      assert.equal(await prisma.clientNotification.count({ where: { userId: inactiveAdmin.id, href: `/admin/reclamations/${created.id}` } }), 0);
      const detail = await json(admin, `/api/admin/reclamations/${created.id}`);
      assert.equal(detail.client.id, client.id); assert.equal(detail.request.id, own.id); assert.equal(detail.attachments.length, 1);
      const listing = await fetch(`${base}/admin/reclamations?q=${encodeURIComponent(marker)}`, { headers: admin.headers });
      assert.equal(listing.status, 200); assert.ok((await listing.text()).includes(marker));
    });
    await t.test("each client's history and attachments are private", async () => {
      const page = await json(client, "/api/client/reclamations");
      assert.ok(page.items.some(item => item.id === created.id));
      assert.equal((await json(other, "/api/client/reclamations")).items.length, 0);
      await json(null, "/api/client/reclamations", "GET", undefined, 401);
      const file = page.items.find(item => item.id === created.id).attachments[0];
      for (const [actor, expected] of [[client, 200], [other, 404], [null, 401]]) {
        const response = await fetch(`${base}/api/client/reclamations/${created.id}/attachments/${file.id}`, { headers: actor?.headers });
        assert.equal(response.status, expected);
        if (expected === 200) { assert.match(response.headers.get("content-disposition"), /^attachment/); assert.equal((await response.arrayBuffer()).byteLength, png.size); }
      }
    });
    await t.test("Admin's response and closure are visible after a new client request", async () => {
      const reply = "Votre signalement a été examiné et le professionnel a été contacté pour trouver une solution.";
      await json(admin, `/api/admin/reclamations/${created.id}/response`, "POST", { response: reply });
      await json(admin, `/api/admin/reclamations/${created.id}/status`, "PATCH", { status: "CLOSED", reason: "Réponse transmise et dossier traité" });
      const result = await json(client, "/api/client/reclamations");
      const item = result.items.find(item => item.id === created.id);
      assert.equal(item.response, reply); assert.equal(item.status, "CLOSED");
      const notification = await prisma.clientNotification.findFirstOrThrow({ where: { userId: client.id, title: { contains: "Une réponse" } } });
      assert.ok(notification.href.includes(`reclamation=${created.id}`));
      const response = await fetch(base + notification.href, { headers: client.headers });
      assert.equal(response.status, 200); assert.ok((await response.text()).includes(reply));
    });
    await t.test("general help and the existing workspace action use the same Admin-connected storage", async () => {
      const help = await submit(client, form({ type: "help", category: "technical", subject: marker + " aide technique" }));
      assert.equal((await prisma.complaint.findUniqueOrThrow({ where: { id: help.id } })).requestId, null);
      const legacy = await json(client, "/api/client/espace", "POST", { action: "complaint.create", subject: marker + " ancienne API", message: "Une réclamation envoyée depuis le point d’entrée existant.", requestId: own.id });
      assert.ok(legacy.id);
      assert.equal((await prisma.complaint.findUniqueOrThrow({ where: { id: legacy.id } })).clientId, client.id);
    });
    await t.test("pagination remains owned and notification links can open an older complaint", async () => {
      await prisma.complaint.createMany({ data: Array.from({ length: 22 }, (_, index) => ({ clientId: client.id, subject: marker + ` historique ${index}`, message: "Ancienne demande de test pour vérifier la pagination.", createdAt: new Date(Date.now() - 86400000) })) });
      const first = await json(client, "/api/client/reclamations");
      assert.equal(first.items.length, 20); assert.ok(first.nextCursor);
      const second = await json(client, `/api/client/reclamations?before=${first.nextCursor}`);
      assert.ok(second.items.some(item => item.id === created.id));
      assert.ok(second.items.every(item => !first.items.some(previous => previous.id === item.id)));
      const response = await fetch(`${base}/dashboard/reclamations?reclamation=${created.id}`, { headers: client.headers });
      assert.equal(response.status, 200); assert.ok((await response.text()).includes(`id="reclamation-${created.id}"`));
      await json(client, "/api/client/reclamations?before=-1", "GET", undefined, 400);
    });
  } finally {
    await prisma.clientNotification.deleteMany({ where: { OR: [{ userId: { in: ids } }, { title: { contains: marker } }] } });
    await prisma.adminAuditLog.deleteMany({ where: { actorId: { in: ids } } });
    await prisma.complaint.deleteMany({ where: { clientId: { in: ids } } });
    await prisma.serviceRequest.deleteMany({ where: { id: { in: requestIds } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
});
