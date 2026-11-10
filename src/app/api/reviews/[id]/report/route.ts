import { getSession } from "@/app/lib/session";
import { prisma } from "@/app/lib/prisma";
import { hasAllowedRequestOrigin } from "@/lib/request-origin";
import { adminId, adminObject, adminText, AdminActionError } from "@/lib/admin-validation";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasAllowedRequestOrigin(request)) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  const session = await getSession();
  if (!session) return Response.json({ error: "Connexion requise." }, { status: 401 });
  try {
    const id = adminId((await params).id);
    const user = await prisma.user.findFirst({ where: { id: session.userId, isSuspended: false, OR: [{ role: "CLIENT", status: "ACTIVE" }, { role: "PROFESSIONAL", status: "APPROVED" }] }, select: { id: true } });
    if (!user) return Response.json({ error: "Accès non autorisé." }, { status: 403 });
    const body = adminObject(await request.json().catch(() => null), ["reason"]);
    const reason = adminText(body.reason, "Motif", 10);
    const review = await prisma.professionalReview.findFirst({ where: { id, published: true, OR: [{ professionalId: user.id }, { clientId: user.id }] }, select: { id: true } });
    if (!review) throw new AdminActionError("Avis introuvable ou accès non autorisé.", 404);
    const existing = await prisma.reviewReport.findUnique({ where: { reviewId_reporterId: { reviewId: id, reporterId: user.id } }, select: { id: true } });
    if (existing) throw new AdminActionError("Cet avis a déjà été signalé par votre compte.", 409);
    await prisma.$transaction(async tx => {
      await tx.reviewReport.create({ data: { reviewId: id, reporterId: user.id, reason } });
      const admins = await tx.user.findMany({ where: { role: "ADMIN", isSuspended: false }, select: { id: true } });
      await tx.clientNotification.createMany({ data: admins.map(a => ({ userId: a.id, title: `L’avis #${id} a été signalé et attend une modération`, type: "INFO", href: "/admin/avis?status=REPORTED" })) });
    });
    return Response.json({ ok: true }, { status: 201 });
  } catch (e) {
    if (e instanceof AdminActionError) return Response.json({ error: e.message }, { status: e.status });
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") return Response.json({ error: "Avis déjà signalé." }, { status: 409 });
    console.error("[Review report]", e);
    return Response.json({ error: "Signalement indisponible." }, { status: 503 });
  }
}
