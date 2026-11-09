import "server-only";
import { requireAdmin } from "@/app/lib/admin-access";
import { prisma } from "@/app/lib/prisma";

export type AdminCategoryValue = { name: string; count: number };

export async function getAdminCategoryInventory() {
  const access = await requireAdmin();
  if ("error" in access) {
    throw new Error("Accès administrateur requis pour consulter les catégories.");
  }

  const [requestGroups, equipmentGroups, professionalGroups] = await Promise.all([
    prisma.serviceRequest.groupBy({
      by: ["category"],
      where: { kind: { not: "MESSAGE" }, category: { not: "" } },
      _count: { _all: true },
      orderBy: { category: "asc" },
    }),
    prisma.equipment.groupBy({
      by: ["category"],
      where: { category: { not: "" } },
      _count: { _all: true },
      orderBy: { category: "asc" },
    }),
    prisma.user.groupBy({
      by: ["specialty"],
      where: { role: "PROFESSIONAL", specialty: { not: null } },
      _count: { _all: true },
      orderBy: { specialty: "asc" },
    }),
  ]);

  const values = (groups: { name: string | null; count: number }[]) =>
    groups
      .filter((group): group is { name: string; count: number } => Boolean(group.name?.trim()))
      .map(({ name, count }) => ({ name, count }));

  const requestCategories = values(requestGroups.map(({ category, _count }) => ({ name: category, count: _count._all })));
  const equipmentCategories = values(equipmentGroups.map(({ category, _count }) => ({ name: category, count: _count._all })));
  const professionalSpecialties = values(professionalGroups.map(({ specialty, _count }) => ({ name: specialty, count: _count._all })));
  const allNames = [requestCategories, equipmentCategories, professionalSpecialties].flatMap((items) => items.map(({ name }) => name));

  return {
    requestCategories,
    equipmentCategories,
    professionalSpecialties,
    stats: {
      distinctValues: new Set(allNames).size,
      classifiedRequests: requestCategories.reduce((sum, item) => sum + item.count, 0),
      classifiedEquipment: equipmentCategories.reduce((sum, item) => sum + item.count, 0),
      professionalsWithSpecialty: professionalSpecialties.reduce((sum, item) => sum + item.count, 0),
    },
  };
}
