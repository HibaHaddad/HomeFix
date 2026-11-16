import assert from "node:assert/strict";
import { test } from "node:test";
import { SignJWT } from "jose";
import { prisma } from "../src/app/lib/prisma.ts";
const base = process.env.ADMIN_TEST_URL || "http://localhost:3000";

test("complaints workspace: filters, details, attachments, response, history and closure", { timeout: 180000 }, async t => {
  const marker = `Complaint QA ${crypto.randomUUID()}`;
  const ids = [], complaints = [];
  let request;
  async function account(role, isSuspended = false) {
    const user = await prisma.user.create({ data: { name: marker, email: `${crypto.randomUUID()}@example.invalid`, password: "not-a-login", role, isSuspended, notificationEnabled: false } });
    ids.push(user.id);
    const token = await new SignJWT({ userId: user.id }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("10m").sign(new TextEncoder().encode(process.env.JWT_SECRET));
    return { ...user, headers: { Cookie: `session=${token}`, Origin: base, "Content-Type": "application/json" } };
  }
  async function call(actor, path, method = "GET", body, expected = 200, extraHeaders = {}) {
    const response = await fetch(base + path, { method, headers: { ...(actor?.headers ?? {}), ...extraHeaders }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: "manual" });
    const data = await response.json();
    assert.equal(response.status, expected, `${path}: ${JSON.stringify(data)}`);
    return data;
  }
  async function page(admin, query) {
    const response = await fetch(`${base}/admin/reclamations?${new URLSearchParams(query)}`, { headers: admin.headers });
    assert.equal(response.status, 200);
    return response.text();
  }
  const rows = html => (html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? "");
  try {
    const admin = await account("ADMIN"), suspended = await account("ADMIN", true), client = await account("CLIENT"), professional = await account("PROFESSIONAL");
    await prisma.user.update({ where: { id: client.id }, data: { notificationEnabled: true } });
    request = await prisma.serviceRequest.create({ data: { clientId: client.id, professionalId: professional.id, kind: "INTERVENTION", message: "Private intervention initial text", title: marker, category: "Plomberie" } });
    const first = await prisma.complaint.create({ data: { clientId: client.id, requestId: request.id, subject: marker + " urgente", message: "Please examine this complete complaint message.", priority: "URGENT", createdAt: new Date("2026-11-01T10:00:00Z") } });
    const second = await prisma.complaint.create({ data: { clientId: professional.id, subject: marker + " prestataire", message: "A real professional complaint fixture.", priority: "LOW", status: "IN_PROGRESS", createdAt: new Date("2026-11-02T10:00:00Z") } });
    const third = await prisma.complaint.create({ data: { clientId: client.id, subject: marker + " résolue", message: "A resolved complaint fixture.", response: "This fixture was already resolved.", status: "RESOLVED", priority: "NORMAL", createdAt: new Date("2026-11-03T10:00:00Z") } });
    complaints.push(first.id, second.id, third.id);
    const file = await prisma.complaintAttachment.create({ data: { complaintId: first.id, name: "preuve.txt", mime: "text/plain", size: 8, data: new TextEncoder().encode("evidence") } });
    const requestFile = await prisma.clientAttachment.create({ data: { requestId: request.id, name: "intervention.txt", mime: "text/plain", size: 8, data: new TextEncoder().encode("original") } });
    const message = await prisma.chatMessage.create({ data: { requestId: request.id, senderId: client.id, text: "PRIVATE_CHAT_COMPLAINT_QA" } });
    const privateFile = await prisma.clientAttachment.create({ data: { requestId: request.id, messageId: message.id, name: "PRIVATE_CHAT_FILE.txt", mime: "text/plain", size: 6, data: new TextEncoder().encode("secret") } });
    await t.test("details and all actions require active Admin access", async () => {
      for (const [path, method, body] of [[`/api/admin/reclamations/${first.id}`, "GET"], [`/api/admin/reclamations/${first.id}/status`, "PATCH", { status: "IN_PROGRESS", priority: "HIGH", reason: "Fixture status change" }], [`/api/admin/reclamations/${first.id}/response`, "POST", { response: "Please read this reply to your complaint." }]]) {
        await call(null, path, method, body, 401);
        await call(client, path, method, body, 403);
        await call(suspended, path, method, body, 403);
      }
      await call(admin, `/api/admin/reclamations/${first.id}/status`, "PATCH", { status: "IN_PROGRESS", reason: "Fixture status change" }, 403, { Origin: "https://foreign.invalid" });
    });
    await t.test("all requested filters combine, reference search works, and empty results hide pagination", async () => {
      const html = await page(admin, { q: marker });
      assert.equal((rows(html).match(/<tr/g) ?? []).length, 3);
      assert.equal((html.match(/class="cc-kpi /g) ?? []).length, 4);
      for (const heading of ["Référence", "Utilisateur", "Rôle", "Sujet", "Date", "Priorité", "Statut", "Actions"]) assert.ok(html.includes(`<th>${heading}</th>`), heading);
      const filtered = await page(admin, { q: marker, role: "PROFESSIONAL", status: "IN_PROGRESS", priority: "LOW", from: "2026-11-02", to: "2026-11-02" });
      assert.equal((rows(filtered).match(/<tr/g) ?? []).length, 1); assert.ok(rows(filtered).includes(second.subject));
      const reference = await page(admin, { q: `REC-${String(first.id).padStart(4, "0")}` });
      assert.ok(rows(reference).includes(first.subject));
      const empty = await page(admin, { q: marker, priority: "HIGH" });
      assert.ok(empty.includes("Aucune réclamation correspondante")); assert.ok(!empty.includes('<footer class="cc-pagination">'));
    });
    await t.test("details show metadata and intervention files without exposing private conversation attachments", async () => {
      const detail = await call(admin, `/api/admin/reclamations/${first.id}`);
      assert.equal(detail.message, first.message); assert.equal(detail.priority, "URGENT"); assert.equal(detail.client.role, "CLIENT");
      assert.equal(detail.attachments[0].id, file.id); assert.equal(detail.request.attachments.length, 1);
      assert.ok(!JSON.stringify(detail).includes("PRIVATE_CHAT")); assert.ok(!("data" in detail.attachments[0]));
      for (const [attachment, source] of [[file, ""], [requestFile, "?source=intervention"]]) {
        const response = await fetch(`${base}/api/admin/reclamations/${first.id}/attachments/${attachment.id}${source}`, { headers: admin.headers });
        assert.equal(response.status, 200); assert.match(response.headers.get("content-disposition"), /^attachment/);
        assert.equal((await response.arrayBuffer()).byteLength, 8);
      }
      const privateResponse = await fetch(`${base}/api/admin/reclamations/${first.id}/attachments/${privateFile.id}?source=intervention`, { headers: admin.headers });
      assert.equal(privateResponse.status, 404);
      const foreign = await fetch(`${base}/api/admin/reclamations/${second.id}/attachments/${file.id}`, { headers: admin.headers });
      assert.equal(foreign.status, 404);
      const denied = await fetch(`${base}/api/admin/reclamations/${first.id}/attachments/${file.id}`, { headers: client.headers });
      assert.equal(denied.status, 403);
    });
    await t.test("priority and status changes are validated and recorded with actor and reason", async () => {
      await call(admin, `/api/admin/reclamations/${first.id}/status`, "PATCH", { status: "OPEN", priority: "UNKNOWN", reason: "Invalid priority" }, 400);
      await call(admin, `/api/admin/reclamations/${first.id}/status`, "PATCH", { status: "CLOSED", reason: "Closing without a response" }, 409);
      await call(admin, `/api/admin/reclamations/${first.id}/status`, "PATCH", { status: "IN_PROGRESS", priority: "HIGH", reason: "Examen du dossier et priorité réévaluée" });
      const detail = await call(admin, `/api/admin/reclamations/${first.id}`);
      assert.equal(detail.status, "IN_PROGRESS"); assert.equal(detail.priority, "HIGH");
      assert.ok(detail.history.some(event => event.action === "COMPLAINT_STATUS" && event.actorName === marker));
      assert.ok(detail.history.some(event => event.action === "COMPLAINT_PRIORITY" && event.reason.includes("priorité")));
    });
    await t.test("a response notifies its owner, remains immutable and allows closure with a persistent timeline", async () => {
      const reply = "Votre réclamation a été examinée et une solution vous est proposée.";
      await call(admin, `/api/admin/reclamations/${first.id}/response`, "POST", { response: reply });
      await call(admin, `/api/admin/reclamations/${first.id}/response`, "POST", { response: reply }, 409);
      assert.equal(await prisma.clientNotification.count({ where: { userId: client.id, title: { contains: first.subject } } }), 1);
      await call(admin, `/api/admin/reclamations/${first.id}/status`, "PATCH", { status: "CLOSED", priority: "HIGH", reason: "Réponse envoyée et solution confirmée" });
      const fresh = await call(admin, `/api/admin/reclamations/${first.id}`);
      assert.equal(fresh.status, "CLOSED"); assert.equal(fresh.response, reply);
      assert.equal(fresh.history.filter(event => event.action === "COMPLAINT_RESPONSE").length, 1);
      assert.equal(fresh.history.filter(event => event.action === "COMPLAINT_STATUS").length, 2);
      const direct = await fetch(base + `/admin/reclamations/${first.id}`, { headers: admin.headers });
      assert.equal(direct.status, 200); assert.ok((await direct.text()).includes("Historique du traitement"));
    });
  } finally {
    await prisma.clientNotification.deleteMany({ where: { OR: [{ userId: { in: ids } }, { title: { startsWith: marker } }] } });
    await prisma.adminAuditLog.deleteMany({ where: { actorId: { in: ids } } });
    await prisma.complaint.deleteMany({ where: { id: { in: complaints } } });
    if (request) await prisma.serviceRequest.delete({ where: { id: request.id } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
});
