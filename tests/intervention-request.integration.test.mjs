import assert from "node:assert/strict";
import { test } from "node:test";
import { SignJWT } from "jose";
import { prisma } from "../src/app/lib/prisma.ts";
const base = process.env.DIRECTORY_TEST_URL || "http://localhost:3000";

test("required booking slot, multiple daily availability ranges, delivery and photos", { timeout: 120000 }, async () => {
  const marker = `Request QA ${crypto.randomUUID()}`, users = [];
  let category;
  async function account(role) {
    const user = await prisma.user.create({ data: { name: marker, email: `${crypto.randomUUID()}@example.invalid`, password: "fixture", role, status: role === "PROFESSIONAL" ? "APPROVED" : "ACTIVE", isPublic: true, termsAccepted: true, specialty: role === "PROFESSIONAL" ? category.name : null, notificationEnabled: role === "PROFESSIONAL" } });
    users.push(user.id);
    const token = await new SignJWT({ userId: user.id }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("10m").sign(new TextEncoder().encode(process.env.JWT_SECRET));
    return { ...user, headers: { Cookie: `session=${token}`, Origin: base } };
  }
  async function action(actor, action, body = {}, expected = 200) {
    const response = await fetch(base + (actor.role === "PROFESSIONAL" ? "/api/interactions" : "/api/client/espace"), { method: "POST", headers: { ...actor.headers, "Content-Type": "application/json" }, body: JSON.stringify({ action, ...body }) });
    const result = await response.json(); assert.equal(response.status, expected, JSON.stringify(result)); return result;
  }
  try {
    category = await prisma.serviceCategory.create({ data: { name: marker, normalizedName: marker.toLowerCase(), icon: "wrench", isActive: true } });
    const client = await account("CLIENT"), pro = await account("PROFESSIONAL"), stranger = await account("CLIENT");
    const input = { source: "PROFILE", professionalId: pro.id, message: "Le climatiseur ne fonctionne plus depuis hier.", address: "42 rue de test, Nabeul" };
    assert.equal(await prisma.availabilitySlot.count({ where: { professionalId: pro.id } }), 0);
    await action(client, "request.create", input, 400);
    await action(client, "request.create", { ...input, slotId: null }, 400);
    assert.equal(await prisma.serviceRequest.count({ where: { clientId: client.id, kind: "INTERVENTION" } }), 0);
    await action(client, "availability.add", { day: "2030-05-20", start: "09:00", end: "10:00" }, 403);
    await action(pro, "availability.add", { day: "2030-05-20", start: "09:00", end: "10:00" });
    await action(pro, "availability.add", { day: "2030-05-20", start: "20:30", end: "21:30" });
    const agendaResponse = await fetch(base + "/api/interactions?month=2030-05", { headers: pro.headers });
    const agenda = await agendaResponse.json();
    assert.equal(agenda.slots.length, 2);
    assert.ok(Number.isFinite(Date.parse(agenda.serverNow)));
    const [morning, evening] = agenda.slots;
    assert.equal(evening.startsAt, "2030-05-20T19:30:00.000Z");
    assert.equal(evening.endsAt, "2030-05-20T20:30:00.000Z");
    await action(pro, "availability.add", { day: "2030-05-20", start: "20:30", end: "21:30" }, 409);
    await action(pro, "availability.add", { day: "2030-05-20", start: "20:45", end: "21:45" }, 409);
    assert.equal(await prisma.availabilitySlot.count({ where: { professionalId: pro.id, active: true } }), 2);
    const created = await action(client, "request.create", { ...input, slotId: morning.id });
    const request = await prisma.serviceRequest.findUniqueOrThrow({ where: { id: created.id }, include: { booking: true } });
    assert.equal(request.kind, "INTERVENTION"); assert.equal(request.status, "SENT"); assert.equal(request.booking.slotId, morning.id); assert.equal(request.booking.status, "PROPOSED");
    assert.equal(request.professionalId, pro.id); assert.equal(request.categoryId, category.id); assert.equal(request.address, input.address);
    assert.equal(request.conversationId, created.conversationId);
    assert.equal(await prisma.clientNotification.count({ where: { userId: pro.id, type: "REQUEST_SENT" } }), 1);
    const received = await fetch(`${base}/api/interactions`, { headers: pro.headers });
    assert.equal(received.status, 200);
    assert.ok((await received.json()).requests.some(row => row.id === created.id));
    const form = new FormData(); form.set("requestId", String(created.id));
    form.set("file", new Blob([new Uint8Array([255,216,255,224,0,16,74,70,73,70])], { type: "image/jpeg" }), "climatiseur.jpeg");
    const upload = await fetch(`${base}/api/client/fichiers`, { method: "POST", headers: client.headers, body: form });
    assert.equal(upload.status, 201); const file = await upload.json();
    assert.equal((await fetch(`${base}/api/client/fichiers/${file.id}`, { headers: pro.headers })).status, 200);
    assert.equal((await fetch(`${base}/api/client/fichiers/${file.id}`, { headers: stranger.headers })).status, 404);
    await action(stranger, "request.cancel", { requestId: created.id }, 404);
    await action(client, "request.create", { ...input, slotId: "invalid" }, 400);
    await action(client, "request.create", { ...input, slotId: 2147483647 }, 409);
    const slot = evening;
    await action(pro, "booking.counter", { requestId: created.id, slotId: slot.id });
    await action(client, "booking.accept", { requestId: created.id });
    await action(pro, "booking.confirm", { requestId: created.id, amount: "80.501" });
    const quote = await prisma.quote.findFirstOrThrow({ where: { requestId: created.id, status: "PENDING" } });
    await action(client, "quote.accept", { requestId: created.id, quoteId: quote.id });
    assert.equal((await prisma.serviceRequest.findUniqueOrThrow({ where: { id: created.id } })).status, "BOOKED");
    assert.equal((await prisma.booking.findUniqueOrThrow({ where: { requestId: created.id } })).status, "CONFIRMED");
    await action(client, "request.create", { ...input, source: "CHAT", conversationId: created.conversationId, slotId: null }, 400);
    const noSlot = await action(client, "request.create", { ...input, source: "CHAT", conversationId: created.conversationId, slotId: morning.id });
    await action(pro, "booking.reject", { requestId: noSlot.id, reason: "Indisponible cette semaine" });
    assert.equal((await prisma.serviceRequest.findUniqueOrThrow({ where: { id: noSlot.id } })).status, "REJECTED");
    assert.equal((await prisma.booking.findUniqueOrThrow({ where: { requestId: noSlot.id } })).status, "REJECTED");
    const anotherSlot = await prisma.availabilitySlot.create({ data: { professionalId: pro.id, startsAt: new Date("2030-05-21T09:00:00Z"), endsAt: new Date("2030-05-21T10:00:00Z") } });
    const scheduled = await action(client, "request.create", { ...input, slotId: anotherSlot.id });
    assert.equal((await prisma.booking.findUniqueOrThrow({ where: { requestId: scheduled.id } })).status, "PROPOSED");
    // The published hour keeps its original bounds; only its remaining time is
    // bookable. Creating it fifteen minutes ago must not hide or expire it.
    const clock = Date.now();
    const current = await prisma.availabilitySlot.create({ data: { professionalId: pro.id, startsAt: new Date(clock - 15 * 60000), endsAt: new Date(clock + 45 * 60000) } });
    const expired = await prisma.availabilitySlot.create({ data: { professionalId: pro.id, startsAt: new Date(clock - 120 * 60000), endsAt: new Date(clock - 60 * 60000) } });
    const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Tunis", year: "numeric", month: "2-digit" }).format(new Date(clock));
    const listCurrent = async () => {
      const response = await fetch(`${base}/api/client/professionnels/${pro.id}/disponibilites?month=${month}`, { headers: client.headers });
      assert.equal(response.status, 200); return (await response.json()).slots;
    };
    let remaining = await listCurrent();
    assert.ok(remaining.some(slot => slot.id === current.id), "ongoing slots remain visible");
    assert.ok(!remaining.some(slot => slot.id === expired.id), "finished slots remain hidden");
    await action(client, "request.create", { ...input, slotId: expired.id }, 409);
    const immediate = await action(client, "request.create", { ...input, slotId: current.id });
    const immediateBooking = await prisma.booking.findUniqueOrThrow({ where: { requestId: immediate.id } });
    assert.equal(+immediateBooking.startsAt, +current.startsAt);
    assert.equal(+immediateBooking.endsAt, +current.endsAt);
    remaining = await listCurrent();
    assert.ok(!remaining.some(slot => slot.id === current.id), "a pending booking still blocks the ongoing slot");
    await action(stranger, "request.create", { ...input, slotId: current.id }, 409);
    await action(pro, "booking.confirm", { requestId: immediate.id, amount: "60" });
    const immediateQuote = await prisma.quote.findFirstOrThrow({ where: { requestId: immediate.id, status: "PENDING" } });
    assert.equal(+immediateQuote.validUntil, +current.endsAt, "a new quote for an ongoing hour remains confirmable until its end");
    await action(client, "quote.accept", { requestId: immediate.id, quoteId: immediateQuote.id });
    assert.equal((await prisma.serviceRequest.findUniqueOrThrow({ where: { id: immediate.id } })).status, "BOOKED");
    assert.equal((await prisma.booking.findUniqueOrThrow({ where: { requestId: immediate.id } })).status, "CONFIRMED");
  } finally {
    await prisma.clientNotification.deleteMany({ where: { userId: { in: users } } });
    await prisma.clientInvoice.deleteMany({ where: { quote: { request: { clientId: { in: users } } } } });
    await prisma.serviceRequest.deleteMany({ where: { clientId: { in: users }, conversationId: { not: null } } });
    await prisma.serviceRequest.deleteMany({ where: { clientId: { in: users } } });
    await prisma.availabilitySlot.deleteMany({ where: { professionalId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    if (category) await prisma.serviceCategory.delete({ where: { id: category.id } });
    await prisma.$disconnect();
  }
});
