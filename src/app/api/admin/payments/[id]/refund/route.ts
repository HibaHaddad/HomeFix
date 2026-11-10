import { adminMutation } from "@/app/lib/admin-http";
import { requestAdminRefund, reconcileRefund } from "@/app/lib/admin-refunds";
import { prisma } from "@/app/lib/prisma";
import { adminObject, adminText, AdminActionError } from "@/lib/admin-validation";
import { PaymentError } from "@/app/lib/stripe-payments";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return adminMutation(request, async admin => {
    const id = (await params).id;
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new AdminActionError("Identifiant de transaction invalide.");
    const body = adminObject(await request.json().catch(() => null), ["reason", "action"]);
    try {
      if (body.action === "SYNC") {
        const refund = await prisma.adminRefund.findUnique({ where: { paymentId: id }, select: { id: true } });
        if (!refund) throw new AdminActionError("Remboursement introuvable.", 404);
        return Response.json(await reconcileRefund(refund.id));
      }
      if (body.action !== "REFUND") throw new AdminActionError("Action invalide.");
      const reason = adminText(body.reason, "Motif du remboursement", 10);
      return Response.json(await requestAdminRefund(id, reason, admin));
    } catch (e) {
      if (e instanceof PaymentError) throw new AdminActionError(e.message, e.status);
      throw e;
    }
  });
}
