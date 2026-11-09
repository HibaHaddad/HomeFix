import { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import { visibleProfessional } from "./professional-directory";
import { blockingBookingStatuses as occupiedBookingStatuses } from "@/lib/availability";
import { normalize, rankProfessional, describeAssistantMatch, assistantMatchTier, type AssistantProfessional } from "@/lib/assistant";

const aliases: Record<string, string[]> = {
  Plomberie: ["plomb"], "Électricité": ["electri"], Climatisation: ["clim", "frigor"],
  Chauffage: ["chauff", "gaz"], Serrurerie: ["serrur"], Maçonnerie: ["macon"],
  Peinture: ["peint"], Menuiserie: ["menuis"], Nettoyage: ["nettoy", "menage"], "Électroménager": ["electromenager"],
};
export async function hydrateProfessionals(ids: number[]): Promise<AssistantProfessional[]> {
  if (!ids.length) return [];
  const now = new Date();
  const horizon = new Date(+now + 30 * 86400000);
  const occupied = await prisma.booking.findMany({ where: { professionalId: { in: ids }, status: { in: occupiedBookingStatuses }, startsAt: { lt: horizon }, endsAt: { gt: now } }, select: { professionalId: true, startsAt: true, endsAt: true } });
  const people = await prisma.user.findMany({
    where: { ...visibleProfessional, id: { in: ids } },
    select: { id: true, name: true, businessName: true, specialty: true, description: true,
      experience: true, experienceYears: true, serviceCity: true, coveredAreas: true, priceRange: true,
      priceMin: true, priceMax: true, availability: true, verifiedAt: true, profilePhotoMime: true,
      reviews: { where: { published: true }, select: { rating: true } },
      availabilitySlots: { where: { active: true, startsAt: { gt: now, lt: horizon } }, orderBy: { startsAt: "asc" }, select: { startsAt: true, endsAt: true } },
    },
  });
  return people.map(({ reviews, availabilitySlots, verifiedAt, profilePhotoMime, ...p }) => {
    const ratings = reviews.flatMap((r) => r.rating === null ? [] : [r.rating]);
    return { ...p, rating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
      reviewCount: reviews.length, verified: !!verifiedAt, hasPhoto: !!profilePhotoMime,
      nextSlot: availabilitySlots.find((slot) => !occupied.some((b) => b.professionalId === p.id && b.startsAt < slot.endsAt && b.endsAt > slot.startsAt))?.startsAt.toISOString() ?? null, reasons: [] };
  });
}
export async function findAssistantProfessionals(input: { category: string; city: string; budget: number | null }) {
  if (!/^[\p{L}\p{M}\d .’'-]{2,100}$/u.test(input.city.trim())) return [];
  const specialties = aliases[input.category] ?? [normalize(input.category)];
  const conditions = specialties.map((s) => Prisma.sql`translate(lower("specialty"), 'àâäéèêëîïôöùûüç', 'aaaeeeeiioouuuc') LIKE ${`%${s}%`}`);
  // Specialty, approval and declared coverage are mandatory. Only budget
  // alternatives may remain, with the actual price difference clearly labelled.
  const ids = await prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
    SELECT "id" FROM "User" WHERE "role" = 'PROFESSIONAL' AND "status" = 'APPROVED'
    AND "isPublic" = true AND "termsAccepted" = true
    AND (${Prisma.join(conditions, " OR ")})
  `);
  const people = (await hydrateProfessionals(ids.map((p) => p.id))).map((p) => describeAssistantMatch(p, input)).filter((p) => p.match?.locationConfirmed);
  const exact = people.filter((p) => assistantMatchTier(p) === 0);
  return (exact.length ? exact : people).sort((a, b) => assistantMatchTier(a) - assistantMatchTier(b) || rankProfessional(b, input.budget) - rankProfessional(a, input.budget) || a.id - b.id).slice(0, 4);
}
