import "server-only";
import { prisma } from "./prisma";
import type { Prisma } from "@/generated/prisma/client";
import { normalizeCategoryName } from "@/lib/service-categories";

export async function activeServiceCategories(db: Prisma.TransactionClient = prisma) {
  return db.serviceCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, description: true, icon: true } });
}

export async function resolveServiceCategory(name: string, db: Prisma.TransactionClient = prisma) {
  return db.serviceCategory.findFirst({ where: { OR: [{ normalizedName: normalizeCategoryName(name) }, { aliases: { has: name } }] } });
}
