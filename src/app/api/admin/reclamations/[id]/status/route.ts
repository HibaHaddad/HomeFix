import { adminMutation } from "@/app/lib/admin-http";
import { prisma } from "@/app/lib/prisma";
import { audit } from "@/app/lib/admin-audit";
import { adminId, adminObject, adminText, AdminActionError } from "@/lib/admin-validation";
import { complaintPriorities, complaintStatuses } from "@/lib/admin-complaint-filters";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return adminMutation(request, async admin => {
    const id = adminId((await params).id);
    const body = adminObject(await request.json().catch(() => null), ["status", "priority", "reason"]);
    const reason = adminText(body.reason, "Motif");
    if (!Object.keys(complaintStatuses).includes(String(body.status))) throw new AdminActionError("Statut invalide.");
    if (body.priority !== undefined && !Object.keys(complaintPriorities).includes(String(body.priority))) throw new AdminActionError("Priorité invalide.");
    await prisma.$transaction(async tx => {
      const complaint = await tx.complaint.findUnique({ where: { id }, select: { status: true, priority: true, response: true, clientId: true } });
      if (!complaint) throw new AdminActionError("Réclamation introuvable.", 404);
      const priority = body.priority === undefined ? complaint.priority : String(body.priority);
      const statusChanged = complaint.status !== body.status;
      if (!statusChanged && complaint.priority === priority) throw new AdminActionError("Aucun changement à enregistrer.", 409);
      if (statusChanged && ["RESOLVED", "CLOSED"].includes(String(body.status)) && !complaint.response?.trim()) throw new AdminActionError("Envoyez une réponse au client avant de clôturer ou résoudre la réclamation.", 409);
      await tx.complaint.update({ where: { id }, data: { status: String(body.status), priority } });
      if (statusChanged) {
        await audit(tx, admin, "COMPLAINT_STATUS", `complaint:${id}`, reason, { previous: complaint.status, status: String(body.status) });
        await tx.clientNotification.create({ data: { userId: complaint.clientId, title: "Le suivi de votre réclamation a été mis à jour", type: "INFO", href: `/dashboard/reclamations?reclamation=${id}#reclamation-${id}` } });
      }
      if (complaint.priority !== priority) await audit(tx, admin, "COMPLAINT_PRIORITY", `complaint:${id}`, reason, { previous: complaint.priority, priority });
    }, { isolationLevel: "Serializable" });
    return Response.json({ ok: true });
  });
}
