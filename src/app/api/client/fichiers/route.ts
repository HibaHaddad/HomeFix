import { hasAllowedRequestOrigin } from "@/lib/request-origin";
import { prisma } from "@/app/lib/prisma";
import { requestParticipant } from "@/app/lib/request-participant";
import { id } from "@/lib/client-domain";
import { publishMessage } from "@/app/lib/chat-service";
const maxSize = 8 * 1024 * 1024;
export async function POST(request: Request) {
  if (!hasAllowedRequestOrigin(request)) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  if (Number(request.headers.get("content-length") || 0) > maxSize + 65536) return Response.json({ error: "Fichier limité à 8 Mo." }, { status: 413 });
  try {
    const form = await request.formData();
    const requestId = id(form.get("requestId"));
    const participant = await requestParticipant(requestId);
    if (!participant) return Response.json({ error: "Demande introuvable." }, { status: 404 });
    const isChat = form.get("chat") === "true";
    const nonce = form.get("nonce");
    if (isChat && (typeof nonce !== "string" || !/^[\w-]{16,80}$/.test(nonce))) return Response.json({ error: "Identifiant d’envoi invalide." }, { status: 400 });
    const clientNonce = isChat ? `${participant.actor.id}-${nonce}` : null;
    const threadId = participant.record.conversationId ?? requestId;
    if (clientNonce) {
      const previous = await prisma.chatMessage.findUnique({ where: { clientNonce }, include: { attachments: { select: { id: true, name: true } } } });
      if (previous) {
        if (previous.requestId !== threadId || !previous.attachments.length) return Response.json({ error: "Identifiant déjà utilisé." }, { status: 409 });
        await publishMessage(previous.id);
        return Response.json(previous.attachments[0]);
      }
    }
    if (participant.record.status === "CANCELLED") return Response.json({ error: "Demande annulée." }, { status: 409 });
    const file = form.get("file");
    if (!(file instanceof File) || file.size < 1 || file.size > maxSize) return Response.json({ error: "Fichier limité à 8 Mo." }, { status: 400 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const isJpeg = buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
    const isPng = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isWebp = buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
    const isPdf = buffer.toString("ascii", 0, 5) === "%PDF-";
    const isMp4 = buffer.toString("ascii", 4, 8) === "ftyp";
    const mime = isJpeg ? "image/jpeg" : isPng ? "image/png" : isWebp ? "image/webp" : isPdf ? "application/pdf" : isMp4 ? "video/mp4" : null;
    if (!mime || mime !== file.type) return Response.json({ error: "Formats autorisés : JPEG, PNG, WebP, PDF et MP4." }, { status: 400 });
    const result = await prisma.$transaction(async (tx) => {
      const count = await tx.clientAttachment.count({ where: { requestId } });
      if (count >= 20) throw new Error("20 fichiers maximum par demande.");
      let messageId: number | null = null;
      if (isChat) {
        if (!participant.record.professionalId) throw new Error("Sélectionnez un professionnel avant de démarrer le chat.");
        const caption = String(form.get("text") || "Photo partagée").trim();
        if (caption.length > 3000) throw new Error("Message trop long.");
        const message = await tx.chatMessage.create({ data: { requestId: threadId, senderId: participant.actor.id, clientNonce, text: caption || "Photo partagée" } });
        messageId = message.id;
        await tx.serviceRequest.update({ where: { id: threadId }, data: { updatedAt: new Date() } });
        const userId = participant.actor.role === "CLIENT" ? participant.record.professionalId : participant.record.clientId;
        const recipient = await tx.user.findUnique({ where: { id: userId }, select: { notificationEnabled: true, role: true } });
        if (recipient?.notificationEnabled) await tx.clientNotification.create({ data: { userId, type: "ATTACHMENT", title: "Nouvelle pièce jointe", href: `${recipient.role === "CLIENT" ? "/dashboard" : "/professionnel"}/messagerie?demande=${requestId}` } });
      } else if (participant.actor.role !== "CLIENT") throw new Error("Seul le client peut joindre des fichiers à sa demande.");
      return tx.clientAttachment.create({ data: { requestId: isChat ? threadId : requestId, messageId, name: file.name.replace(/[\r\n\x00-\x1f]/g, "").slice(0, 180), mime, size: file.size, data: buffer }, select: { id: true, name: true, messageId: true } });
    }, { isolationLevel: "Serializable" });
    if (result.messageId) await publishMessage(result.messageId);
    return Response.json(result, { status: 201 });
  } catch { return Response.json({ error: "Envoi impossible. Vérifiez le fichier et la limite de 20 fichiers par demande." }, { status: 400 }); }
}
