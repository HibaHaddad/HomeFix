import { prisma } from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";
import { visibleProfessional } from "@/app/lib/professional-directory";
import { occupiedBookingStatuses } from "@/app/lib/booking-flow";
import { id } from "@/lib/client-domain";
import { monthBounds, tunisDay } from "@/lib/availability";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Connexion requise." }, { status: 401 });
  const actor = await prisma.user.findFirst({ where: { id: session.userId, OR: [{ role: "CLIENT", status: "ACTIVE" }, { role: "PROFESSIONAL", status: "APPROVED" }] }, select: { id: true, role: true } });
  if (!actor) return Response.json({ error: "Accès non autorisé." }, { status: 403 });
  let professionalId: number;
  try { professionalId = id((await context.params).id); } catch { return Response.json({ error: "Professionnel introuvable." }, { status: 404 }); }
  if (actor.role === "PROFESSIONAL" && actor.id !== professionalId) return Response.json({ error: "Accès non autorisé." }, { status: 403 });
  if (actor.role === "CLIENT" && !await prisma.user.findFirst({ where: { ...visibleProfessional, id: professionalId }, select: { id: true } })) return Response.json({ error: "Professionnel indisponible." }, { status: 404 });
  const month = new URL(request.url).searchParams.get("month") || tunisDay(new Date()).slice(0, 7);
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) return Response.json({ error: "Mois invalide." }, { status: 400 });
  const { from, until } = monthBounds(month);
  const [slots, occupied] = await prisma.$transaction([
    prisma.availabilitySlot.findMany({ where: { professionalId, active: true, startsAt: { gte: new Date(Math.max(+from, Date.now())), lt: until } }, select: { id: true, startsAt: true, endsAt: true }, orderBy: { startsAt: "asc" }, take: 1000 }),
    prisma.booking.findMany({ where: { professionalId, status: { in: occupiedBookingStatuses }, startsAt: { lt: until }, endsAt: { gt: from } }, select: { startsAt: true, endsAt: true } }),
  ], { isolationLevel: "RepeatableRead" });
  return Response.json({ slots: slots.filter((slot) => !occupied.some((b) => b.startsAt < slot.endsAt && b.endsAt > slot.startsAt)) }, { headers: { "Cache-Control": "private, no-store" } });
}
