import "server-only";
import { prisma } from "./prisma";
import { normalizeCategoryName } from "@/lib/service-categories";

export async function getAdminCategoryInventory() {
  return prisma.$transaction(async tx => {
    const categories = await tx.serviceCategory.findMany({ orderBy: { name: "asc" } });
    const [professionals, requests, equipment] = await Promise.all([
      tx.user.groupBy({ by: ["categoryId", "specialty", "status"], where: { role: "PROFESSIONAL" }, _count: true }),
      tx.serviceRequest.groupBy({ by: ["categoryId", "category"], where: { kind: { not: "MESSAGE" } }, _count: true }),
      tx.equipment.groupBy({ by: ["categoryId", "category"], _count: true }),
    ]);
    return categories.map(category => {
      const matches = (id: number | null, name: string | null) => id !== null ? id === category.id : !!name && [category.name, ...category.aliases].some(alias => normalizeCategoryName(alias) === normalizeCategoryName(name));
      const people = professionals.filter(group => matches(group.categoryId, group.specialty));
      return {
        id: category.id, name: category.name, description: category.description, icon: category.icon, isActive: category.isActive,
        professionals: people.reduce((sum, group) => sum + group._count, 0),
        approved: people.filter(group => group.status === "APPROVED").reduce((sum, group) => sum + group._count, 0),
        interventions: requests.filter(group => matches(group.categoryId, group.category)).reduce((sum, group) => sum + group._count, 0),
        equipment: equipment.filter(group => matches(group.categoryId, group.category)).reduce((sum, group) => sum + group._count, 0),
      };
    });
  }, { isolationLevel: "RepeatableRead" });
}
