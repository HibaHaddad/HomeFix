import { adminMutation } from "@/app/lib/admin-http";
import { saveCategory, removeCategory } from "@/app/lib/admin-category-mutations";
import { adminId, adminObject, AdminActionError } from "@/lib/admin-validation";
import { prisma } from "@/app/lib/prisma";
import { audit } from "@/app/lib/admin-audit";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return adminMutation(request, async admin => {
    const id = adminId((await context.params).id);
    return Response.json({ category: await saveCategory(admin, await request.json().catch(() => null), id) });
  });
}
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return adminMutation(request, async admin => {
    const id = adminId((await context.params).id);
    const input = adminObject(await request.json().catch(() => null), ["isActive"]);
    if (typeof input.isActive !== "boolean") throw new AdminActionError("Statut invalide.");
    const isActive = input.isActive;
    await prisma.$transaction(async tx => {
      if (!await tx.serviceCategory.findUnique({ where: { id } })) throw new AdminActionError("Catégorie introuvable.", 404);
      await tx.serviceCategory.update({ where: { id }, data: { isActive } });
      await audit(tx, admin, isActive ? "CATEGORY_ACTIVATE" : "CATEGORY_DEACTIVATE", `category:${id}`);
    });
    return Response.json({ ok: true });
  });
}
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return adminMutation(request, async admin => Response.json(await removeCategory(admin, adminId((await context.params).id))));
}
