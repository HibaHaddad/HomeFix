// Uses isolated test accounts in the configured development PostgreSQL and removes them in finally.
// Start the app, then: node --import dotenv/config --import ./tests/helpers/register-ts.mjs --test tests/client-workspace.integration.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { SignJWT } from "jose";
import { prisma } from "../src/app/lib/prisma.ts";
const base = process.env.DIRECTORY_TEST_URL || "http://localhost:3000";
test("client workspace: ownership, negotiation, booking conflicts, chat/GPS, private files, completion and reviews", async () => {
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const ids = [];
  async function user(role) {
    const u = await prisma.user.create({ data: { name: "HomeFix integration fixture", email: `workspace-${stamp}-${ids.length}@example.invalid`, password: "not-a-login-password", role, status: role === "PROFESSIONAL" ? "APPROVED" : "ACTIVE", termsAccepted: true } });
    ids.push(u.id);
    const token = await new SignJWT({ userId: u.id }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m").sign(new TextEncoder().encode(process.env.JWT_SECRET));
    return { id: u.id, headers: { Cookie: `session=${token}` } };
  }
  async function post(actor, action, data = {}, expected = 200) {
    const path = actor.role === "PROFESSIONAL" ? "/api/interactions" : "/api/client/espace";
    const r = await fetch(base + path, { method: "POST", headers: { ...actor.headers, "Content-Type": "application/json" }, body: JSON.stringify({ action, ...data }) });
    const result = await r.json();
    assert.equal(r.status, expected, `${action}: ${JSON.stringify(result)}`);
    return result;
  }
  try {
    const client = await user("CLIENT"), stranger = await user("CLIENT"), professional = { ...await user("PROFESSIONAL"), role: "PROFESSIONAL" };
    assert.equal((await fetch(base + "/api/client/espace", { method: "POST", body: "{}" })).status, 401);
    const foreign = await fetch(base + "/api/client/espace", { method: "POST", headers: { ...client.headers, Origin: "https://foreign.example", "Content-Type": "application/json" }, body: "{}" });
    assert.equal(foreign.status, 403);
    const create = () => post(client, "request.create", { title: "Fuite sous l’évier de test", message: "Une fuite persiste sous l’évier depuis ce matin.", category: "Plomberie", urgency: "NORMAL", address: "Adresse de test à Tunis", professionalId: professional.id });
    const { id: requestId } = await create();
    await post(stranger, "request.cancel", { requestId }, 404);
    await post(client, "quote.propose", { requestId }, 403);
    await post(client, "booking.propose", { requestId, startsAt: "2030-01-15T10:00", endsAt: "2030-01-15T11:00" }, 409);
    await post(professional, "quote.propose", { requestId, amount: "125.501", details: "Main-d’œuvre et pièces de remplacement", validUntil: "2030-01-01T12:00:00Z" });
    let quote = await prisma.quote.findFirstOrThrow({ where: { requestId }, orderBy: { id: "desc" } });
    await post(client, "quote.counter", { requestId, quoteId: quote.id, amount: "100" });
    await post(client, "quote.accept", { requestId, quoteId: quote.id }, 409);
    await post(professional, "quote.propose", { requestId, amount: "110.001", details: "Prix révisé suite à votre proposition", validUntil: "2030-01-01T12:00:00Z" });
    quote = await prisma.quote.findFirstOrThrow({ where: { requestId }, orderBy: { id: "desc" } });
    await post(client, "quote.accept", { requestId, quoteId: quote.id });
    await post(client, "quote.accept", { requestId, quoteId: quote.id }, 409);
    const invoice = await prisma.clientInvoice.findUniqueOrThrow({ where: { quoteId: quote.id } });
    assert.equal(invoice.depositMillimes, 55001); assert.equal(invoice.paidMillimes, 0);
    const forbiddenInvoice = await fetch(`${base}/dashboard/factures/${invoice.id}`, { headers: stranger.headers });
    assert.ok(!(await forbiddenInvoice.text()).includes(`FACTURE HF-${String(invoice.id).padStart(6, "0")}`));
    await post(client, "booking.propose", { requestId, startsAt: "2030-01-15T10:00", endsAt: "2030-01-15T11:00" });
    let booking = await prisma.booking.findUniqueOrThrow({ where: { requestId } });
    assert.equal(booking.status, "PROPOSED"); assert.equal(booking.startsAt.toISOString(), "2030-01-15T09:00:00.000Z");
    await post(professional, "booking.confirm", { requestId });
    await post(client, "message.send", { requestId, text: "Voici la position exacte de l’intervention", latitude: 36.8065, longitude: 10.1815 });
    const messages = await (await fetch(`${base}/api/client/conversations/${requestId}`, { headers: professional.headers })).json();
    assert.equal(messages.messages[0].latitude, 36.8065);
    assert.equal((await fetch(`${base}/api/client/conversations/${requestId}`, { headers: stranger.headers })).status, 404);
    const form = new FormData(); form.set("requestId", String(requestId)); form.set("file", new Blob(["%PDF-1.4\nfixture\n%%EOF"], { type: "application/pdf" }), "fixture.pdf");
    const upload = await fetch(`${base}/api/client/fichiers`, { method: "POST", headers: client.headers, body: form });
    assert.equal(upload.status, 201); const attachment = await upload.json();
    assert.equal((await fetch(`${base}/api/client/fichiers/${attachment.id}`, { headers: stranger.headers })).status, 404);
    assert.equal((await fetch(`${base}/api/client/fichiers/${attachment.id}`, { headers: professional.headers })).status, 200);
    const { id: secondId } = await create();
    await post(professional, "quote.propose", { requestId: secondId, amount: "120", details: "Seconde demande pour conflit agenda", validUntil: "2030-01-01T12:00:00Z" });
    const secondQuote = await prisma.quote.findFirstOrThrow({ where: { requestId: secondId } });
    await post(client, "quote.accept", { requestId: secondId, quoteId: secondQuote.id });
    await post(client, "booking.propose", { requestId: secondId, startsAt: "2030-01-15T10:30", endsAt: "2030-01-15T11:30" }, 409);
    await post(client, "intervention.confirm", { requestId }, 409);
    await post(professional, "intervention.status", { requestId, status: "COMPLETED" }, 400);
    for (const status of ["EN_ROUTE", "IN_PROGRESS", "COMPLETED"]) await post(professional, "intervention.status", { requestId, status });
    await post(client, "review.create", { requestId, quality: 5, punctuality: 4, communication: 5, priceRespect: 5 }, 409);
    await post(client, "intervention.confirm", { requestId });
    await post(client, "review.create", { requestId, quality: 5, punctuality: 4, communication: 5, priceRespect: 5 });
    const review = await prisma.professionalReview.findUniqueOrThrow({ where: { requestId } });
    assert.equal(review.published, false);
    await post(client, "favorite.add", { professionalId: professional.id });
    await post(client, "favorite.remove", { professionalId: professional.id });
    await post(client, "equipment.create", { name: "Climatiseur fixture", category: "Climatisation" });
    const equipment = await prisma.equipment.findFirstOrThrow({ where: { clientId: client.id } });
    await post(stranger, "reminder.create", { equipmentId: equipment.id, title: "Nettoyage filtres", dueAt: "2030-01-01", intervalMonths: 6 }, 404);
    await post(client, "reminder.create", { equipmentId: equipment.id, title: "Nettoyage filtres", dueAt: "2030-01-01", intervalMonths: 6 });
    const reminder = await prisma.maintenanceReminder.findFirstOrThrow({ where: { equipmentId: equipment.id } });
    await post(client, "reminder.complete", { reminderId: reminder.id });
    assert.equal(await prisma.maintenanceReminder.count({ where: { equipmentId: equipment.id, completedAt: null } }), 1);
    await post(client, "complaint.create", { requestId, subject: "Question de facturation", message: "Merci de vérifier les informations présentes sur ma facture." });
    for (const path of ["", "demandes", "messagerie", "devis", "reservations", "interventions", "paiements", "avis", "logement", "favoris", "assistant", "notifications", "profil", "reclamations"]) {
      const page = await fetch(`${base}/dashboard${path ? `/${path}` : ""}`, { headers: client.headers });
      assert.equal(page.status, 200, `page ${path}`); assert.ok(!(await page.text()).includes('"name":"PrismaClientKnownRequestError"'));
    }
  } finally {
    await prisma.complaint.deleteMany({ where: { clientId: { in: ids } } });
    await prisma.professionalReview.deleteMany({ where: { clientId: { in: ids } } });
    await prisma.clientInvoice.deleteMany({ where: { quote: { request: { clientId: { in: ids } } } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
});
