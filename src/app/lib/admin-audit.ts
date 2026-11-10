import "server-only";
import { prisma } from "./prisma";
import type { Prisma } from "@/generated/prisma/client";

type Actor = { id: number; name: string };
export async function audit(tx: Prisma.TransactionClient, actor: Actor, action: string, target: string, reason?: string, details?: Prisma.InputJsonObject) {
  const event = await tx.adminAuditLog.create({ data: { actorId: actor.id, actorName: actor.name, action, target, reason, details: details ?? {} } });
  if (!["CONVERSATION_READ", "DOCUMENT_READ", "NOTIFICATIONS_READ"].includes(action)) {
    const admins = await tx.user.findMany({ where: { role: "ADMIN", isSuspended: false, id: { not: actor.id }, notificationEnabled: true }, select: { id: true } });
    if (admins.length) await tx.clientNotification.createMany({ data: admins.map(a => ({ userId: a.id, title: `${actor.name} · ${action} · ${target}`, type: "INFO", href: "/admin/activites" })) });
  }
  return event;
}
export function recordAudit(actor: Actor, action: string, target: string, reason?: string, details?: Prisma.InputJsonObject) {
  return prisma.$transaction(tx => audit(tx, actor, action, target, reason, details));
}
