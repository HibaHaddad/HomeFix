import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import { chatServer, userRoom } from "./chat-events";
import { validateSupportComplaint, SupportComplaintError, SUPPORT_FILE_LIMIT, SUPPORT_TOTAL_LIMIT } from "@/lib/support-complaints";
import { detectSanctions } from "./sanctions";

export type SupportFile = { name: string; mime: string; data: Uint8Array<ArrayBuffer> };
export async function supportFiles(files: File[]): Promise<SupportFile[]> {
  if (files.length > 3 || files.reduce((sum, file) => sum + file.size, 0) > SUPPORT_TOTAL_LIMIT) throw new SupportComplaintError("Joignez au maximum 3 fichiers, pour un total de 10 Mo.");
  return Promise.all(files.map(async file => {
    if (file.size === 0 || file.size > SUPPORT_FILE_LIMIT) throw new SupportComplaintError("Chaque fichier doit contenir des données et ne pas dépasser 5 Mo.");
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = new TextDecoder().decode(data.slice(0, 5)) === "%PDF-";
    const png = [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => data[index] === byte);
    const jpg = data[0] === 255 && data[1] === 216 && data[2] === 255;
    const mime = pdf && /\.pdf$/i.test(file.name) ? "application/pdf" : png && /\.png$/i.test(file.name) ? "image/png" : jpg && /\.jpe?g$/i.test(file.name) ? "image/jpeg" : null;
    if (!mime) throw new SupportComplaintError("Formats autorisés : PDF, JPG et PNG. Le contenu doit correspondre au fichier.");
    return { name: file.name.replace(/[\u0000-\u001f\u007f/\\]/g, "_").slice(0, 160), mime, data };
  }));
}

export async function storeClientComplaint(tx: Prisma.TransactionClient, clientId: number, value: unknown, files: SupportFile[] = []) {
  const input = validateSupportComplaint(value);
  const client = await tx.user.findFirst({ where: { id: clientId, role: "CLIENT", status: "ACTIVE", isSuspended: false }, select: { name: true } });
  if (!client) throw new SupportComplaintError("Connexion client requise.", 403);
  if (input.requestId && !await tx.serviceRequest.findFirst({ where: { id: input.requestId, clientId, kind: { not: "MESSAGE" } }, select: { id: true } })) throw new SupportComplaintError("Cette intervention ne vous appartient pas ou n’est pas disponible.", 404);
  if (await tx.complaint.count({ where: { clientId, createdAt: { gte: new Date(Date.now() - 60000) } } }) >= 5) throw new SupportComplaintError("Veuillez patienter une minute avant d’envoyer une nouvelle demande.", 429);
  const complaint = await tx.complaint.create({ data: { clientId, ...input, attachments: { create: files.map(file => ({ name: file.name, mime: file.mime, size: file.data.byteLength, data: file.data })) } }, select: { id: true } });
  const admins = await tx.user.findMany({ where: { role: "ADMIN", isSuspended: false, notificationEnabled: true }, select: { id: true } });
  const notifications = admins.length ? await tx.clientNotification.createManyAndReturn({ data: admins.map(admin => ({ userId: admin.id, title: `Nouvelle réclamation de ${client.name} · ${input.subject}`, type: "INFO", href: `/admin/reclamations/${complaint.id}` })), select: { id: true, userId: true, title: true, href: true, type: true, createdAt: true } }) : [];
  return { complaint, notifications };
}

export async function createClientComplaint(clientId: number, input: unknown, files: SupportFile[]) {
  const result = await prisma.$transaction(tx => storeClientComplaint(tx, clientId, input, files), { isolationLevel: "Serializable" });
  for (const notification of result.notifications) chatServer()?.to(userRoom(notification.userId)).emit("notification:new", { ...notification, createdAt: notification.createdAt.toISOString() });
  const complaint = await prisma.complaint.findUnique({ where: { id: result.complaint.id }, select: { requestId: true } });
  if (complaint?.requestId) { try { await detectSanctions(complaint.requestId); } catch (error) { console.error("Sanction detection deferred", error instanceof Error ? error.name : "Unknown"); } }
  return result.complaint;
}

export async function clientComplaintHistory(clientId: number, before?: number, selected?: number) {
  const select = { id: true, subject: true, message: true, status: true, response: true, createdAt: true, updatedAt: true, request: { select: { title: true, professional: { select: { name: true, businessName: true } } } }, attachments: { select: { id: true, name: true, size: true } } } as const;
  const items = await prisma.complaint.findMany({ where: { clientId, ...(before ? { id: { lt: before } } : {}) }, orderBy: { id: "desc" }, take: 21, select });
  const hasMore = items.length > 20;
  if (hasMore) items.pop();
  const nextCursor = hasMore ? items[items.length - 1].id : null;
  if (selected && !items.some(item => item.id === selected)) {
    const item = await prisma.complaint.findFirst({ where: { id: selected, clientId }, select });
    if (item) items.unshift(item);
  }
  return { items, nextCursor };
}
