import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { prisma } from "@/app/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  const admin = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true } });
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Accès réservé aux administrateurs." }, { status: 403 });
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  const professional = await prisma.user.findFirst({ where: { id, role: "PROFESSIONAL" }, select: { certificationPdf: true } });
  if (!professional?.certificationPdf) return NextResponse.json({ error: "Aucun document n’est disponible." }, { status: 404 });
  return new Response(new Uint8Array(professional.certificationPdf), { status: 200, headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="justificatif-professionnel-${id}.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
