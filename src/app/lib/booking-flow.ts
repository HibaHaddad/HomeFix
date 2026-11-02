import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { id } from "@/lib/client-domain";
import { blockingBookingStatuses, HOUR_MS } from "@/lib/availability";

export const occupiedBookingStatuses = blockingBookingStatuses;
export async function availableSlot(tx: Prisma.TransactionClient, professionalId: number, value: unknown, excludeRequestId?: number) {
  const slotId = id(value);
  // An edited schedule retires the original slot without changing a reservation.
  const existing = excludeRequestId ? await tx.booking.findFirst({ where: { requestId: excludeRequestId, professionalId, slotId, status: { in: occupiedBookingStatuses } } }) : null;
  const published = await tx.availabilitySlot.findFirst({ where: { id: slotId, professionalId, active: true, startsAt: { gt: new Date() } } });
  const slot = existing && +existing.startsAt > Date.now() ? { id: slotId, professionalId, startsAt: existing.startsAt, endsAt: existing.endsAt } : published;
  if (!slot) throw new Error("Ce créneau n’est plus disponible. Choisissez une disponibilité publiée par le professionnel.");
  if (!existing && +slot.endsAt - +slot.startsAt !== HOUR_MS) throw new Error("Choisissez un créneau réservable d’une heure.");
  const conflict = await tx.booking.findFirst({ where: { professionalId, ...(excludeRequestId ? { requestId: { not: excludeRequestId } } : {}), status: { in: occupiedBookingStatuses }, startsAt: { lt: slot.endsAt }, endsAt: { gt: slot.startsAt } }, select: { id: true } });
  if (conflict) throw new Error("Ce créneau vient d’être réservé. Choisissez une autre disponibilité.");
  return slot;
}
