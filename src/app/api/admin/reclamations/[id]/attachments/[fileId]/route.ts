import { requireAdmin } from "@/app/lib/admin-access";
import { prisma } from "@/app/lib/prisma";
import { adminId } from "@/lib/admin-validation";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const access = await requireAdmin();
  if ("error" in access) return access.error;
  let id: number, fileId: number;
  try { const values = await params; id = adminId(values.id); fileId = adminId(values.fileId); }
  catch { return new Response(null, { status: 404 }); }
  const complaint = await prisma.complaint.findUnique({ where: { id }, select: { requestId: true } });
  if (!complaint) return new Response(null, { status: 404 });
  const fromRequest = new URL(request.url).searchParams.get("source") === "intervention";
  const file = fromRequest
    ? complaint.requestId ? await prisma.clientAttachment.findFirst({ where: { id: fileId, requestId: complaint.requestId, messageId: null } }) : null
    : await prisma.complaintAttachment.findFirst({ where: { id: fileId, complaintId: id } });
  if (!file) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(file.data), { headers: {
    "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'",
  } });
}
