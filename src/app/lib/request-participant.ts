import "server-only";
import { getSession } from "./session";
import { prisma } from "./prisma";
export async function requestParticipant(requestId: number) {
  const session = await getSession();
  if (!session) return null;
  const actor = await prisma.user.findFirst({ where: { id: session.userId, OR: [{ role: "CLIENT", status: "ACTIVE" }, { role: "PROFESSIONAL", status: "APPROVED" }] }, select: { id: true, role: true } });
  if (!actor) return null;
  const record = await prisma.serviceRequest.findFirst({ where: { id: requestId, ...(actor.role === "CLIENT" ? { clientId: actor.id } : { professionalId: actor.id }) }, select: { id: true, status: true, clientId: true, professionalId: true } });
  return record ? { actor, record } : null;
}
