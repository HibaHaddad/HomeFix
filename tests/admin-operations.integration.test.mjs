// Real PostgreSQL and HTTP, isolated fixtures. No Stripe requests or real account changes.
import assert from "node:assert/strict";
import { test } from "node:test";
import { SignJWT } from "jose";
import { prisma } from "../src/app/lib/prisma.ts";
const base = process.env.ADMIN_TEST_URL || "http://localhost:3000";

test("Admin modules: permissions, private reading, moderation, complaints, settings and audit", { timeout: 180000 }, async t => {
  const marker = `Admin QA ${crypto.randomUUID()}`;
  const ids = [];
  let request, child, review, invoice;
  const settingsBefore = await prisma.adminSetting.findUnique({ where: { key: "SANCTION_RULES" } });
  async function account(role, suspended = false) {
    const user = await prisma.user.create({ data: { name: marker, email: `${crypto.randomUUID()}@example.invalid`, password: "not-a-login", role, status: role === "PROFESSIONAL" ? "APPROVED" : "ACTIVE", isSuspended: suspended, notificationEnabled: false } });
    ids.push(user.id);
    const token = await new SignJWT({ userId: user.id }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("10m").sign(new TextEncoder().encode(process.env.JWT_SECRET));
    return { ...user, headers: { Cookie: `session=${token}`, Origin: base, "Content-Type": "application/json" } };
  }
  async function call(actor, path, body, expected, method = "POST", extraHeaders = {}) {
    const response = await fetch(base + path, { method, headers: { ...(actor?.headers || { "Content-Type": "application/json" }), ...extraHeaders }, body: JSON.stringify(body), redirect: "manual" });
    const data = await response.json().catch(() => null);
    assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(data)}`);
    return data;
  }
  try {
    const admin = await account("ADMIN"), suspendedAdmin = await account("ADMIN", true), client = await account("CLIENT"), pro = await account("PROFESSIONAL"), stranger = await account("CLIENT");
    request = await prisma.serviceRequest.create({ data: { clientId: client.id, professionalId: pro.id, kind: "MESSAGE", status: "CONVERSATION", title: marker, message: "PRIVATE_INITIAL_MESSAGE" } });
    child = await prisma.serviceRequest.create({ data: { clientId: client.id, professionalId: pro.id, conversationId: request.id, kind: "INTERVENTION", title: marker, message: "Service description", status: "COMPLETED", clientConfirmedAt: new Date() } });
    await prisma.chatMessage.createMany({ data: Array.from({ length: 52 }, (_, i) => ({ requestId: i % 2 ? child.id : request.id, senderId: i % 2 ? pro.id : client.id, text: `PRIVATE_CHAT_${i}` })) });
    await prisma.booking.create({ data: { requestId: child.id, professionalId: pro.id, startsAt: new Date(), endsAt: new Date(Date.now() + 3600000), status: "CONFIRMED" } });
    const quote = await prisma.quote.create({ data: { requestId: child.id, amountMillimes: 10000, details: "Fixture", status: "ACCEPTED", validUntil: new Date(Date.now() + 86400000) } });
    invoice = await prisma.clientInvoice.create({ data: { quoteId: quote.id, totalMillimes: 10000, depositMillimes: 0, paidMillimes: 10000, status: "PAID", testPaid: true } });
    await prisma.checkoutPayment.create({ data: { invoiceId: invoice.id, amountMillimes: 10000, status: "SUCCEEDED", merchantAccountId: "acct_fixture", merchantCountry: "FR", livemode: false } });
    review = await prisma.professionalReview.create({ data: { requestId: child.id, clientId: client.id, professionalId: pro.id, rating: 4, comment: "Fixture comment", published: true } });
    const complaint = await prisma.complaint.create({ data: { clientId: client.id, requestId: child.id, subject: marker, message: "Please examine this fixture" } });

    await t.test("all added mutations enforce authentication, role and suspension", async () => {
      const paths = [[`/api/admin/avis/${review.id}/moderation`, "POST"], [`/api/admin/conversations/${request.id}/access`, "POST"], ["/api/admin/settings", "PUT"], ["/api/admin/notifications", "PATCH"], [`/api/admin/reclamations/${complaint.id}/status`, "PATCH"], [`/api/admin/payments/${crypto.randomUUID()}/refund`, "POST"]];
      for (const [path, method] of paths) {
        await call(null, path, {}, 401, method);
        await call(client, path, {}, 403, method);
        await call(suspendedAdmin, path, {}, 403, method);
      }
      await call(admin, `/api/admin/avis/${review.id}/moderation`, {}, 403, "POST", { Origin: "https://foreign.example" });
      const login = await fetch(base + "/login", { headers: suspendedAdmin.headers, redirect: "manual" });
      assert.equal(login.status, 200);
      assert.match(login.headers.get("set-cookie") || "", /session=;/);
      const suspendedPage = await fetch(base + "/admin", { headers: suspendedAdmin.headers });
      assert.equal(suspendedPage.status, 200);
      assert.equal(new URL(suspendedPage.url).pathname, "/login", "suspended administrators must reach login without a redirect loop");
    });
    await t.test("server pages render and conversation text never appears before explicit access", async () => {
      for (const path of ["/admin", "/admin/utilisateurs", "/admin/professionnels", "/admin/demandes", "/admin/reservations", "/admin/avis", "/admin/messagerie", `/admin/messagerie/${request.id}`, "/admin/paiements", "/admin/sanctions", "/admin/notifications", "/admin/activites", "/admin/parametres", "/admin/reclamations"]) {
        const response = await fetch(base + path, { headers: admin.headers });
        assert.equal(response.status, 200, path);
        const html = await response.text();
        assert.doesNotMatch(html, /PRIVATE_CHAT_|PRIVATE_INITIAL_MESSAGE|Internal Server Error|Application error:/, path);
      }
      const oldDetail = await fetch(`${base}/admin/demandes/${request.id}`, { headers: admin.headers });
      assert.doesNotMatch(await oldDetail.text(), /PRIVATE_INITIAL_MESSAGE/);
    });
    await t.test("reason is mandatory, pagination and successful private accesses are audited", async () => {
      const url = `/api/admin/conversations/${request.id}/access`;
      await call(admin, url, { reason: "short" }, 400);
      assert.equal(await prisma.adminAuditLog.count({ where: { actorId: admin.id, action: "CONVERSATION_READ" } }), 0);
      const data = await call(admin, url, { reason: "Examine fixture complaint" }, 200);
      assert.equal(data.messages.length, 50);
      assert.equal(data.initialMessage, "PRIVATE_INITIAL_MESSAGE");
      assert.ok(data.nextBefore);
      const earlier = await call(admin, url, { reason: "Examine fixture complaint", before: data.nextBefore }, 200);
      assert.equal(earlier.messages.length, 2);
      assert.equal(new Set([...data.messages, ...earlier.messages].map(m => m.id)).size, 52);
      const logs = await prisma.adminAuditLog.findMany({ where: { actorId: admin.id, action: "CONVERSATION_READ" } });
      assert.equal(logs.length, 2);
      assert.doesNotMatch(JSON.stringify(logs), /PRIVATE_CHAT_|PRIVATE_INITIAL_MESSAGE/);
      assert.equal((await fetch(base + url, { headers: admin.headers })).status, 405);
    });
    await t.test("reports are owned, deduplicated, and moderation survives client edits", async () => {
      const url = `/api/reviews/${review.id}/report`;
      await call(stranger, url, { reason: "This account cannot report this review" }, 404);
      await call(pro, url, { reason: "Please examine this fixture comment" }, 201);
      await call(pro, url, { reason: "Duplicate report must be rejected" }, 409);
      await call(admin, `/api/admin/avis/${review.id}/moderation`, { action: "HIDE", reason: "Fixture moderation decision" }, 200);
      assert.equal((await prisma.professionalReview.findUniqueOrThrow({ where: { id: review.id } })).published, false);
      await call(client, "/api/client/espace", { action: "review.update", requestId: child.id, rating: 5, comment: "Edited but still hidden" }, 200);
      assert.equal((await prisma.professionalReview.findUniqueOrThrow({ where: { id: review.id } })).published, false);
      assert.equal(await prisma.reviewReport.count({ where: { reviewId: review.id, status: "OPEN" } }), 0);
      await call(admin, `/api/admin/avis/${review.id}/moderation`, { action: "PUBLISH", reason: "Fixture reviewed after edit" }, 200);
      assert.equal((await prisma.professionalReview.findUniqueOrThrow({ where: { id: review.id } })).published, true);
    });
    await t.test("complaint resolution requires a response and records the transition", async () => {
      const path = `/api/admin/reclamations/${complaint.id}/status`;
      await call(admin, path, { status: "RESOLVED", reason: "Fixture resolution" }, 409, "PATCH");
      await call(admin, path, { status: "IN_PROGRESS", reason: "Examining fixture complaint" }, 200, "PATCH");
      await call(admin, `/api/admin/reclamations/${complaint.id}/response`, { response: "This fixture response explains the solution." }, 200);
      await call(admin, path, { status: "RESOLVED", reason: "Fixture solution delivered" }, 200, "PATCH");
      assert.equal((await prisma.complaint.findUniqueOrThrow({ where: { id: complaint.id } })).status, "RESOLVED");
      assert.equal(await prisma.adminAuditLog.count({ where: { actorId: admin.id, action: "COMPLAINT_STATUS" } }), 2);
    });
    await t.test("sanction settings persist but cannot enable automatic enforcement", async () => {
      const value = { reviewThreshold: 2, absenceThreshold: 3, paymentDelayDays: 14, warningPoints: 1, suspensionPoints: 5 };
      await call(admin, "/api/admin/settings", { key: "SANCTION_RULES", value: { ...value, automaticEnforcement: true } }, 400, "PUT");
      await call(admin, "/api/admin/settings", { key: "SANCTION_RULES", value }, 200, "PUT");
      const stored = await prisma.adminSetting.findUniqueOrThrow({ where: { key: "SANCTION_RULES" } });
      assert.equal(stored.value.automaticEnforcement, false);
      assert.equal(await prisma.user.count({ where: { id: { in: [client.id, pro.id] }, isSuspended: true } }), 0);
    });
  } finally {
    if (settingsBefore) await prisma.adminSetting.upsert({ where: { key: "SANCTION_RULES" }, create: settingsBefore, update: { value: settingsBefore.value } });
    else await prisma.adminSetting.deleteMany({ where: { key: "SANCTION_RULES" } });
    await prisma.clientNotification.deleteMany({ where: { OR: [{ userId: { in: ids } }, { title: { startsWith: marker } }, ...(review ? [{ title: { startsWith: `L’avis #${review.id} ` } }] : [])] } });
    await prisma.adminAuditLog.deleteMany({ where: { actorId: { in: ids } } });
    if (invoice) { await prisma.checkoutPayment.deleteMany({ where: { invoiceId: invoice.id } }); await prisma.clientInvoice.delete({ where: { id: invoice.id } }); }
    await prisma.complaint.deleteMany({ where: { clientId: { in: ids } } });
    if (child) await prisma.serviceRequest.delete({ where: { id: child.id } });
    if (request) await prisma.serviceRequest.delete({ where: { id: request.id } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
});
