import { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import type { DirectoryFilters } from "@/lib/directory-filters";
import { normalizeSearchTerm } from "@/lib/directory-filters";

export const visibleProfessional = { role: "PROFESSIONAL", status: "APPROVED", isPublic: true, termsAccepted: true } as const;
export type DirectoryProfessional = {
  id: number; name: string; businessName: string | null; specialty: string | null;
  description: string | null; experience: string | null; experienceYears: number | null;
  serviceCity: string | null; coveredAreas: string | null; priceRange: string | null;
  priceMin: number | null; priceMax: number | null; availability: string | null;
  verified: boolean; hasPhoto: boolean; rating: number | null; reviewCount: number;
};
export type DirectoryResponse = {
  professionals: DirectoryProfessional[]; total: number; page: number; pageSize: number;
  specialties: string[]; locations: string[];
};

const base = Prisma.sql`
  WITH directory AS (
    SELECT u."id", u."name", u."businessName", u."specialty", u."description", u."experience",
      u."experienceYears", u."serviceCity", u."coveredAreas", u."priceRange", u."priceMin", u."priceMax",
      u."availability", u."createdAt", (u."verifiedAt" IS NOT NULL) AS "verified",
      (u."profilePhotoMime" IS NOT NULL) AS "hasPhoto", r."rating", COALESCE(r."reviewCount", 0)::int AS "reviewCount"
    FROM "User" u
    LEFT JOIN (
      SELECT "professionalId", AVG("rating")::float8 AS "rating", COUNT(*)::int AS "reviewCount"
      FROM "ProfessionalReview" WHERE "published" = true GROUP BY "professionalId"
    ) r ON r."professionalId" = u."id"
    WHERE u."role" = 'PROFESSIONAL' AND u."status" = 'APPROVED' AND u."isPublic" = true AND u."termsAccepted" = true
  )`;

export async function searchProfessionals(filters: DirectoryFilters): Promise<DirectoryResponse> {
  const conditions: Prisma.Sql[] = [Prisma.sql`true`];
  const pattern = (value: string) => `%${value.replace(/[\\%_]/g, "\\$&")}%`;
  for (const word of filters.q.split(/\s+/).filter(Boolean)) {
    conditions.push(Prisma.sql`translate(lower(concat_ws(' ', "name", "businessName", "specialty", "description")), 'àâäéèêëîïôöùûüç', 'aaaeeeeiioouuuc') LIKE ${pattern(normalizeSearchTerm(word))}`);
  }
  if (filters.specialty) conditions.push(Prisma.sql`"specialty" ILIKE ${pattern(filters.specialty)}`);
  if (filters.location) conditions.push(Prisma.sql`concat_ws(' ', "serviceCity", "coveredAreas") ILIKE ${pattern(filters.location)}`);
  if (filters.minExperience !== null) conditions.push(Prisma.sql`"experienceYears" >= ${filters.minExperience}`);
  if (filters.maxExperience !== null) conditions.push(Prisma.sql`"experienceYears" <= ${filters.maxExperience}`);
  if (filters.minRating !== null) conditions.push(Prisma.sql`"rating" >= ${filters.minRating}`);
  if (filters.minPrice !== null) conditions.push(Prisma.sql`COALESCE("priceMax", "priceMin") >= ${filters.minPrice}`);
  if (filters.maxPrice !== null) conditions.push(Prisma.sql`"priceMin" <= ${filters.maxPrice}`);
  if (filters.availability) conditions.push(Prisma.sql`"availability" = ${filters.availability}`);
  if (filters.verified) conditions.push(Prisma.sql`"verified" = true`);
  const order = {
    recent: Prisma.sql`"createdAt" DESC`, rating: Prisma.sql`"rating" DESC NULLS LAST`,
    experience: Prisma.sql`"experienceYears" DESC NULLS LAST`,
    price_asc: Prisma.sql`"priceMin" ASC NULLS LAST`, price_desc: Prisma.sql`"priceMin" DESC NULLS LAST`,
  }[filters.sort] ?? Prisma.sql`"createdAt" DESC`;
  const where = Prisma.join(conditions, " AND ");
  const pageSize = 9;
  return prisma.$transaction(async (tx) => {
    const counts = await tx.$queryRaw<{ total: number }[]>(Prisma.sql`${base} SELECT COUNT(*)::int AS total FROM directory WHERE ${where}`);
    const total = counts[0].total;
    const page = Math.min(filters.page, Math.max(1, Math.ceil(total / pageSize)));
    const professionals = await tx.$queryRaw<DirectoryProfessional[]>(Prisma.sql`
      ${base} SELECT "id", "name", "businessName", "specialty", "description", "experience", "experienceYears",
      "serviceCity", "coveredAreas", "priceRange", "priceMin", "priceMax", "availability", "verified", "hasPhoto", "rating", "reviewCount"
      FROM directory WHERE ${where} ORDER BY ${order}, "id" DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`);
    const facets = await tx.$queryRaw<{ specialties: string[]; locations: string[] }[]>(Prisma.sql`
      ${base} SELECT
      ARRAY(SELECT DISTINCT "specialty" FROM directory WHERE "specialty" IS NOT NULL AND "specialty" <> '' ORDER BY "specialty") AS specialties,
      ARRAY(SELECT DISTINCT "serviceCity" FROM directory WHERE "serviceCity" IS NOT NULL AND "serviceCity" <> '' ORDER BY "serviceCity") AS locations`);
    return { professionals, total, page, pageSize,
      specialties: facets[0].specialties, locations: facets[0].locations,
    };
  }, { isolationLevel: "RepeatableRead" });
}
