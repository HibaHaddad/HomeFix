import bcrypt from "bcrypt";
import { getClient } from "@/app/lib/client-access";
import { prisma } from "@/app/lib/prisma";
export async function POST(request: Request) {
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  const client = await getClient(); if (!client) return Response.json({ error: "Connexion requise." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.currentPassword !== "string" || body.currentPassword.length > 200 || typeof body.password !== "string" || body.password.length < 12 || Buffer.byteLength(body.password) > 72) return Response.json({ error: "Le nouveau mot de passe doit contenir au moins 12 caractères (72 octets maximum)." }, { status: 400 });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: client.id }, select: { password: true } });
  if (!await bcrypt.compare(body.currentPassword, user.password)) return Response.json({ error: "Le mot de passe actuel est incorrect." }, { status: 400 });
  const password = await bcrypt.hash(body.password, 12);
  await prisma.user.updateMany({ where: { id: client.id, password: user.password }, data: { password } });
  return Response.json({ ok: true });
}
