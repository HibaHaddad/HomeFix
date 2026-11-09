// Read-only verification: valid decisions target an ID confirmed absent from PostgreSQL.
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { SignJWT } from "jose";
import { prisma } from "../src/app/lib/prisma.ts";

const base = process.env.ADMIN_TEST_URL || "http://localhost:3000";
const missingId = 2147483647;
after(() => prisma.$disconnect());
async function headersFor(userId) {
  const token = await new SignJWT({ userId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("2m").sign(new TextEncoder().encode(process.env.JWT_SECRET));
  return { Cookie: `session=${token}`, Origin: new URL(base).origin, "Content-Type": "application/json" };
}
const decide = (headers, decision = "APPROVED") => fetch(`${base}/api/admin/professionnels/${missingId}/decision`, { method: "POST", headers, body: JSON.stringify({ decision }) });

test("approval accepts the public browser origin while retaining authentication and role checks", async (t) => {
  assert.equal(await prisma.user.findUnique({ where: { id: missingId }, select: { id: true } }), null);
  assert.equal((await decide({ Origin: new URL(base).origin, "Content-Type": "application/json" })).status, 401);
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (!admin) { t.skip("No existing administrator"); return; }
  const headers = await headersFor(admin.id);
  // A missing dossier returns 404 after the authentication and role checks.
  assert.equal((await decide(headers)).status, 404);
  assert.equal((await decide(headers, "INVALID")).status, 400);
  assert.equal((await decide({ ...headers, Origin: "https://foreign.example" })).status, 403);
  const client = await prisma.user.findFirst({ where: { role: "CLIENT", status: "ACTIVE" }, select: { id: true } });
  if (client) assert.equal((await decide(await headersFor(client.id))).status, 403);
});
