import { prisma } from "@/app/lib/prisma";
import { requestParticipant } from "@/app/lib/request-participant";
import { id } from "@/lib/client-domain";
const maxSize = 8 * 1024 * 1024;
export async function POST(request: Request) {
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  if (Number(request.headers.get("content-length") || 0) > maxSize + 65536) return Response.json({ error: "Fichier limité à 8 Mo." }, { status: 413 });
  try {
    const form = await request.formData();
    const requestId = id(form.get("requestId"));
    const participant = await requestParticipant(requestId);
    if (!participant) return Response.json({ error: "Demande introuvable." }, { status: 404 });
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
      if (form.get("chat") === "true") {
        if (!participant.record.professionalId) throw new Error("Sélectionnez un professionnel avant de démarrer le chat.");
        const message = await tx.chatMessage.create({ data: { requestId, senderId: participant.actor.id, text: "Pièce jointe" } });
        messageId = message.id;
        const userId = participant.actor.role === "CLIENT" ? participant.record.professionalId : participant.record.clientId;
        const recipient = await tx.user.findUnique({ where: { id: userId }, select: { notificationEnabled: true, role: true } });
        if (recipient?.notificationEnabled) await tx.clientNotification.create({ data: { userId, title: "Nouvelle pièce jointe", href: `${recipient.role === "CLIENT" ? "/dashboard" : "/professionnel"}/messagerie?demande=${requestId}` } });
      } else if (participant.actor.role !== "CLIENT") throw new Error("Seul le client peut joindre des fichiers à sa demande.");
      return tx.clientAttachment.create({ data: { requestId, messageId, name: file.name.replace(/[\r\n\x00-\x1f]/g, "").slice(0, 180), mime, size: file.size, data: buffer }, select: { id: true, name: true } });
    }, { isolationLevel: "Serializable" });
    return Response.json(result, { status: 201 });
  } catch { return Response.json({ error: "Envoi impossible. Vérifiez le fichier et la limite de 20 fichiers par demande." }, { status: 400 }); }
}
