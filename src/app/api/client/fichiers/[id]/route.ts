import { prisma } from "@/app/lib/prisma";
import { requestParticipant } from "@/app/lib/request-participant";
import { id } from "@/lib/client-domain";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  let fileId: number;
  try { fileId = id((await context.params).id); } catch { return new Response(null, { status: 404 }); }
  const metadata = await prisma.clientAttachment.findUnique({ where: { id: fileId }, select: { requestId: true } });
  if (!metadata || !await requestParticipant(metadata.requestId)) return new Response(null, { status: 404 });
  const file = await prisma.clientAttachment.findUniqueOrThrow({ where: { id: fileId } });
  return new Response(new Uint8Array(file.data), { headers: { "Content-Type": file.mime, "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox; default-src 'none'" } });
}
