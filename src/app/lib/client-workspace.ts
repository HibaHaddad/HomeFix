import "server-only";
import { prisma } from "./prisma";

export const requestInclude = {
  professional: { select: { id: true, name: true, businessName: true, specialty: true } },
  attachments: { where: { messageId: null }, select: { id: true, name: true, mime: true, size: true } },
  quotes: { orderBy: { createdAt: "desc" as const }, include: { invoice: true } },
  booking: true,
  events: { orderBy: { createdAt: "asc" as const } },
  review: { select: { id: true, rating: true, comment: true, published: true } },
} as const;

export async function clientWorkspace(clientId: number, before?: number) {
  const [requests, equipment, favorites, notifications, complaints, profile, activeCount, completedCount, quoteCount, appointmentCount] = await Promise.all([
    prisma.serviceRequest.findMany({ where: { clientId, ...(before ? { id: { lt: before } } : {}) }, include: requestInclude, orderBy: { id: "desc" }, take: 100 }),
    prisma.equipment.findMany({ where: { clientId }, include: { reminders: { orderBy: { dueAt: "asc" } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.favorite.findMany({ where: { clientId }, select: { professionalId: true, professional: { select: { id: true, name: true, businessName: true, specialty: true, status: true, isPublic: true, termsAccepted: true } } }, take: 100 }),
    prisma.clientNotification.findMany({ where: { userId: clientId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.complaint.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.user.findUniqueOrThrow({ where: { id: clientId }, select: { name: true, email: true, phone: true, address: true, city: true, notificationEnabled: true, profilePhotoMime: true } }),
    prisma.serviceRequest.count({ where: { clientId, status: { notIn: ["CANCELLED", "COMPLETED"] } } }),
    prisma.serviceRequest.count({ where: { clientId, status: "COMPLETED" } }),
    prisma.quote.count({ where: { request: { clientId }, status: "PENDING", validUntil: { gt: new Date() } } }),
    prisma.booking.count({ where: { request: { clientId }, status: "CONFIRMED", startsAt: { gte: new Date() } } }),
  ]);
  return { requests, olderCursor: requests.length === 100 ? requests[requests.length - 1].id : null, equipment, favorites, notifications, complaints, profile, stats: { activeCount, completedCount, quoteCount, appointmentCount }, aiEnabled: Boolean(process.env.HOMEFIX_AI_URL && process.env.HOMEFIX_AI_KEY && process.env.HOMEFIX_AI_MODEL) };
}
export type Workspace = Awaited<ReturnType<typeof clientWorkspace>>;
export type Serialized<T> = T extends Date ? string : T extends Array<infer U> ? Serialized<U>[] : T extends object ? { [K in keyof T]: Serialized<T[K]> } : T;
export type WorkspaceData = Serialized<Workspace>;
