import { adminMutation } from "@/app/lib/admin-http";
import { prisma } from "@/app/lib/prisma";
import { audit } from "@/app/lib/admin-audit";
export async function PATCH(request: Request) {
  return adminMutation(request, async admin => {
    await prisma.$transaction(async tx => {
      const result = await tx.clientNotification.updateMany({ where: { userId: admin.id, readAt: null }, data: { readAt: new Date() } });
      if (result.count) await audit(tx, admin, "NOTIFICATIONS_READ", `user:${admin.id}`, undefined, { count: result.count });
    });
    return Response.json({ ok: true });
  });
}
