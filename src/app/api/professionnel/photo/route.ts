import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { prisma } from "@/app/lib/prisma";

const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
const MIME_SIGNATURES: Record<string, (bytes: Uint8Array) => boolean> = {
  "image/jpeg": (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  "image/png": (bytes) => [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value),
  "image/webp": (bytes) => String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP",
};

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; }
  catch { return false; }
}

async function professionalSession() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Connexion requise." }, { status: 401 }) };
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, role: true, status: true } });
  if (!user || user.role !== "PROFESSIONAL" || user.status !== "APPROVED") {
    return { error: NextResponse.json({ error: "Cette action est réservée aux professionnels approuvés." }, { status: 403 }) };
  }
  return { user };
}

export async function GET() {
  const access = await professionalSession();
  if ("error" in access) return access.error;
  const rows = await prisma.$queryRaw<Array<{ profilePhoto: Uint8Array | null; profilePhotoMime: string | null }>>`
    SELECT "profilePhoto", "profilePhotoMime" FROM "User" WHERE "id" = ${access.user.id}
  `;
  const user = rows[0];
  if (!user?.profilePhoto || !user.profilePhotoMime) return NextResponse.json({ error: "Aucune photo de profil." }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  return new Response(new Uint8Array(user.profilePhoto), { status: 200, headers: { "Content-Type": user.profilePhotoMime, "Content-Length": String(user.profilePhoto.byteLength), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline; filename=photo-profil" } });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Requête non autorisée." }, { status: 403 });
  const access = await professionalSession();
  if ("error" in access) return access.error;
  const formData = await request.formData().catch(() => null);
  const photo = formData?.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return NextResponse.json({ error: "Sélectionnez une image à importer." }, { status: 400 });
  if (photo.size > MAX_PHOTO_SIZE) return NextResponse.json({ error: "La photo ne doit pas dépasser 5 Mo." }, { status: 400 });
  const signatureCheck = MIME_SIGNATURES[photo.type];
  if (!signatureCheck) return NextResponse.json({ error: "Format non pris en charge. Choisissez une image JPG, PNG ou WebP." }, { status: 415 });
  const bytes = new Uint8Array(await photo.arrayBuffer());
  if (!signatureCheck(bytes)) return NextResponse.json({ error: "Le contenu du fichier ne correspond pas à une image valide." }, { status: 400 });
  await prisma.$executeRaw`
    UPDATE "User" SET "profilePhoto" = ${bytes}, "profilePhotoMime" = ${photo.type}
    WHERE "id" = ${access.user.id} AND "role" = 'PROFESSIONAL' AND "status" = 'APPROVED'
  `;
  return NextResponse.json({ message: "Votre photo de profil a été mise à jour." });
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Requête non autorisée." }, { status: 403 });
  const access = await professionalSession();
  if ("error" in access) return access.error;
  await prisma.$executeRaw`
    UPDATE "User" SET "profilePhoto" = NULL, "profilePhotoMime" = NULL
    WHERE "id" = ${access.user.id} AND "role" = 'PROFESSIONAL' AND "status" = 'APPROVED'
  `;
  return NextResponse.json({ message: "Votre photo de profil a été supprimée." });
}
