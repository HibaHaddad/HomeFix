import { hasAllowedRequestOrigin } from "@/lib/request-origin";
import { requestInclude } from "@/app/lib/client-workspace";
import { prisma } from "@/app/lib/prisma";
import { requestParticipant } from "@/app/lib/request-participant";
import { id } from "@/lib/client-domain";
import { messageSelect } from "@/app/lib/chat-service";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  let requestId: number;
  try { requestId = id((await context.params).id); } catch { return Response.json({ error: "Introuvable." }, { status: 404 }); }
  const participant = await requestParticipant(requestId);
  if (!participant) return Response.json({ error: "Conversation introuvable." }, { status: 404 });
  const after = Number(new URL(request.url).searchParams.get("after") || 0);
  if (!Number.isSafeInteger(after) || after < 0) return Response.json({ error: "Curseur invalide." }, { status: 400 });
  const messages = await prisma.chatMessage.findMany({ where: { requestId, id: { gt: after } }, orderBy: { id: "asc" }, take: 100, select: messageSelect });
  const interventions = await prisma.serviceRequest.findMany({ where: { OR: [{ conversationId: requestId }, { id: requestId, kind: { not: "MESSAGE" } }] }, include: requestInclude, orderBy: { id: "desc" }, take: 100 });
  return Response.json({ messages, interventions, actorId: participant.actor.id }, { headers: { "Cache-Control": "private, no-store" } });
}
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasAllowedRequestOrigin(request)) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  let requestId: number;
  try { requestId = id((await context.params).id); } catch { return Response.json({ error: "Introuvable." }, { status: 404 }); }
  const participant = await requestParticipant(requestId);
  if (!participant) return Response.json({ error: "Conversation introuvable." }, { status: 404 });
  return Response.json({ error: "Les accusés de lecture passent par la conversation Socket.IO ouverte." }, { status: 405 });
}
