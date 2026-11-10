import { adminMutation } from "@/app/lib/admin-http";
import { prisma } from "@/app/lib/prisma";
import { audit } from "@/app/lib/admin-audit";
import { adminId, adminObject, adminText, AdminActionError } from "@/lib/admin-validation";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return adminMutation(request, async admin => {
    const id = adminId((await params).id);
    const body = adminObject(await request.json().catch(() => null), ["reason", "before"]);
    const reason = adminText(body.reason, "Motif de consultation", 10);
    const before = body.before === undefined ? undefined : adminId(String(body.before));
    const result = await prisma.$transaction(async tx => {
      const conversation = await tx.serviceRequest.findFirst({ where: { id, conversationId: null }, select: { id: true, kind: true, message: true, title: true, clientId: true, professionalId: true, client: { select: { name: true } }, professional: { select: { name: true, businessName: true } } } });
      if (!conversation) throw new AdminActionError("Conversation introuvable.", 404);
      const rows = await tx.chatMessage.findMany({ where: { request: { OR: [{ id }, { conversationId: id }] }, ...(before ? { id: { lt: before } } : {}) }, take: 51, orderBy: { id: "desc" }, select: { id: true, senderId: true, requestId: true, text: true, createdAt: true, attachments: { select: { name: true, mime: true, size: true } } } });
      const messages = rows.slice(0, 50);
      // Fail closed: the audit must commit before any private content is disclosed.
      await audit(tx, admin, "CONVERSATION_READ", `conversation:${id}`, reason, { before: before ?? null, messageIds: messages.map(m => m.id) });
      return { title: conversation.title, initialMessage: !before && conversation.kind === "MESSAGE" ? conversation.message : null, messages: messages.reverse().map(m => ({ ...m, sender: m.senderId === conversation.clientId ? conversation.client.name : m.senderId === conversation.professionalId ? conversation.professional.businessName || conversation.professional.name : "Participant" })), nextBefore: rows.length > 50 ? messages[0]?.id : null };
    });
    return Response.json(result, { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  });
}
