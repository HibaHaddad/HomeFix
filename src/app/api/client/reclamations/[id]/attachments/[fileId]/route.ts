import { getClient } from "@/app/lib/client-access";
import { prisma } from "@/app/lib/prisma";
import { id as validId } from "@/lib/client-domain";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const client = await getClient();
  if (!client) return new Response(null, { status: 401 });
  let id: number, fileId: number;
  try { const values = await params; id = validId(values.id); fileId = validId(values.fileId); } catch { return new Response(null, { status: 404 }); }
  const file = await prisma.complaintAttachment.findFirst({ where: { id: fileId, complaintId: id, complaint: { clientId: client.id } } });
  if (!file) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(file.data), { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store", "Content-Security-Policy": "sandbox; default-src 'none'" } });
}
