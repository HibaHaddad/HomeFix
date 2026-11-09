import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { SignJWT } from "jose";
import { io } from "socket.io-client";
import { prisma } from "../src/app/lib/prisma.ts";

const base = process.env.DIRECTORY_TEST_URL || "http://localhost:3000";
test("intervention stages send private persisted notifications, chat messages and data updates", { timeout: 120000 }, async () => {
  const ids = [], sockets = [];
  async function user(role) {
    const u = await prisma.user.create({ data: { name: "Intervention notification fixture", email: `status-${crypto.randomUUID()}@example.invalid`, password: "not-a-login", role, status: role === "CLIENT" ? "ACTIVE" : "APPROVED", termsAccepted: true } }); ids.push(u.id);
    const token = await new SignJWT({ userId: u.id }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m").sign(new TextEncoder().encode(process.env.JWT_SECRET));
    return { ...u, headers: { Cookie: `session=${token}`, Origin: base } };
  }
  async function connect(user) {
    const socket = io(base, { autoConnect: false, reconnection: false, transports: ["websocket"], extraHeaders: user.headers }); sockets.push(socket);
    const connected = once(socket, "connect"); socket.connect(); await connected; return socket;
  }
  async function post(actor, action, values, status = 200) {
    const r = await fetch(`${base}${actor.role === "CLIENT" ? "/api/client/espace" : "/api/interactions"}`, { method: "POST", headers: { ...actor.headers, "Content-Type": "application/json" }, body: JSON.stringify({ action, ...values }) });
    const value = await r.json(); assert.equal(r.status, status, `${action}: ${JSON.stringify(value)}`); return value;
  }
  try {
    const pro = await user("PROFESSIONAL"), client = await user("CLIENT"), stranger = await user("CLIENT");
    const slot = await post(pro, "availability.create", { startsAt: "2030-07-15T09:00", endsAt: "2030-07-15T10:00" });
    const request = await post(client, "request.create", { source: "PROFILE", professionalId: pro.id, slotId: slot.id, message: "Une intervention de plomberie à suivre", address: "Adresse de test à Tunis" });
    const price = await post(pro, "booking.confirm", { requestId: request.id, amount: "80" });
    await post(client, "quote.accept", { requestId: request.id, quoteId: price.quoteId });
    const baseline = await prisma.chatMessage.count({ where: { requestId: request.conversationId } }); assert.ok(baseline >= 3, "price and booking messages are retained");
    const receiver = await connect(client), professional = await connect(pro), outsider = await connect(stranger);
    const opened = await receiver.emitWithAck("chat:open", { requestId: request.conversationId });
    assert.equal(opened.ok, true);
    let chatEvents = 0, leakedEvents = 0;
    receiver.on("chat:message", () => chatEvents++);
    outsider.on("notification:new", () => leakedEvents++); outsider.on("intervention:updated", () => leakedEvents++);
    outsider.on("chat:message", () => leakedEvents++);
    const href = `/dashboard/interventions?demande=${request.id}#intervention-${request.id}`;
    for (const [status, title] of [["EN_ROUTE", "Votre professionnel est en route"], ["IN_PROGRESS", "Votre intervention a commencé"], ["COMPLETED", "Votre intervention est terminée"]]) {
      const notification = once(receiver, "notification:new"), update = once(receiver, "intervention:updated"), message = once(receiver, "chat:message");
      await post(pro, "intervention.status", { requestId: request.id, status });
      const [notice] = await notification, [changed] = await update;
      const [received] = await message;
      assert.equal(received.text, title);
      assert.equal(received.senderId, pro.id);
      assert.equal(received.requestId, request.conversationId);
      assert.equal(notice.href, href); assert.ok(notice.title.startsWith(title)); assert.deepEqual(changed, { requestId: request.id, status });
      const stored = await prisma.clientNotification.findUniqueOrThrow({ where: { id: notice.id } }); assert.equal(stored.userId, client.id); assert.equal(stored.href, href);
      assert.equal(await prisma.chatMessage.count({ where: { requestId: request.conversationId } }), baseline + chatEvents);
      const storedMessage = await prisma.chatMessage.findUniqueOrThrow({ where: { id: received.id } });
      assert.equal(storedMessage.text, title);
      assert.ok(await prisma.requestEvent.findFirst({ where: { requestId: request.id, status, description: title } }));
      const data = await (await fetch(`${base}/api/client/interventions?demande=${request.id}`, { headers: client.headers })).json(); assert.equal(data.requests.find((r) => r.id === request.id).status, status);
    }
    assert.equal(chatEvents, 3); assert.equal(leakedEvents, 0);
    await post(pro, "intervention.status", { requestId: request.id, status: "COMPLETED" }, 400);
    const receipt = once(professional, "notification:new");
    await post(client, "intervention.confirm", { requestId: request.id });
    assert.equal((await receipt)[0].href, `/professionnel/interventions?demande=${request.id}#intervention-${request.id}`);
    assert.equal(await prisma.chatMessage.count({ where: { requestId: request.conversationId } }), baseline + 3);
    // An old intervention remains reachable even outside the first 100 records.
    await prisma.serviceRequest.createMany({ data: Array.from({ length: 101 }, (_, i) => ({ clientId: client.id, professionalId: pro.id, kind: "INTERVENTION", message: "Pagination fixture", status: "CANCELLED", updatedAt: new Date(Date.now() + 60000 + i) })) });
    const selected = await (await fetch(`${base}/api/client/interventions?demande=${request.id}`, { headers: client.headers })).json(); assert.ok(selected.requests.some((r) => r.id === request.id));
    const html = await (await fetch(base + href, { headers: client.headers })).text(); assert.ok(html.includes(`id="intervention-${request.id}"`)); assert.match(html, /class="ij-details" open/);
    const foreign = await (await fetch(`${base}/api/client/interventions?demande=${request.id}`, { headers: stranger.headers })).json(); assert.deepEqual(foreign.requests, []);
  } finally {
    sockets.forEach((socket) => socket.disconnect());
    await prisma.clientInvoice.deleteMany({ where: { quote: { request: { clientId: { in: ids } } } } });
    await prisma.serviceRequest.deleteMany({ where: { clientId: { in: ids } } });
    await prisma.availabilitySlot.deleteMany({ where: { professionalId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } }); await prisma.$disconnect();
  }
});
