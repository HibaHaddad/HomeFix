// Read-only checks against existing PostgreSQL records. No fixture professionals.
import assert from "node:assert/strict";
import { test, after } from "node:test";
import { prisma } from "../src/app/lib/prisma.ts";
import { findAssistantProfessionals, hydrateProfessionals } from "../src/app/lib/assistant-directory.ts";
import { visibleProfessional } from "../src/app/lib/professional-directory.ts";
import { blockingBookingStatuses as occupiedBookingStatuses } from "../src/lib/availability.ts";
after(() => prisma.$disconnect());
test("recommendations are approved profiles with real reviews, prices and unoccupied slots", async () => {
  const records = await prisma.user.findMany({ where: visibleProfessional, select: { id: true }, take: 10 });
  const people = await hydrateProfessionals(records.map((p) => p.id));
  assert.equal(people.length, records.length);
  for (const p of people) {
    const record = await prisma.user.findFirstOrThrow({ where: { ...visibleProfessional, id: p.id }, select: { priceMin: true, priceMax: true, name: true } });
    assert.equal(p.priceMin, record.priceMin); assert.equal(p.priceMax, record.priceMax); assert.equal(p.name, record.name);
    assert.equal("password" in p, false); assert.equal("email" in p, false); assert.equal("phone" in p, false);
    const reviews = await prisma.professionalReview.aggregate({ where: { professionalId: p.id, published: true }, _avg: { rating: true }, _count: true });
    assert.equal(p.rating, reviews._avg.rating); assert.equal(p.reviewCount, reviews._count);
    if (p.nextSlot) {
      const slot = await prisma.availabilitySlot.findFirstOrThrow({ where: { professionalId: p.id, active: true, startsAt: new Date(p.nextSlot) } });
      assert.equal(await prisma.booking.count({ where: { professionalId: p.id, status: { in: occupiedBookingStatuses }, startsAt: { lt: slot.endsAt }, endsAt: { gt: slot.startsAt } } }), 0);
    }
  }
});
test("parameterized matching handles accents, budgets and literal injection attempts", async () => {
  for (const city of ["' OR 1=1 --", "%", "_"]) assert.deepEqual(await findAssistantProfessionals({ category: "Plomberie", city, budget: 80 }), []);
  for (const category of ["Électricité", "Plomberie", "Climatisation"]) {
    const people = await findAssistantProfessionals({ category, city: "Tunis", budget: 80 });
    assert.ok(people.length <= 4);
    for (const p of people) {
      assert.equal(p.match.budget, p.priceMin === null ? "UNKNOWN" : p.priceMin > 80 ? "OVER" : "WITHIN");
      assert.ok(p.reasons.length >= 2);
    }
  }
  const hidden = await prisma.user.findMany({ where: { role: "PROFESSIONAL", OR: [{ status: { not: "APPROVED" } }, { isPublic: false }, { termsAccepted: false }] }, select: { id: true }, take: 10 });
  assert.deepEqual(await hydrateProfessionals(hidden.map((p) => p.id)), []);
});
test("specialists match the requested city; only budget alternatives remain visible", async (t) => {
  const plumber = await prisma.user.findFirst({ where: { ...visibleProfessional, specialty: "Plomberie", priceMin: { gt: 0 } }, select: { id: true, serviceCity: true, priceMin: true } });
  if (!plumber?.serviceCity) { t.skip("No existing plumber with a declared city and price"); return; }
  const local = await findAssistantProfessionals({ category: "Plomberie", city: plumber.serviceCity, budget: plumber.priceMin });
  assert.ok(local.some((p) => p.id === plumber.id));
  assert.ok(local.every((p) => p.match.locationConfirmed && p.match.budget !== "OVER"));
  const lowBudget = await findAssistantProfessionals({ category: "Plomberie", city: plumber.serviceCity, budget: 0 });
  assert.ok(lowBudget.length > 0);
  for (const p of lowBudget) if (p.priceMin !== null && p.priceMin > 0) {
    assert.equal(p.match.budget, "OVER"); assert.ok(p.reasons.some((r) => r.includes("supérieur")));
  }
  const anotherCity = await findAssistantProfessionals({ category: "Plomberie", city: "Ville sans couverture HomeFix", budget: 100 });
  assert.ok(anotherCity.every((p) => p.match.locationConfirmed));
});
