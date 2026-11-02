import { hasAllowedRequestOrigin } from "@/lib/request-origin";
import { workflowErrorResponse } from "@/app/lib/workflow-response";
import { getSession } from "@/app/lib/session";
import { prisma } from "@/app/lib/prisma";
import { mutateWorkspace } from "@/app/lib/workspace-mutations";
import { requestInclude } from "@/app/lib/client-workspace";
import { monthBounds } from "@/lib/availability";

export async function GET(request: Request) {
  const session = await getSession();
  const actor = session && await prisma.user.findFirst({ where: { id: session.userId, role: "PROFESSIONAL", status: "APPROVED" }, select: { id: true } });
  if (!actor) return Response.json({ error: "Professionnel approuvé requis." }, { status: 401 });
  const month = new URL(request.url).searchParams.get("month");
  if (month !== null) {
    try {
      const { from, until } = monthBounds(month);
      const [slots, appointments] = await prisma.$transaction([
        prisma.availabilitySlot.findMany({ where: { professionalId: actor.id, active: true, startsAt: { lt: until }, endsAt: { gt: from } }, select: { id: true, startsAt: true, endsAt: true }, orderBy: { startsAt: "asc" } }),
        prisma.booking.findMany({ where: { professionalId: actor.id, startsAt: { lt: until }, endsAt: { gt: from } }, select: { id: true, requestId: true, startsAt: true, endsAt: true, status: true, request: { select: { title: true, conversationId: true, client: { select: { name: true } }, quotes: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, amountMillimes: true, status: true } } } } }, orderBy: { startsAt: "asc" } }),
      ], { isolationLevel: "RepeatableRead" });
      return Response.json({ slots, appointments }, { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) { return workflowErrorResponse(error); }
  }
  const cursor = Number(new URL(request.url).searchParams.get("before") || 2147483647);
  if (!Number.isSafeInteger(cursor) || cursor < 1) return Response.json({ error: "Curseur invalide." }, { status: 400 });
  const requests = await prisma.serviceRequest.findMany({ where: { professionalId: actor.id, id: { lt: cursor } }, include: { ...requestInclude, client: { select: { id: true, name: true, phone: true, email: true } } }, orderBy: { id: "desc" }, take: 100 });
  const selected = Number(new URL(request.url).searchParams.get("demande"));
  if (Number.isSafeInteger(selected) && selected > 0) {
    const include = { ...requestInclude, client: { select: { id: true, name: true, phone: true, email: true } } } as const;
    const current = await prisma.serviceRequest.findFirst({ where: { id: selected, professionalId: actor.id }, include });
    if (current && !requests.some((r) => r.id === current.id)) requests.unshift(current);
    if (current?.conversationId && !requests.some((r) => r.id === current.conversationId)) {
      const thread = await prisma.serviceRequest.findFirst({ where: { id: current.conversationId, professionalId: actor.id }, include });
      if (thread) requests.unshift(thread);
    }
  }
  const slots = await prisma.availabilitySlot.findMany({ where: { professionalId: actor.id, active: true, startsAt: { gt: new Date() } }, orderBy: { startsAt: "asc" }, take: 500 });
  return Response.json({ requests, slots, nextCursor: requests.length === 100 ? requests[requests.length - 1].id : null }, { headers: { "Cache-Control": "private, no-store" } });
}

// Professional counterpart: only the professional assigned to a request can act on it.
export async function POST(request: Request) {
  if (!hasAllowedRequestOrigin(request)) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  const session = await getSession();
  const actor = session && await prisma.user.findFirst({ where: { id: session.userId, role: "PROFESSIONAL", status: "APPROVED" }, select: { id: true, role: true } });
  if (!actor) return Response.json({ error: "Professionnel approuvé requis." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !["message.send", "quote.propose", "booking.confirm", "booking.counter", "booking.reject", "availability.create", "availability.save", "availability.remove", "intervention.status"].includes(body.action)) return Response.json({ error: "Action invalide." }, { status: 400 });
  try { return Response.json(await mutateWorkspace(actor, body)); }
  catch (e) { return workflowErrorResponse(e); }
}
