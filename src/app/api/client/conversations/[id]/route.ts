import { prisma } from "@/app/lib/prisma";
import { requestParticipant } from "@/app/lib/request-participant";
import { id } from "@/lib/client-domain";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  let requestId: number;
  try { requestId = id((await context.params).id); } catch { return Response.json({ error: "Introuvable." }, { status: 404 }); }
  const participant = await requestParticipant(requestId);
  if (!participant) return Response.json({ error: "Conversation introuvable." }, { status: 404 });
  const after = Number(new URL(request.url).searchParams.get("after") || 0);
  if (!Number.isSafeInteger(after) || after < 0) return Response.json({ error: "Curseur invalide." }, { status: 400 });
  const messages = await prisma.chatMessage.findMany({ where: { requestId, id: { gt: after } }, orderBy: { id: "asc" }, take: 100, select: { id: true, senderId: true, text: true, latitude: true, longitude: true, readAt: true, createdAt: true, attachments: { select: { id: true, name: true, mime: true, size: true } } } });
  return Response.json({ messages, actorId: participant.actor.id }, { headers: { "Cache-Control": "private, no-store" } });
}
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  let requestId: number;
  try { requestId = id((await context.params).id); } catch { return Response.json({ error: "Introuvable." }, { status: 404 }); }
  const participant = await requestParticipant(requestId);
  if (!participant) return Response.json({ error: "Conversation introuvable." }, { status: 404 });
  await prisma.chatMessage.updateMany({ where: { requestId, senderId: { not: participant.actor.id }, readAt: null }, data: { readAt: new Date() } });
  return Response.json({ ok: true });
}
