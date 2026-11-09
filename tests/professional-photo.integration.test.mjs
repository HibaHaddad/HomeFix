// Checks use rejected uploads only: no real profile photo is changed or deleted.
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { SignJWT } from "jose";
import { prisma } from "../src/app/lib/prisma.ts";

const base = process.env.PHOTO_TEST_URL || "http://localhost:3000";
const endpoint = `${base}/api/professionnel/photo`;
const origin = new URL(base).origin;
after(() => prisma.$disconnect());
async function headersFor(userId) {
  const token = await new SignJWT({ userId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("2m").sign(new TextEncoder().encode(process.env.JWT_SECRET));
  return { Cookie: `session=${token}`, Origin: origin };
}
test("photo upload accepts the public origin and retains file, role and origin validation", async (t) => {
  for (const method of ["POST", "DELETE"]) assert.equal((await fetch(endpoint, { method, headers: { Origin: origin } })).status, 401);
  const professional = await prisma.user.findFirst({ where: { role: "PROFESSIONAL", status: "APPROVED" }, select: { id: true } });
  if (!professional) { t.skip("No existing approved professional"); return; }
  const headers = await headersFor(professional.id);
  // Reaching file validation proves that the valid browser origin is accepted.
  assert.equal((await fetch(endpoint, { method: "POST", headers, body: new FormData() })).status, 400);
  const invalid = new FormData();
  invalid.set("photo", new File(["not an image"], "invalid.png", { type: "image/png" }));
  assert.equal((await fetch(endpoint, { method: "POST", headers, body: invalid })).status, 400);
  for (const method of ["POST", "DELETE"]) assert.equal((await fetch(endpoint, { method, headers: { ...headers, Origin: "https://foreign.example" } })).status, 403);
  const client = await prisma.user.findFirst({ where: { role: "CLIENT", status: "ACTIVE" }, select: { id: true } });
  if (client) for (const method of ["POST", "DELETE"]) assert.equal((await fetch(endpoint, { method, headers: await headersFor(client.id) })).status, 403);
});
