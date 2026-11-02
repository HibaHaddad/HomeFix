import assert from "node:assert/strict";
import { test } from "node:test";
import { SignJWT } from "jose";
import { prisma } from "../src/app/lib/prisma.ts";
import { io } from "socket.io-client";
import { once } from "node:events";

const base = process.env.DIRECTORY_TEST_URL || "http://localhost:3000";
test("hourly agenda: pending holds, simultaneous requests, schedule edits, confirmations and legacy bookings", { timeout: 120000 }, async () => {
  const ids = []; let clientSocket;
  async function user(role) {
    const u = await prisma.user.create({ data: { name: "Agenda fixture", email: `agenda-${crypto.randomUUID()}@example.invalid`, password: "not-a-login", role, status: role === "CLIENT" ? "ACTIVE" : "APPROVED", termsAccepted: true } }); ids.push(u.id);
    const token = await new SignJWT({ userId: u.id }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m").sign(new TextEncoder().encode(process.env.JWT_SECRET));
    return { ...u, headers: { Cookie: `session=${token}`, Origin: base } };
  }
  async function post(actor, action, data = {}, status = 200) {
    const response = await fetch(`${base}${actor.role === "CLIENT" ? "/api/client/espace" : "/api/interactions"}`, { method: "POST", headers: { ...actor.headers, "Content-Type": "application/json" }, body: JSON.stringify({ action, ...data }) });
    const value = await response.json(); assert.equal(response.status, status, `${action}: ${JSON.stringify(value)}`); return value;
  }
  try {
    const pro = await user("PROFESSIONAL"), a = await user("CLIENT"), b = await user("CLIENT");
    const clientSlots = async () => (await (await fetch(`${base}/api/client/professionnels/${pro.id}/disponibilites?month=2030-02`, { headers: a.headers })).json()).slots;
    const agenda = async () => (await (await fetch(`${base}/api/interactions?month=2030-02`, { headers: pro.headers })).json());
    const save = (start, end, day = "2030-02-20") => post(pro, "availability.save", { day, start, end });
    const request = (slotId) => ({ source: "PROFILE", professionalId: pro.id, slotId, message: "Un problème de plomberie à examiner", address: "Adresse de test à Tunis" });
    await post(a, "availability.save", { day: "2030-02-20", start: "09:00", end: "17:00" }, 403);
    await post(pro, "availability.save", { day: "2030-02-30", start: "09:00", end: "17:00" }, 400);
    await post(pro, "availability.save", { day: "2030-02-20", start: "09:00", end: "09:30" }, 400);
    await save("09:00", "17:00");
    const slots = await clientSlots(); assert.equal(slots.length, 8);
    assert.equal((await agenda()).slots.length, 8);
    assert.ok(slots.every((s) => +new Date(s.endsAt) - +new Date(s.startsAt) === 3600000));
    const race = await Promise.all([a, b].map(async (actor) => {
      const r = await fetch(`${base}/api/client/espace`, { method: "POST", headers: { ...actor.headers, "Content-Type": "application/json" }, body: JSON.stringify({ action: "request.create", ...request(slots[0].id) }) });
      return { status: r.status, value: await r.json(), actor };
    }));
    assert.deepEqual(race.map((r) => r.status).sort(), [200, 409]);
    const winner = race.find((r) => r.status === 200), other = race.find((r) => r.status === 409).actor;
    assert.ok(!(await clientSlots()).some((s) => s.id === slots[0].id), "pending requests immediately hide the slot");
    const second = await post(other, "request.create", request(slots[1].id));
    await post(pro, "quote.propose", { requestId: winner.value.id, amount: "90", details: "Intervention de plomberie", validUntil: "2030-02-01T12:00:00Z" });
    const quote = await prisma.quote.findFirstOrThrow({ where: { requestId: winner.value.id } });
    await post(winner.actor, "quote.accept", { requestId: winner.value.id, quoteId: quote.id });
    assert.equal((await prisma.booking.findUniqueOrThrow({ where: { requestId: winner.value.id } })).status, "PROPOSED");
    clientSocket = io(base, { autoConnect: false, reconnection: false, transports: ["websocket"], extraHeaders: winner.actor.headers });
    const connected = once(clientSocket, "connect"); clientSocket.connect(); await connected;
    const confirmationMessage = once(clientSocket, "chat:message");
    const result = await post(pro, "booking.confirm", { requestId: winner.value.id });
    assert.equal(result.bookingStatus, "CONFIRMED");
    const [received] = await confirmationMessage;
    assert.match(received.text, /Votre rendez-vous est confirmé/);
    assert.ok(received.text.includes("2030"));
    assert.equal(received.senderId, pro.id);
    assert.equal(received.requestId, winner.value.conversationId);
    const messageCount = await prisma.chatMessage.count({ where: { requestId: winner.value.conversationId } });
    await post(pro, "booking.confirm", { requestId: winner.value.id }, 409);
    assert.equal(await prisma.chatMessage.count({ where: { requestId: winner.value.conversationId } }), messageCount, "repeated confirmation never sends a duplicate message");
    assert.ok(await prisma.clientNotification.findFirst({ where: { userId: winner.actor.id, title: { contains: "Votre rendez-vous est confirmé" } } }));
    const before = await prisma.booking.findUniqueOrThrow({ where: { requestId: winner.value.id } }); assert.equal(before.status, "CONFIRMED");
    await save("12:00", "18:00");
    const after = await prisma.booking.findUniqueOrThrow({ where: { requestId: winner.value.id } });
    assert.equal(+after.startsAt, +before.startsAt); assert.equal(+after.endsAt, +before.endsAt); assert.equal(after.slotId, before.slotId); assert.equal(after.status, "CONFIRMED");
    assert.equal((await clientSlots()).length, 6);
    const accepted = await post(pro, "booking.confirm", { requestId: second.id });
    assert.equal(accepted.bookingStatus, "ACCEPTED");
    assert.ok(await prisma.chatMessage.findFirst({ where: { requestId: second.conversationId, text: { startsWith: "Votre créneau est accepté :", not: { contains: "accord sur le devis" } } } }));
    assert.equal((await prisma.booking.findUniqueOrThrow({ where: { requestId: second.id } })).status, "ACCEPTED", "retired slots can still confirm their existing booking");
    await post(a, "request.create", request(slots[2].id), 409);
    const month = await agenda(); assert.equal(month.appointments.length, 2); assert.ok(month.appointments.every((x) => x.request.client.name));
    const currentSlots = await clientSlots();
    const pending = await post(a, "request.create", request(currentSlots[0].id));
    assert.equal((await clientSlots()).length, 5);
    await post(a, "booking.cancel", { requestId: pending.id, reason: "Indisponibilité du client" });
    assert.equal((await clientSlots()).length, 6, "cancellation releases the hour");
    const rejected = await post(b, "request.create", request(currentSlots[1].id));
    await post(pro, "booking.reject", { requestId: rejected.id, reason: "Intervention non réalisable" });
    assert.equal((await clientSlots()).length, 6, "rejection releases the hour");
    // Database enforcement also rejects inserts that bypass all application checks.
    await assert.rejects(() => prisma.serviceRequest.create({ data: { clientId: other.id, professionalId: pro.id, kind: "INTERVENTION", message: "Direct overlapping fixture", booking: { create: { professionalId: pro.id, startsAt: new Date(+before.startsAt + 1800000), endsAt: new Date(+before.endsAt + 1800000), status: "PROPOSED" } } } }));
    // A legacy multi-hour proposal references a retired range and is never resized.
    const legacySlot = await prisma.availabilitySlot.create({ data: { professionalId: pro.id, startsAt: new Date("2030-02-21T18:00:00Z"), endsAt: new Date("2030-02-21T20:00:00Z"), active: false } });
    const legacy = await prisma.serviceRequest.create({ data: { clientId: a.id, professionalId: pro.id, kind: "INTERVENTION", message: "Legacy two-hour reservation", booking: { create: { professionalId: pro.id, slotId: legacySlot.id, startsAt: legacySlot.startsAt, endsAt: legacySlot.endsAt, holdsSlot: false, status: "PROPOSED" } } } });
    await save("09:00", "12:00", "2030-02-21");
    await post(pro, "booking.confirm", { requestId: legacy.id });
    const retained = await prisma.booking.findUniqueOrThrow({ where: { requestId: legacy.id } }); assert.equal(+retained.endsAt - +retained.startsAt, 7200000); assert.equal(retained.status, "ACCEPTED");
    assert.equal((await fetch(`${base}/api/interactions?month=2030-02`, { headers: a.headers })).status, 401);
    assert.equal((await fetch(`${base}/api/interactions?month=bad`, { headers: pro.headers })).status, 400);
  } finally {
    clientSocket?.disconnect();
    await prisma.clientInvoice.deleteMany({ where: { quote: { request: { clientId: { in: ids } } } } });
    await prisma.serviceRequest.deleteMany({ where: { clientId: { in: ids } } });
    await prisma.availabilitySlot.deleteMany({ where: { professionalId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } }); await prisma.$disconnect();
  }
});
