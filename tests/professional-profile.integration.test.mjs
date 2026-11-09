import assert from "node:assert/strict";
import { test } from "node:test";
import { SignJWT } from "jose";
import { prisma } from "../src/app/lib/prisma.ts";

const base = process.env.DIRECTORY_TEST_URL || "http://localhost:3000";

test("professional profile saves with the public origin and preserves origin, role and validation checks", { timeout: 30000 }, async () => {
  const ids = [];
  async function account(role, status) {
    const user = await prisma.user.create({ data: { name: "Profile test", email: `profile-${crypto.randomUUID()}@example.invalid`, password: "not-a-login", role, status } });
    ids.push(user.id);
    const token = await new SignJWT({ userId: user.id }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("2m").sign(new TextEncoder().encode(process.env.JWT_SECRET));
    return { ...user, cookie: `session=${token}` };
  }
  try {
    const pro = await account("PROFESSIONAL", "APPROVED");
    const client = await account("CLIENT", "ACTIVE");
    const pending = await account("PROFESSIONAL", "PENDING_VERIFICATION");
    const profile = { name: "Updated professional", businessName: "Plomberie test", email: pro.email, phone: "+216 12345678", specialty: "Plomberie", experience: "5 ans", serviceCity: "Tunis", coveredAreas: "Tunis et Ariana", priceRange: "20 - 60 DT", description: "Profil de test", experienceYears: 5, priceMin: 20, priceMax: 60, isPublic: true, availability: null };
    const save = (cookie, origin = new URL(base).origin, body = profile) => fetch(`${base}/api/professionnel/profil`, { method: "PUT", headers: { "Content-Type": "application/json", Origin: origin, ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
    const response = await save(pro.cookie);
    assert.equal(response.status, 200, await response.text());
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: pro.id } });
    for (const [key, value] of Object.entries(profile)) assert.equal(stored[key], value, key);
    assert.equal((await save(pro.cookie, "https://foreign.example", { ...profile, name: "Forbidden update" })).status, 403);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: pro.id } })).name, profile.name);
    assert.equal((await save(undefined)).status, 401);
    assert.equal((await save(client.cookie)).status, 403);
    assert.equal((await save(pending.cookie)).status, 403);
    assert.equal((await save(pro.cookie, undefined, { ...profile, priceMin: 80, priceMax: 60 })).status, 400);
    assert.equal((await save(pro.cookie, undefined, { ...profile, email: `changed-${crypto.randomUUID()}@example.invalid` })).status, 403);
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
});
