import { adminMutation } from "@/app/lib/admin-http";
import { prisma } from "@/app/lib/prisma";
import { audit } from "@/app/lib/admin-audit";
import { adminId, adminObject, adminText, AdminActionError } from "@/lib/admin-validation";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return adminMutation(request, async admin => {
    const id = adminId((await params).id);
    const body = adminObject(await request.json().catch(() => null), ["status", "reason"]);
    const reason = adminText(body.reason, "Motif");
    if (!["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].includes(String(body.status))) throw new AdminActionError("Statut invalide.");
    await prisma.$transaction(async tx => {
      const complaint = await tx.complaint.findUnique({ where: { id }, select: { status: true, response: true, clientId: true } });
      if (!complaint) throw new AdminActionError("Réclamation introuvable.", 404);
      if (complaint.status === body.status) throw new AdminActionError("La réclamation possède déjà ce statut.", 409);
      if (["RESOLVED", "CLOSED"].includes(String(body.status)) && !complaint.response?.trim()) throw new AdminActionError("Envoyez une réponse au client avant de clôturer ou résoudre la réclamation.", 409);
      await tx.complaint.update({ where: { id }, data: { status: String(body.status) } });
      await audit(tx, admin, "COMPLAINT_STATUS", `complaint:${id}`, reason, { previous: complaint.status, status: String(body.status) });
      await tx.clientNotification.create({ data: { userId: complaint.clientId, title: `Le suivi de votre réclamation #${id} a été mis à jour`, type: "INFO", href: "/dashboard/reclamations" } });
    }, { isolationLevel: "Serializable" });
    return Response.json({ ok: true });
  });
}
