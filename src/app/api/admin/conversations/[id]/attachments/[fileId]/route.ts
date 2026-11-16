import { requireAdmin } from "@/app/lib/admin-access";
import { prisma } from "@/app/lib/prisma";
import { audit } from "@/app/lib/admin-audit";
import { adminId, AdminActionError } from "@/lib/admin-validation";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const access = await requireAdmin();
  if ("error" in access) return access.error;
  let id: number, fileId: number, accessId: number;
  try { const values = await params; id = adminId(values.id); fileId = adminId(values.fileId); accessId = adminId(new URL(request.url).searchParams.get("access") ?? ""); }
  catch { return new Response(null, { status: 404 }); }
  try {
    const file = await prisma.$transaction(async tx => {
      const grant = await tx.adminAuditLog.findFirst({ where: { id: accessId, actorId: access.admin.id, action: "CONVERSATION_READ", target: `conversation:${id}`, createdAt: { gte: new Date(Date.now() - 15 * 60000) } } });
      const details = grant?.details && typeof grant.details === "object" && !Array.isArray(grant.details) ? grant.details : null;
      if (!grant || !details || !Array.isArray(details.messageIds)) throw new AdminActionError("Actualisez la consultation avant d’ouvrir cette pièce jointe.", 403);
      const file = await tx.clientAttachment.findFirst({ where: { id: fileId, messageId: { in: details.messageIds.filter((value): value is number => typeof value === "number") }, request: { OR: [{ id }, { conversationId: id }] } } });
      if (!file) throw new AdminActionError("Pièce jointe introuvable.", 404);
      await audit(tx, access.admin, "DOCUMENT_READ", `conversation:${id}`, undefined, { attachmentId: fileId, accessId });
      return file;
    });
    const image = ["image/jpeg", "image/png", "image/webp"].includes(file.mime);
    return new Response(new Uint8Array(file.data), { headers: { "Content-Type": image ? file.mime : "application/octet-stream", "Content-Disposition": `${image ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Content-Security-Policy": "sandbox; default-src 'none'" } });
  } catch (error) {
    if (error instanceof AdminActionError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "Pièce jointe indisponible." }, { status: 503 });
  }
}
