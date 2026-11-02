import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { SignJWT } from "jose";
import { io } from "socket.io-client";
import { prisma } from "../src/app/lib/prisma.ts";

const base = process.env.DIRECTORY_TEST_URL || "http://localhost:3000";
test("real Socket.IO: authentication, privacy, two-way messages, receipts, photos, GPS, reconnect and deduplication", { timeout: 120000 }, async () => {
  const ids = [], sockets = [];
  async function user(role) {
    const user = await prisma.user.create({ data: { name: "Realtime fixture", email: `chat-${crypto.randomUUID()}@example.invalid`, password: "not-a-login", role, status: role === "CLIENT" ? "ACTIVE" : "APPROVED", termsAccepted: true } });
    ids.push(user.id);
    const token = await new SignJWT({ userId: user.id }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m").sign(new TextEncoder().encode(process.env.JWT_SECRET));
    return { ...user, cookie: `session=${token}` };
  }
  async function connect(user) {
    const socket = io(base, { autoConnect: false, transports: ["websocket"], reconnection: false, extraHeaders: { Cookie: user?.cookie || "", Origin: base } });
    sockets.push(socket); const ready = once(socket, "connect"); socket.connect(); await ready; return socket;
  }
  const command = (socket, event, data) => socket.timeout(10000).emitWithAck(event, data);
  async function open(client, professionalId) {
    const response = await fetch(`${base}/api/client/espace`, { method: "POST", headers: { Cookie: client.cookie, Origin: base, "Content-Type": "application/json" }, body: JSON.stringify({ action: "conversation.open", professionalId }) });
    assert.equal(response.status, 200); return (await response.json()).id;
  }
  try {
    const client = await user("CLIENT"), pro = await user("PROFESSIONAL"), stranger = await user("CLIENT");
    const thread = await open(client, pro.id);
    assert.deepEqual(await Promise.all([open(client, pro.id), open(client, pro.id)]), [thread, thread]);
    const a = await connect(client), b = await connect(pro), c = await connect(stranger);
    const unauth = io(base, { autoConnect: false, reconnection: false }); sockets.push(unauth);
    const denied = once(unauth, "connect_error"); unauth.connect(); await denied;
    assert.equal((await command(c, "chat:open", { requestId: thread })).ok, false);
    assert.equal((await command(a, "chat:open", { requestId: thread })).result.online, true);
    const invalidRead = await command(b, "chat:read", { requestId: thread, ids: [1] }); assert.equal(invalidRead.ok, false);
    assert.equal((await command(b, "chat:open", { requestId: thread })).ok, true);
    const incoming = once(b, "chat:message");
    const input = { requestId: thread, nonce: crypto.randomUUID(), text: "Bonjour, une fuite sous mon évier." };
    const sent = await command(a, "chat:send", input); assert.equal(sent.ok, true);
    const [message] = await incoming; assert.equal(message.id, sent.result.id); assert.equal(message.readAt, null); assert.equal(message.deliveredAt, null);
    assert.equal((await command(a, "chat:send", input)).result.id, message.id);
    assert.equal(await prisma.chatMessage.count({ where: { requestId: thread, text: input.text } }), 1);
    assert.equal((await command(c, "chat:send", { ...input, nonce: crypto.randomUUID() })).ok, false);
    const deliveredEvent = once(a, "chat:receipts");
    await command(b, "chat:delivered", { requestId: thread, ids: [message.id] });
    assert.ok((await deliveredEvent)[0].messages[0].deliveredAt);
    let stored = await prisma.chatMessage.findUniqueOrThrow({ where: { id: message.id } }); assert.ok(stored.deliveredAt); assert.equal(stored.readAt, null);
    const readEvent = once(a, "chat:receipts");
    await command(b, "chat:read", { requestId: thread, ids: [message.id] });
    assert.ok((await readEvent)[0].messages[0].readAt);
    stored = await prisma.chatMessage.findUniqueOrThrow({ where: { id: message.id } }); assert.ok(stored.readAt);
    const reply = once(a, "chat:message");
    assert.equal((await command(b, "chat:send", { requestId: thread, nonce: crypto.randomUUID(), text: "Bonjour, pouvez-vous envoyer une photo ?" })).ok, true); await reply;
    const typing = once(b, "chat:typing"); await command(a, "chat:typing", { requestId: thread, typing: true }); assert.equal((await typing)[0].typing, true);
    const gps = await command(a, "chat:send", { requestId: thread, nonce: crypto.randomUUID(), text: "Ma position", latitude: 36.8065, longitude: 10.1815 }); assert.equal(gps.result.latitude, 36.8065);
    assert.equal((await command(a, "chat:send", { requestId: thread, nonce: crypto.randomUUID(), text: "GPS invalide", latitude: 200, longitude: 0 })).ok, false);
    const nonce = crypto.randomUUID(); const form = new FormData(); form.set("requestId", String(thread)); form.set("chat", "true"); form.set("nonce", nonce);
    form.set("file", new Blob([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1kAAAAASUVORK5CYII=", "base64")], { type: "image/png" }), "probleme.png");
    const photoEvent = once(b, "chat:message");
    const upload = await fetch(`${base}/api/client/fichiers`, { method: "POST", headers: { Cookie: client.cookie, Origin: base }, body: form }); assert.equal(upload.status, 201);
    const photo = await upload.json(); assert.equal((await photoEvent)[0].attachments[0].id, photo.id);
    const retry = await fetch(`${base}/api/client/fichiers`, { method: "POST", headers: { Cookie: client.cookie }, body: form }); assert.equal((await retry.json()).id, photo.id);
    for (const [actor, status] of [[client, 200], [pro, 200], [stranger, 404]]) {
      assert.equal((await fetch(`${base}/api/client/fichiers/${photo.id}`, { headers: { Cookie: actor.cookie } })).status, status);
      assert.equal((await fetch(`${base}/api/client/conversations/${thread}`, { headers: { Cookie: actor.cookie } })).status, status);
    }
    b.disconnect();
    const offline = await command(a, "chat:send", { requestId: thread, nonce: crypto.randomUUID(), text: "Message pendant la déconnexion" });
    const reconnect = once(b, "connect"); b.connect(); await reconnect;
    const pending = await command(b, "chat:pending", {});
    assert.ok(pending.result.some((m) => m.id === offline.result.id));
    await command(b, "chat:delivered", { requestId: thread, ids: [offline.result.id] });
    assert.ok((await prisma.chatMessage.findUniqueOrThrow({ where: { id: offline.result.id } })).deliveredAt);
    const history = await (await fetch(`${base}/api/client/conversations/${thread}`, { headers: { Cookie: pro.cookie } })).json(); assert.ok(history.messages.some((m) => m.id === offline.result.id));
    assert.ok(await prisma.clientNotification.count({ where: { userId: pro.id } }));
  } finally {
    sockets.forEach((s) => s.disconnect());
    await prisma.serviceRequest.deleteMany({ where: { clientId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
});
