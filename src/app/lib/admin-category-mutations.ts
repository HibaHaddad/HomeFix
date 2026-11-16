import "server-only";
import { prisma } from "./prisma";
import { audit } from "./admin-audit";
import { AdminActionError } from "@/lib/admin-validation";
import { validateCategory } from "@/lib/admin-category-validation";
import { normalizeCategoryName } from "@/lib/service-categories";

type Actor = { id: number; name: string };
export async function saveCategory(actor: Actor, value: unknown, id?: number) {
  const input = validateCategory(value);
  return prisma.$transaction(async tx => {
    const previous = id ? await tx.serviceCategory.findUnique({ where: { id } }) : null;
    if (id && !previous) throw new AdminActionError("Catégorie introuvable.", 404);
    const all = await tx.serviceCategory.findMany({ select: { id: true, normalizedName: true, aliases: true } });
    if (all.some(category => category.id !== id && [category.normalizedName, ...category.aliases.map(normalizeCategoryName)].includes(input.normalizedName))) throw new AdminActionError("Une catégorie porte déjà ce nom.", 409);
    const aliases = [...new Set([...(previous?.aliases ?? []), ...(previous ? [previous.name] : []), input.name])];
    const category = previous
      ? await tx.serviceCategory.update({ where: { id }, data: { ...input, aliases } })
      : await tx.serviceCategory.create({ data: { ...input, aliases } });
    if (previous && previous.name !== category.name) {
      await tx.user.updateMany({ where: { role: "PROFESSIONAL", OR: [{ categoryId: category.id }, { categoryId: null, specialty: { in: previous.aliases, mode: "insensitive" } }] }, data: { categoryId: category.id, specialty: category.name } });
    }
    await audit(tx, actor, previous ? "CATEGORY_UPDATE" : "CATEGORY_CREATE", `category:${category.id}`, undefined, { name: category.name, isActive: category.isActive });
    return category;
  }, { isolationLevel: "Serializable" });
}

export async function removeCategory(actor: Actor, id: number) {
  return prisma.$transaction(async tx => {
    const category = await tx.serviceCategory.findUnique({ where: { id } });
    if (!category) throw new AdminActionError("Catégorie introuvable.", 404);
    const names = [...new Set([category.name, ...category.aliases])];
    const [professionals, requests, equipment] = await Promise.all([
      tx.user.count({ where: { OR: [{ categoryId: id }, { specialty: { in: names, mode: "insensitive" } }] } }),
      tx.serviceRequest.count({ where: { OR: [{ categoryId: id }, { category: { in: names, mode: "insensitive" } }] } }),
      tx.equipment.count({ where: { OR: [{ categoryId: id }, { category: { in: names, mode: "insensitive" } }] } }),
    ]);
    const deactivated = professionals + requests + equipment > 0;
    if (deactivated) await tx.serviceCategory.update({ where: { id }, data: { isActive: false } });
    else await tx.serviceCategory.delete({ where: { id } });
    await audit(tx, actor, deactivated ? "CATEGORY_DEACTIVATE" : "CATEGORY_DELETE", `category:${id}`, undefined, { name: category.name });
    return { deactivated };
  }, { isolationLevel: "Serializable" });
}
