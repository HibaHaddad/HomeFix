import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { SignJWT } from "jose";
import { io } from "socket.io-client";
import { prisma } from "../src/app/lib/prisma.ts";

const base = process.env.DIRECTORY_TEST_URL || "http://localhost:3000";
test("professional price offer, client confirmation in chat, immutable agreed price and confirmed intervention card", { timeout: 120000 }, async () => {
  const ids = []; let socket;
  async function user(role) {
    const user = await prisma.user.create({ data: { name: role === "CLIENT" ? "Price client fixture" : "Price professional fixture", email: `price-${crypto.randomUUID()}@example.invalid`, password: "not-a-login", role, status: role === "CLIENT" ? "ACTIVE" : "APPROVED", termsAccepted: true, ...(role === "PROFESSIONAL" ? { profilePhoto: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), profilePhotoMime: "image/png" } : {}) } }); ids.push(user.id);
    const token = await new SignJWT({ userId: user.id }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m").sign(new TextEncoder().encode(process.env.JWT_SECRET));
    return { ...user, headers: { Cookie: `session=${token}`, Origin: base } };
  }
  async function raw(actor, action, values = {}) {
    const response = await fetch(`${base}${actor.role === "CLIENT" ? "/api/client/espace" : "/api/interactions"}`, { method: "POST", headers: { ...actor.headers, "Content-Type": "application/json" }, body: JSON.stringify({ action, ...values }) });
    return { status: response.status, body: await response.json() };
  }
  async function post(actor, action, values = {}, status = 200) { const r = await raw(actor, action, values); assert.equal(r.status, status, `${action}: ${JSON.stringify(r.body)}`); return r.body; }
  try {
    const pro = await user("PROFESSIONAL"), client = await user("CLIENT"), stranger = await user("CLIENT"), otherPro = await user("PROFESSIONAL");
    assert.equal((await fetch(`${base}/api/client/interventions`)).status, 401);
    assert.equal((await fetch(`${base}/api/client/interventions`, { headers: pro.headers })).status, 401);
    await post(pro, "availability.save", { day: "2030-03-15", start: "09:00", end: "12:00" });
    const slots = await prisma.availabilitySlot.findMany({ where: { professionalId: pro.id, active: true }, orderBy: { startsAt: "asc" } });
    const request = await post(client, "request.create", { source: "PROFILE", professionalId: pro.id, slotId: slots[0].id, message: "Une fuite nécessite une intervention", address: "Adresse de test à Tunis" });
    const history = async () => (await (await fetch(`${base}/api/client/conversations/${request.conversationId}`, { headers: client.headers })).json()).messages;
    const page = async () => (await (await fetch(`${base}/dashboard/interventions`, { headers: client.headers })).text());
    assert.ok(!(await page()).includes('class="cx-panel cx-confirmed-intervention"'));
    await post(pro, "booking.confirm", { requestId: request.id, amount: "-1" }, 400);
    await post(otherPro, "booking.confirm", { requestId: request.id, amount: "80" }, 404);
    socket = io(base, { autoConnect: false, reconnection: false, transports: ["websocket"], extraHeaders: client.headers });
    const connect = once(socket, "connect"); socket.connect(); await connect;
    const offered = once(socket, "chat:message");
    const offer = await post(pro, "booking.confirm", { requestId: request.id, amount: "80.501" });
    const [message] = await offered;
    assert.equal(message.quote.id, offer.quoteId); assert.equal(message.quote.amountMillimes, 80501); assert.equal(message.quote.status, "PENDING"); assert.equal(message.quote.request.booking.status, "ACCEPTED");
    assert.match(message.text, /Prix proposé/);
    assert.equal((await prisma.serviceRequest.findUniqueOrThrow({ where: { id: request.id } })).status, "QUOTED");
    assert.equal((await prisma.booking.findUniqueOrThrow({ where: { requestId: request.id } })).status, "ACCEPTED");
    assert.ok(!(await page()).includes('class="cx-panel cx-confirmed-intervention"'), "no intervention before client consent");
    assert.equal((await history()).find((m) => m.id === message.id).quote.amountMillimes, 80501);
    await post(stranger, "quote.accept", { requestId: request.id, quoteId: offer.quoteId }, 404);
    const updated = once(socket, "chat:message-updated");
    await post(pro, "booking.confirm", { requestId: request.id, amount: "90.001" });
    assert.equal((await updated)[0].quote.status, "SUPERSEDED");
    await post(client, "quote.accept", { requestId: request.id, quoteId: offer.quoteId }, 409);
    const current = (await history()).find((m) => m.quote?.status === "PENDING");
    const acceptedEvent = once(socket, "chat:message-updated");
    const results = await Promise.all([raw(client, "quote.accept", { requestId: request.id, quoteId: current.quote.id, amount: "1" }), raw(client, "quote.accept", { requestId: request.id, quoteId: current.quote.id })]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    // Multiple older offer cards can be refreshed; inspect canonical database state too.
    await acceptedEvent;
    const agreed = await prisma.quote.findUniqueOrThrow({ where: { id: current.quote.id } }); assert.equal(agreed.status, "ACCEPTED"); assert.equal(agreed.amountMillimes, 90001);
    assert.equal((await prisma.booking.findUniqueOrThrow({ where: { requestId: request.id } })).status, "CONFIRMED");
    assert.equal((await prisma.serviceRequest.findUniqueOrThrow({ where: { id: request.id } })).status, "BOOKED");
    assert.equal(await prisma.clientInvoice.count({ where: { quoteId: agreed.id } }), 1);
    const confirmed = (await history()).find((m) => m.quote?.id === agreed.id); assert.equal(confirmed.quote.status, "ACCEPTED"); assert.equal(confirmed.quote.request.booking.status, "CONFIRMED");
    const html = await page(); assert.match(html, /cx-confirmed-intervention/); assert.match(html, /Price professional fixture/); assert.match(html, /prix confirmé/i); assert.match(html, new RegExp(`/api/client/professionnels/${pro.id}/photo`));
    const trackingResponse = await fetch(`${base}/api/client/interventions`, { headers: client.headers });
    assert.match(trackingResponse.headers.get("cache-control"), /no-store/);
    const tracking = await trackingResponse.json();
    assert.equal(tracking.requests.find((r) => r.id === request.id).status, "BOOKED");
    assert.deepEqual((await (await fetch(`${base}/api/client/interventions`, { headers: stranger.headers })).json()).requests, []);
    assert.equal((await fetch(`${base}/api/client/professionnels/${pro.id}/photo`, { headers: client.headers })).status, 200);
    await post(pro, "booking.confirm", { requestId: request.id, amount: "1" }, 409);
  } finally {
    socket?.disconnect();
    await prisma.clientInvoice.deleteMany({ where: { quote: { request: { clientId: { in: ids } } } } });
    await prisma.serviceRequest.deleteMany({ where: { clientId: { in: ids } } });
    await prisma.availabilitySlot.deleteMany({ where: { professionalId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } }); await prisma.$disconnect();
  }
});
