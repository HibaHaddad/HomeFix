// Run against the configured PostgreSQL database without inserting any records:
// node --import dotenv/config --import ./tests/helpers/register-ts.mjs --test tests/directory.integration.test.mjs
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { prisma } from "../src/app/lib/prisma.ts";
import { searchProfessionals, visibleProfessional } from "../src/app/lib/professional-directory.ts";
import { parseDirectoryFilters } from "../src/lib/directory-filters.ts";
import { SignJWT } from "jose";

after(() => prisma.$disconnect());
const filters = (query = "") => parseDirectoryFilters(new URLSearchParams(query));

test("PostgreSQL returns only approved, public, consented professionals and safe fields", async () => {
  const result = await searchProfessionals(filters());
  assert.equal(result.total, await prisma.user.count({ where: visibleProfessional }));
  assert.ok(result.professionals.length <= 9);
  for (const professional of result.professionals) {
    assert.equal("password" in professional, false);
    assert.equal("email" in professional, false);
    assert.equal("certificationPdf" in professional, false);
    const user = await prisma.user.findFirst({ where: { ...visibleProfessional, id: professional.id }, select: { id: true } });
    assert.ok(user);
    const reviews = await prisma.professionalReview.aggregate({ where: { professionalId: professional.id, published: true }, _avg: { rating: true }, _count: true });
    assert.equal(professional.rating, reviews._avg.rating);
    assert.equal(professional.reviewCount, reviews._count);
  }
});
test("all sort orders, combined filters, empty results and out-of-range pagination execute in PostgreSQL", async () => {
  for (const sort of ["recent", "rating", "experience", "price_asc", "price_desc"]) {
    const result = await searchProfessionals(filters(`sort=${sort}&page=1000`));
    assert.ok(result.page >= 1);
    assert.ok(result.page <= Math.max(1, Math.ceil(result.total / result.pageSize)));
  }
  const result = await searchProfessionals(filters("q=__homefix_no_match_631824__&minExperience=0&maxExperience=80&minRating=4&minPrice=0&maxPrice=100000&verified=true&availability=AVAILABLE&location=Tunis&specialty=Plomberie"));
  assert.equal(result.total, 0);
  assert.deepEqual(result.professionals, []);
  assert.equal(result.page, 1);
});
test("search inputs containing SQL and wildcards are literal, parameterized values", async () => {
  for (const q of ["' OR 1=1 --", "%", "_"]) {
    const result = await searchProfessionals(filters(`q=${encodeURIComponent(q)}`));
    assert.equal(result.total, 0);
  }
});
test("HTTP endpoints enforce authentication and validate client requests", async (t) => {
  const base = process.env.DIRECTORY_TEST_URL || "http://localhost:3000";
  const unauthenticated = await fetch(`${base}/api/client/professionnels`);
  assert.equal(unauthenticated.status, 401);
  const unauthenticatedRequest = await fetch(`${base}/api/client/demandes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.equal(unauthenticatedRequest.status, 401);
  const client = await prisma.user.findFirst({ where: { role: "CLIENT", status: "ACTIVE" }, select: { id: true } });
  if (!client) { t.diagnostic("No existing active client: authenticated HTTP checks skipped."); return; }
  const token = await new SignJWT({ userId: client.id }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("2m").sign(new TextEncoder().encode(process.env.JWT_SECRET));
  const headers = { Cookie: `session=${token}` };
  const response = await fetch(`${base}/api/client/professionnels`, { headers });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.total, await prisma.user.count({ where: visibleProfessional }));
  assert.equal((await fetch(`${base}/api/client/professionnels?minPrice=-1`, { headers })).status, 400);
  assert.equal((await fetch(`${base}/api/client/professionnels/0/photo`, { headers })).status, 404);
  assert.equal((await fetch(`${base}/api/client/demandes`, { method: "POST", headers: { ...headers, Origin: "https://foreign.example", "Content-Type": "application/json" }, body: "{}" })).status, 403);
  assert.equal((await fetch(`${base}/api/client/demandes`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: "{}" })).status, 400);
  assert.equal((await fetch(`${base}/api/client/demandes`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ professionalId: 2147483647, kind: "QUOTE", message: "Demande de test vers un identifiant absent." }) })).status, 404);
  const page = await fetch(`${base}/dashboard/professionnels`, { headers });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Le bon professionnel/);
  if (body.professionals[0]) {
    const profile = await fetch(`${base}/dashboard/professionnels/${body.professionals[0].id}?action=devis`, { headers });
    assert.equal(profile.status, 200);
    assert.match(await profile.text(), /Envoyer ma demande de devis/);
  }
  const hidden = await prisma.user.findFirst({ where: { role: "PROFESSIONAL", OR: [{ status: { not: "APPROVED" } }, { isPublic: false }, { termsAccepted: false }] }, select: { id: true } });
  if (hidden) {
    assert.equal((await fetch(`${base}/api/client/professionnels/${hidden.id}/photo`, { headers })).status, 404);
    assert.equal((await fetch(`${base}/dashboard/professionnels/${hidden.id}`, { headers })).status, 404);
  }
});

test("dashboard routing preserves existing Admin and Professional destinations", async () => {
  const base = process.env.DIRECTORY_TEST_URL || "http://localhost:3000";
  assert.equal((await fetch(`${base}/dashboard`, { redirect: "manual" })).status, 307);
  for (const [role, destination] of [["ADMIN", "/admin/professionnels"], ["PROFESSIONAL", "/professionnel/tableau-de-bord"]]) {
    const user = await prisma.user.findFirst({ where: { role, ...(role === "PROFESSIONAL" ? { status: "APPROVED" } : {}) }, select: { id: true } });
    if (!user) continue;
    const token = await new SignJWT({ userId: user.id }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("2m").sign(new TextEncoder().encode(process.env.JWT_SECRET));
    const headers = { Cookie: `session=${token}` };
    const response = await fetch(`${base}/dashboard`, { headers, redirect: "manual" });
    assert.equal(response.status, 307);
    assert.equal(new URL(response.headers.get("location"), base).pathname, destination);
    assert.equal((await fetch(`${base}/api/client/professionnels`, { headers })).status, 401);
  }
});
