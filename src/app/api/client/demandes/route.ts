import { getClient } from "@/app/lib/client-access";
import { prisma } from "@/app/lib/prisma";
import { visibleProfessional } from "@/app/lib/professional-directory";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  const client = await getClient();
  if (!client) return Response.json({ error: "Connexion client requise." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || !Number.isSafeInteger(body.professionalId) || body.professionalId < 1 || !["MESSAGE", "QUOTE"].includes(body.kind) || typeof body.message !== "string" || body.message.trim().length < 20 || body.message.trim().length > 3000) {
    return Response.json({ error: "Décrivez votre demande en 20 à 3 000 caractères." }, { status: 400 });
  }
  const professional = await prisma.user.findFirst({ where: { ...visibleProfessional, id: body.professionalId }, select: { id: true } });
  if (!professional) return Response.json({ error: "Ce professionnel n’est plus disponible." }, { status: 404 });
  const recent = await prisma.serviceRequest.findFirst({ where: { clientId: client.id, createdAt: { gte: new Date(Date.now() - 30000) } }, select: { id: true } });
  if (recent) return Response.json({ error: "Votre dernière demande vient d’être envoyée. Patientez quelques instants avant un nouvel envoi." }, { status: 429 });
  const result = await prisma.$transaction(async (tx) => {
    const record = await tx.serviceRequest.create({ data: { clientId: client.id, professionalId: professional.id, kind: body.kind, title: body.message.trim().slice(0, 100), message: body.message.trim() }, select: { id: true } });
    await tx.requestEvent.create({ data: { requestId: record.id, actorId: client.id, status: "SENT", description: "Demande transmise au professionnel" } });
    const recipient = await tx.user.findUnique({ where: { id: professional.id }, select: { notificationEnabled: true } });
    if (recipient?.notificationEnabled) await tx.clientNotification.create({ data: { userId: professional.id, title: "Nouvelle demande client", href: `/professionnel/messagerie?demande=${record.id}` } });
    return record;
  });
  return Response.json({ id: result.id, message: "Votre demande a été transmise au professionnel. Il retrouvera vos coordonnées pour vous répondre." }, { status: 201 });
}
