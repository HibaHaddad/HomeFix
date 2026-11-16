import { getSession } from "@/app/lib/session";
import { prisma } from "@/app/lib/prisma";
import { appealSanction } from "@/app/lib/sanctions";
import { adminObject, adminText, AdminActionError } from "@/lib/admin-validation";
import { hasAllowedRequestOrigin } from "@/lib/request-origin";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasAllowedRequestOrigin(request)) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  const session = await getSession();
  if (!session) return Response.json({ error: "Connexion requise." }, { status: 401 });
  const pro = await prisma.user.findFirst({ where: { id: session.userId, role: "PROFESSIONAL", status: "APPROVED", isSuspended: false }, select: { id: true } });
  if (!pro) return Response.json({ error: "Accès réservé au professionnel." }, { status: 403 });
  try {
    const input = adminObject(await request.json().catch(() => null), ["reason"]);
    return Response.json(await appealSanction((await params).id, pro.id, adminText(input.reason, "Motif de contestation", 10, 3000)));
  } catch (e) {
    if (e instanceof AdminActionError) return Response.json({ error: e.message }, { status: e.status });
    return Response.json({ error: "Contestation indisponible. Réessayez." }, { status: 503 });
  }
}
