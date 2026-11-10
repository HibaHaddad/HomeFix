import { adminMutation } from "@/app/lib/admin-http";
import { prisma } from "@/app/lib/prisma";
import { audit } from "@/app/lib/admin-audit";
import { adminId, adminObject, adminText, AdminActionError } from "@/lib/admin-validation";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return adminMutation(request, async admin => {
    const id = adminId((await params).id);
    const body = adminObject(await request.json().catch(() => null), ["action", "reason"]);
    const reason = adminText(body.reason, "Motif");
    if (!["HIDE", "PUBLISH", "DISMISS_REPORTS"].includes(String(body.action))) throw new AdminActionError("Décision invalide.");
    await prisma.$transaction(async tx => {
      const review = await tx.professionalReview.findUnique({ where: { id }, select: { id: true, published: true, moderationStatus: true } });
      if (!review) throw new AdminActionError("Avis introuvable.", 404);
      if (body.action !== "DISMISS_REPORTS") await tx.professionalReview.update({ where: { id }, data: { published: body.action === "PUBLISH", moderationStatus: body.action === "HIDE" ? "HIDDEN" : "APPROVED", moderationReason: reason } });
      await tx.reviewReport.updateMany({ where: { reviewId: id, status: "OPEN" }, data: { status: body.action === "DISMISS_REPORTS" ? "DISMISSED" : "RESOLVED" } });
      await audit(tx, admin, `REVIEW_${body.action}`, `review:${id}`, reason, { previousPublished: review.published, previousModeration: review.moderationStatus });
    }, { isolationLevel: "Serializable" });
    return Response.json({ ok: true });
  });
}
