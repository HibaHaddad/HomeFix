import { getClient } from "@/app/lib/client-access";
import { prisma } from "@/app/lib/prisma";
export async function GET() {
  const client = await getClient(); if (!client) return new Response(null, { status: 401 });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: client.id }, select: { profilePhoto: true, profilePhotoMime: true } });
  if (!user.profilePhoto || !user.profilePhotoMime) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(user.profilePhoto), { headers: { "Content-Type": user.profilePhotoMime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
export async function POST(request: Request) {
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  const client = await getClient(); if (!client) return Response.json({ error: "Connexion requise." }, { status: 401 });
  if (Number(request.headers.get("content-length") || 0) > 5 * 1024 * 1024 + 65536) return Response.json({ error: "Photo limitée à 5 Mo." }, { status: 413 });
  const data = await request.formData().catch(() => null); const file = data?.get("photo");
  if (!(file instanceof File) || !file.size || file.size > 5 * 1024 * 1024) return Response.json({ error: "Choisissez une photo de 5 Mo maximum." }, { status: 400 });
  const bytes = Buffer.from(await file.arrayBuffer());
  const valid = file.type === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : file.type === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : file.type === "image/webp" && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!valid) return Response.json({ error: "Choisissez une image JPEG, PNG ou WebP valide." }, { status: 400 });
  await prisma.user.update({ where: { id: client.id }, data: { profilePhoto: bytes, profilePhotoMime: file.type } });
  return Response.json({ ok: true });
}
