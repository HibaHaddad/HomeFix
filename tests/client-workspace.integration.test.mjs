// Isolated fixtures in the configured development PostgreSQL; cleaned in finally.
// Start the app, then run with dotenv/config and tests/helpers/register-ts.mjs.
import assert from "node:assert/strict";
import { test } from "node:test";
import { SignJWT } from "jose";
import { prisma } from "../src/app/lib/prisma.ts";
const base = process.env.DIRECTORY_TEST_URL || "http://localhost:3000";
test("professional-led requests: real slots, free chat, both approvals, alternatives, concurrent conflicts and private data", async () => {
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`, ids = [];
  async function user(role) {
    const u = await prisma.user.create({ data: { name: "HomeFix integration fixture", email: `workspace-${stamp}-${ids.length}@example.invalid`, password: "not-a-login-password", role, status: role === "PROFESSIONAL" ? "APPROVED" : "ACTIVE", termsAccepted: true } });
    ids.push(u.id);
    const token = await new SignJWT({ userId: u.id }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m").sign(new TextEncoder().encode(process.env.JWT_SECRET));
    return { id: u.id, role, headers: { Cookie: `session=${token}` } };
  }
  async function raw(actor, action, data = {}) {
    const path = actor.role === "PROFESSIONAL" ? "/api/interactions" : "/api/client/espace";
    const r = await fetch(base + path, { method: "POST", headers: { ...actor.headers, "Content-Type": "application/json" }, body: JSON.stringify({ action, ...data }) });
    return { status: r.status, body: await r.json() };
  }
  async function post(actor, action, data = {}, expected = 200) { const r = await raw(actor, action, data); assert.equal(r.status, expected, `${action}: ${JSON.stringify(r.body)}`); return r.body; }
  try {
    const client = await user("CLIENT"), stranger = await user("CLIENT"), professional = await user("PROFESSIONAL"), other = await user("PROFESSIONAL");
    const availabilityUrl = `${base}/api/client/professionnels/${professional.id}/disponibilites?month=2030-01`;
    const availability = async () => (await (await fetch(availabilityUrl, { headers: client.headers })).json()).slots;
    assert.equal((await fetch(base + "/api/client/espace", { method: "POST", body: "{}" })).status, 401);
    assert.equal((await fetch(availabilityUrl)).status, 401);
    assert.deepEqual(await availability(), []);
    const foreign = await fetch(base + "/api/client/espace", { method: "POST", headers: { ...client.headers, Origin: "https://foreign.example", "Content-Type": "application/json" }, body: "{}" });
    assert.equal(foreign.status, 403);
    const slot = async (start, end) => (await post(professional, "availability.create", { startsAt: `2030-01-15T${start}`, endsAt: `2030-01-15T${end}` })).id;
    const s1 = await slot("10:00", "11:00"), s2 = await slot("12:00", "13:00"), s3 = await slot("14:00", "15:00"), s4 = await slot("16:00", "17:00");
    await post(professional, "availability.create", { startsAt: "2030-01-15T10:30", endsAt: "2030-01-15T11:30" }, 409);
    await post(client, "availability.create", { startsAt: "2030-01-15T18:00", endsAt: "2030-01-15T19:00" }, 403);
    assert.equal((await availability()).length, 4);
    assert.deepEqual(Object.keys((await availability())[0]).sort(), ["endsAt", "id", "startsAt"]);
    const thread = await post(client, "conversation.open", { professionalId: professional.id });
    assert.equal((await post(client, "conversation.open", { professionalId: professional.id })).id, thread.id);
    assert.equal(await prisma.serviceRequest.count({ where: { clientId: client.id, kind: { not: "MESSAGE" } } }), 0);
    const freePage = await (await fetch(base + "/dashboard/demandes", { headers: client.headers })).text();
    assert.match(freePage, /Aucune demande pour le moment/);
    assert.ok(!freePage.includes("Décrivez votre besoin"));
    await post(client, "message.send", { requestId: thread.id, text: "Bonjour !" });
    await post(professional, "message.send", { requestId: thread.id, text: "Bonjour, comment puis-je vous aider ?" });
    const create = (actor, slotId, extra = {}) => post(actor, "request.create", { source: "PROFILE", message: "Une fuite persiste sous l’évier depuis ce matin.", address: "Adresse de test à Tunis", professionalId: professional.id, slotId, ...extra });
    await post(client, "request.create", { source: "PROFILE", slotId: s1, message: "Une fuite sous mon évier", address: "Tunis centre" }, 400);
    await post(client, "request.create", { professionalId: professional.id, slotId: s1, message: "Une fuite sous mon évier", address: "Tunis centre" }, 400);
    const a = await create(client, s1);
    assert.equal(a.conversationId, thread.id);
    await post(client, "request.create", { source: "PROFILE", professionalId: professional.id, slotId: s1, message: "Une autre fuite de test", address: "Tunis centre" }, 409);
    await post(stranger, "request.cancel", { requestId: a.id }, 404);
    await post(other, "booking.confirm", { requestId: a.id }, 404);
    await post(client, "quote.propose", { requestId: a.id }, 403);
    await post(professional, "booking.confirm", { requestId: a.id });
    assert.equal((await prisma.booking.findUniqueOrThrow({ where: { requestId: a.id } })).status, "ACCEPTED");
    assert.equal((await prisma.serviceRequest.findUniqueOrThrow({ where: { id: a.id } })).status, "SENT");
    assert.ok(!(await availability()).some((s) => s.id === s1));
    await post(professional, "quote.propose", { requestId: a.id, amount: "125.501", details: "Main-d’œuvre et pièces de remplacement", validUntil: "2030-01-01T12:00:00Z" });
    let q = await prisma.quote.findFirstOrThrow({ where: { requestId: a.id }, orderBy: { id: "desc" } });
    await post(client, "quote.counter", { requestId: a.id, quoteId: q.id, amount: "100" });
    await post(client, "quote.accept", { requestId: a.id, quoteId: q.id }, 409);
    await post(professional, "quote.propose", { requestId: a.id, amount: "110.001", details: "Prix révisé suite à votre proposition", validUntil: "2030-01-01T12:00:00Z" });
    q = await prisma.quote.findFirstOrThrow({ where: { requestId: a.id }, orderBy: { id: "desc" } });
    await post(client, "quote.accept", { requestId: a.id, quoteId: q.id });
    assert.equal((await prisma.booking.findUniqueOrThrow({ where: { requestId: a.id } })).status, "CONFIRMED");
    assert.equal((await prisma.serviceRequest.findUniqueOrThrow({ where: { id: a.id } })).status, "BOOKED");
    await post(client, "quote.accept", { requestId: a.id, quoteId: q.id }, 409);
    const invoice = await prisma.clientInvoice.findUniqueOrThrow({ where: { quoteId: q.id } });
    assert.equal(invoice.depositMillimes, 55001); assert.equal(invoice.paidMillimes, 0);
    const c = await create(client, s2, { source: "CHAT", conversationId: thread.id });
    await post(professional, "booking.counter", { requestId: c.id, slotId: s3 });
    await post(professional, "quote.propose", { requestId: c.id, amount: "120", details: "Un autre devis pour le second projet", validUntil: "2030-01-01T12:00:00Z" });
    q = await prisma.quote.findFirstOrThrow({ where: { requestId: c.id } });
    await post(client, "quote.accept", { requestId: c.id, quoteId: q.id });
    assert.equal((await prisma.booking.findUniqueOrThrow({ where: { requestId: c.id } })).status, "COUNTER_PROPOSED");
    await post(client, "booking.accept", { requestId: c.id });
    assert.equal((await prisma.booking.findUniqueOrThrow({ where: { requestId: c.id } })).status, "CONFIRMED");
    const concurrent = await Promise.all([client, stranger].map((actor) => raw(actor, "request.create", { source: "PROFILE", message: "Demande simultanée pour le créneau", address: "Adresse de test à Tunis", professionalId: professional.id, slotId: s4 })));
    assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
    const winner = concurrent.find((r) => r.status === 200).body;
    await post(professional, "booking.confirm", { requestId: winner.id });
    assert.equal(await prisma.booking.count({ where: { slotId: s4, status: "ACCEPTED" } }), 1);
    await post(professional, "availability.remove", { slotId: s1 }, 409);
    await post(client, "message.send", { requestId: thread.id, text: "Voici la position exacte", latitude: 36.8065, longitude: 10.1815 });
    const chat = await (await fetch(`${base}/api/client/conversations/${thread.id}`, { headers: professional.headers })).json();
    assert.ok(chat.messages.some((m) => m.latitude === 36.8065));
    assert.ok(chat.interventions.some((r) => r.id === a.id && r.quotes.some((q) => q.status === "ACCEPTED")));
    assert.equal((await fetch(`${base}/api/client/conversations/${thread.id}`, { headers: stranger.headers })).status, 404);
    const form = new FormData(); form.set("requestId", String(a.id)); form.set("file", new Blob(["%PDF-1.4\nfixture\n%%EOF"], { type: "application/pdf" }), "fixture.pdf");
    const upload = await fetch(`${base}/api/client/fichiers`, { method: "POST", headers: client.headers, body: form });
    assert.equal(upload.status, 201); const attachment = await upload.json();
    assert.equal((await fetch(`${base}/api/client/fichiers/${attachment.id}`, { headers: stranger.headers })).status, 404);
    assert.equal((await fetch(`${base}/api/client/fichiers/${attachment.id}`, { headers: professional.headers })).status, 200);
    form.set("chat", "true");
    form.set("nonce", crypto.randomUUID());
    const chatUpload = await fetch(`${base}/api/client/fichiers`, { method: "POST", headers: client.headers, body: form });
    assert.equal(chatUpload.status, 201);
    const chatFile = await chatUpload.json();
    const refreshedChat = await (await fetch(`${base}/api/client/conversations/${thread.id}`, { headers: professional.headers })).json();
    assert.ok(refreshedChat.messages.some((m) => m.attachments.some((f) => f.id === chatFile.id)), "an attachment sent from an intervention appears in its parent conversation");
    for (const status of ["EN_ROUTE", "IN_PROGRESS", "COMPLETED"]) await post(professional, "intervention.status", { requestId: a.id, status });
    await post(client, "review.create", { requestId: a.id, quality: 5, punctuality: 4, communication: 5, priceRespect: 5 }, 409);
    await post(client, "intervention.confirm", { requestId: a.id });
    await post(client, "review.create", { requestId: a.id, rating: 5 }, 409);
    assert.equal(await prisma.professionalReview.count({ where: { requestId: a.id } }), 0, "Confirming completion alone must not unlock a review before payment");
    for (const path of ["", "demandes", "messagerie", "devis", "reservations", "interventions", "paiements", "avis", "logement", "favoris", "assistant", "notifications", "profil", "reclamations"]) {
      assert.equal((await fetch(`${base}/dashboard${path ? `/${path}` : ""}`, { headers: client.headers })).status, 200, `client ${path}`);
    }
    for (const path of ["tableau-de-bord", "demandes", "messagerie", "reservations", "interventions"]) assert.equal((await fetch(`${base}/professionnel/${path}`, { headers: professional.headers })).status, 200, `professional ${path}`);
  } finally {
    await prisma.complaint.deleteMany({ where: { clientId: { in: ids } } });
    await prisma.professionalReview.deleteMany({ where: { clientId: { in: ids } } });
    await prisma.clientInvoice.deleteMany({ where: { quote: { request: { clientId: { in: ids } } } } });
    await prisma.serviceRequest.deleteMany({ where: { clientId: { in: ids } } });
    await prisma.availabilitySlot.deleteMany({ where: { professionalId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
});
