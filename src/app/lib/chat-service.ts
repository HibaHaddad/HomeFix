import { prisma } from "./prisma";
import { chatServer, userRoom } from "./chat-events";

export const messageSelect = { id: true, requestId: true, senderId: true, clientNonce: true, text: true, latitude: true, longitude: true, deliveredAt: true, readAt: true, createdAt: true, attachments: { select: { id: true, name: true, mime: true, size: true } }, quote: { select: { id: true, requestId: true, amountMillimes: true, status: true, validUntil: true, request: { select: { status: true, booking: { select: { status: true, startsAt: true, endsAt: true } } } } } } } as const;
export async function chatParticipant(userId: number, requestId: number) {
  if (!Number.isSafeInteger(requestId) || requestId < 1) throw new Error("Conversation invalide.");
  const actor = await prisma.user.findFirst({ where: { id: userId, OR: [{ role: "CLIENT", status: "ACTIVE" }, { role: "PROFESSIONAL", status: "APPROVED" }] }, select: { id: true, role: true } });
  if (!actor) throw new Error("Connexion requise.");
  const record = await prisma.serviceRequest.findFirst({ where: { id: requestId, OR: [{ clientId: userId }, { professionalId: userId }] }, select: { id: true, clientId: true, professionalId: true, status: true, conversationId: true } });
  if (!record || record.conversationId) throw new Error("Conversation introuvable.");
  return { actor, record, peerId: record.clientId === userId ? record.professionalId : record.clientId };
}
async function broadcastMessage(messageId: number, event: string) {
  const message = await prisma.chatMessage.findUniqueOrThrow({ where: { id: messageId }, select: messageSelect });
  const thread = await prisma.serviceRequest.findUniqueOrThrow({ where: { id: message.requestId }, select: { clientId: true, professionalId: true } });
  chatServer()?.to([userRoom(thread.clientId), userRoom(thread.professionalId)]).emit(event, JSON.parse(JSON.stringify(message)));
  return message;
}
export const publishMessage = (messageId: number) => broadcastMessage(messageId, "chat:message");
export const publishMessageUpdate = (messageId: number) => broadcastMessage(messageId, "chat:message-updated");
export async function sendChatMessage(userId: number, input: { requestId: number; nonce: string; text: string; latitude?: number; longitude?: number }) {
  const { record, peerId, actor } = await chatParticipant(userId, input.requestId);
  if (record.status === "CANCELLED") throw new Error("Conversation annulée.");
  if (typeof input.nonce !== "string" || !/^[\w-]{16,80}$/.test(input.nonce)) throw new Error("Identifiant invalide.");
  if (typeof input.text !== "string" || input.text.trim().length > 3000) throw new Error("Message invalide.");
  const gps = input.latitude !== undefined || input.longitude !== undefined;
  if (gps && (actor.role !== "CLIENT" || !Number.isFinite(input.latitude) || !Number.isFinite(input.longitude) || Math.abs(input.latitude!) > 90 || Math.abs(input.longitude!) > 180)) throw new Error("Position invalide.");
  if (!input.text.trim() && !gps) throw new Error("Message vide.");
  const clientNonce = `${userId}-${input.nonce}`;
  const previous = await prisma.chatMessage.findUnique({ where: { clientNonce } });
  if (previous) {
    if (previous.requestId !== record.id) throw new Error("Identifiant déjà utilisé.");
    return publishMessage(previous.id);
  }
  const message = await prisma.$transaction(async (tx) => {
    const result = await tx.chatMessage.upsert({ where: { clientNonce }, update: {}, create: { requestId: record.id, senderId: userId, clientNonce, text: input.text.trim(), ...(gps ? { latitude: input.latitude, longitude: input.longitude } : {}) } });
    await tx.serviceRequest.update({ where: { id: record.id }, data: { updatedAt: new Date() } });
    const recipient = await tx.user.findUniqueOrThrow({ where: { id: peerId }, select: { role: true, notificationEnabled: true } });
    if (recipient.notificationEnabled) await tx.clientNotification.create({ data: { userId: peerId, type: "MESSAGE", title: "Nouveau message dans votre conversation", href: `${recipient.role === "CLIENT" ? "/dashboard" : "/professionnel"}/messagerie?demande=${record.id}` } });
    return result;
  });
  return publishMessage(message.id);
}
export async function receipt(userId: number, requestId: number, ids: number[], read: boolean) {
  const { record } = await chatParticipant(userId, requestId);
  if (!Array.isArray(ids) || ids.length > 200 || ids.some((id) => !Number.isSafeInteger(id) || id < 1)) throw new Error("Accusé invalide.");
  const now = new Date();
  const where = { requestId, id: { in: ids }, senderId: { not: userId } };
  await prisma.chatMessage.updateMany({ where: { ...where, deliveredAt: null }, data: { deliveredAt: now } });
  if (read) await prisma.chatMessage.updateMany({ where: { ...where, readAt: null }, data: { readAt: now } });
  const updated = await prisma.chatMessage.findMany({ where, select: { id: true, deliveredAt: true, readAt: true } });
  chatServer()?.to([userRoom(record.clientId), userRoom(record.professionalId)]).emit("chat:receipts", { requestId, messages: updated });
}
