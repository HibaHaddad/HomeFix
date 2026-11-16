import assert from "node:assert/strict";
import { test } from "node:test";
import { SignJWT } from "jose";
import { prisma } from "../src/app/lib/prisma.ts";

const base = process.env.ADMIN_TEST_URL || "http://localhost:3000";
test("Admin chat preserves receipts and protects audited attachments across message pages", { timeout: 180000 }, async () => {
  const marker = `Messaging QA ${crypto.randomUUID()}`;
  const users = [], requests = [];
  async function account(role) {
    const user = await prisma.user.create({ data: { name: marker, email: `${crypto.randomUUID()}@example.invalid`, password: "fixture", role, status: role === "PROFESSIONAL" ? "APPROVED" : "ACTIVE", notificationEnabled: false } });
    users.push(user.id);
    const token = await new SignJWT({ userId: user.id }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("10m").sign(new TextEncoder().encode(process.env.JWT_SECRET));
    return { ...user, headers: { Cookie: `session=${token}`, Origin: base, "Content-Type": "application/json" } };
  }
  try {
    const admin = await account("ADMIN"), otherAdmin = await account("ADMIN"), client = await account("CLIENT"), pro = await account("PROFESSIONAL");
    const root = await prisma.serviceRequest.create({ data: { clientId: client.id, professionalId: pro.id, kind: "MESSAGE", status: "CONVERSATION", title: marker, message: "SECRET_INITIAL" } }); requests.push(root.id);
    const child = await prisma.serviceRequest.create({ data: { clientId: client.id, professionalId: pro.id, conversationId: root.id, kind: "INTERVENTION", title: marker, message: "Fixture" } }); requests.push(child.id);
    await prisma.chatMessage.createMany({ data: Array.from({ length: 52 }, (_, index) => ({ requestId: index % 2 ? child.id : root.id, senderId: index % 2 ? pro.id : client.id, text: `SECRET_MESSAGE_${index}` })) });
    const messages = await prisma.chatMessage.findMany({ where: { requestId: { in: requests } }, orderBy: { id: "asc" } });
    const file = await prisma.clientAttachment.create({ data: { requestId: root.id, messageId: messages[0].id, name: "fixture.txt", mime: "text/plain", size: 7, data: Buffer.from("fixture") } });
    const url = `${base}/api/admin/conversations/${root.id}`;
    for (const path of ["/admin/messagerie", `/admin/messagerie/${root.id}`]) {
      const response = await fetch(base + path, { headers: admin.headers });
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.match(html, /Chargement de la conversation/);
      assert.match(html, /Conversations/);
      assert.doesNotMatch(html, /SECRET_INITIAL|SECRET_MESSAGE_|cx-chat-compose|Motif de consultation|am-access-reason/);
    }
    async function access(actor, body, expected = 200) {
      const response = await fetch(`${url}/access`, { method: "POST", headers: actor.headers, body: JSON.stringify(body) });
      assert.equal(response.status, expected, await response.clone().text());
      return response.json();
    }
    await access(client, {}, 403);
    await access(admin, { before: "invalid" }, 400);
    const latest = await access(admin, {});
    assert.equal((await prisma.adminAuditLog.findUniqueOrThrow({ where: { id: latest.accessId } })).reason, null);
    assert.equal(latest.messages.length, 50);
    assert.equal(latest.interventions[0].id, child.id);
    const older = await access(admin, { before: latest.nextBefore });
    assert.equal(older.messages.length, 2);
    assert.equal(older.nextBefore, null);
    assert.equal(new Set([...latest.messages, ...older.messages].map(message => message.id)).size, 52);
    const attachment = `${url}/attachments/${file.id}`;
    assert.equal((await fetch(`${attachment}?access=${latest.accessId}`, { headers: admin.headers })).status, 404, "latest page grant cannot open older files");
    assert.equal((await fetch(`${attachment}?access=${older.accessId}`, { headers: otherAdmin.headers })).status, 403, "grants belong to the consulting administrator");
    assert.equal((await fetch(`${attachment}?access=${older.accessId}`, { headers: client.headers })).status, 403);
    const downloaded = await fetch(`${attachment}?access=${older.accessId}`, { headers: admin.headers });
    assert.equal(downloaded.status, 200);
    assert.equal(await downloaded.text(), "fixture");
    assert.match(downloaded.headers.get("cache-control"), /no-store/);
    assert.match(downloaded.headers.get("content-disposition"), /attachment/);
    assert.equal(await prisma.adminAuditLog.count({ where: { actorId: admin.id, action: "DOCUMENT_READ" } }), 1);
    await prisma.adminAuditLog.update({ where: { id: older.accessId }, data: { createdAt: new Date(Date.now() - 16 * 60000) } });
    assert.equal((await fetch(`${attachment}?access=${older.accessId}`, { headers: admin.headers })).status, 403, "expired grants require a new consultation");
    const after = await prisma.chatMessage.findMany({ where: { requestId: { in: requests } }, orderBy: { id: "asc" } });
    assert.deepEqual(after, messages, "admin reads must never mark participant messages delivered or read");
  } finally {
    await prisma.adminAuditLog.deleteMany({ where: { actorId: { in: users } } });
    await prisma.clientNotification.deleteMany({ where: { OR: [{ userId: { in: users } }, { title: { startsWith: marker } }] } });
    for (const id of requests.reverse()) await prisma.serviceRequest.deleteMany({ where: { id } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  }
});
