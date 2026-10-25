import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { prisma } from "@/app/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const origin = request.headers.get("origin");
  if (origin) {
    try { if (new URL(origin).origin !== new URL(request.url).origin) return NextResponse.json({ error: "Requête non autorisée." }, { status: 403 }); }
    catch { return NextResponse.json({ error: "Origine invalide." }, { status: 403 }); }
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  const admin = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, role: true } });
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Accès réservé aux administrateurs." }, { status: 403 });

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: "Dossier introuvable." }, { status: 404 });
  const body = await request.json().catch(() => null) as { decision?: unknown; reason?: unknown } | null;
  if (!body || (body.decision !== "APPROVED" && body.decision !== "REJECTED")) return NextResponse.json({ error: "Décision invalide." }, { status: 400 });
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (body.decision === "REJECTED" && (reason.length < 3 || reason.length > 1000)) return NextResponse.json({ error: "Le motif doit contenir entre 3 et 1 000 caractères." }, { status: 400 });

  const result = await prisma.user.updateMany({
    where: { id, role: "PROFESSIONAL", status: "PENDING_VERIFICATION" },
    data: { status: body.decision, verificationReason: body.decision === "REJECTED" ? reason : null, verifiedAt: new Date(), verifiedById: admin.id },
  });
  if (result.count !== 1) return NextResponse.json({ error: "Ce dossier n’est plus en attente ou n’existe pas." }, { status: 409 });
  return NextResponse.json({ id, status: body.decision });
}
