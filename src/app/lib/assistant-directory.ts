import { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import { visibleProfessional } from "./professional-directory";
import { blockingBookingStatuses as occupiedBookingStatuses } from "@/lib/availability";
import { rankProfessional, describeAssistantMatch, assistantMatchTier, type AssistantProfessional } from "@/lib/assistant";
import { adjustedRating } from "@/lib/sanctions";

export async function hydrateProfessionals(ids: number[]): Promise<AssistantProfessional[]> {
  if (!ids.length) return [];
  const sanctions = await prisma.professionalSanction.groupBy({ by: ["professionalId"], where: { professionalId: { in: ids }, status: "APPLIED" }, _sum: { ratingHundredths: true } });
  const penalties = new Map(sanctions.map(row => [row.professionalId, row._sum.ratingHundredths ?? 0]));
  const categories = await prisma.serviceCategory.findMany({ where: { isActive: true }, select: { id: true, aliases: true } });
  const now = new Date();
  const horizon = new Date(+now + 30 * 86400000);
  const occupied = await prisma.booking.findMany({ where: { professionalId: { in: ids }, status: { in: occupiedBookingStatuses }, startsAt: { lt: horizon }, endsAt: { gt: now } }, select: { professionalId: true, startsAt: true, endsAt: true } });
  const people = await prisma.user.findMany({
    where: { ...visibleProfessional, id: { in: ids }, OR: [{ categoryId: { in: categories.map(category => category.id) } }, { categoryId: null, specialty: { in: categories.flatMap(category => category.aliases) } }] },
    select: { id: true, name: true, businessName: true, specialty: true, description: true,
      experience: true, experienceYears: true, serviceCity: true, coveredAreas: true, priceRange: true,
      priceMin: true, priceMax: true, availability: true, verifiedAt: true, profilePhotoMime: true,
      reviews: { where: { published: true }, select: { rating: true } },
      availabilitySlots: { where: { active: true, startsAt: { gt: now, lt: horizon } }, orderBy: { startsAt: "asc" }, select: { startsAt: true, endsAt: true } },
    },
  });
  return people.map(({ reviews, availabilitySlots, verifiedAt, profilePhotoMime, ...p }) => {
    const ratings = reviews.flatMap((r) => r.rating === null ? [] : [r.rating]);
    return { ...p, rating: adjustedRating(ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null, penalties.get(p.id) ?? 0),
      reviewCount: reviews.length, verified: !!verifiedAt, hasPhoto: !!profilePhotoMime,
      nextSlot: availabilitySlots.find((slot) => !occupied.some((b) => b.professionalId === p.id && b.startsAt < slot.endsAt && b.endsAt > slot.startsAt))?.startsAt.toISOString() ?? null, reasons: [] };
  });
}
export async function findAssistantProfessionals(input: { category: string; city: string; budget: number | null }) {
  if (!/^[\p{L}\p{M}\d .’'-]{2,100}$/u.test(input.city.trim())) return [];
  const category = await prisma.serviceCategory.findFirst({ where: { name: input.category, isActive: true } });
  if (!category) return [];
  // Specialty, approval and declared coverage are mandatory. Only budget
  // alternatives may remain, with the actual price difference clearly labelled.
  const ids = await prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
    SELECT "id" FROM "User" WHERE "role" = 'PROFESSIONAL' AND "status" = 'APPROVED'
    AND "isPublic" = true AND "termsAccepted" = true
    AND ("categoryId" = ${category.id} OR ("categoryId" IS NULL AND "specialty" IN (${Prisma.join(category.aliases.length ? category.aliases : [category.name])})))
  `);
  const people = (await hydrateProfessionals(ids.map((p) => p.id))).map((p) => describeAssistantMatch(p, input)).filter((p) => p.match?.locationConfirmed);
  const exact = people.filter((p) => assistantMatchTier(p) === 0);
  return (exact.length ? exact : people).sort((a, b) => assistantMatchTier(a) - assistantMatchTier(b) || rankProfessional(b, input.budget) - rankProfessional(a, input.budget) || a.id - b.id).slice(0, 4);
}
