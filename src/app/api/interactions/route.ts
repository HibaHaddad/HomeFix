import { getSession } from "@/app/lib/session";
import { prisma } from "@/app/lib/prisma";
import { mutateWorkspace, WorkflowError } from "@/app/lib/workspace-mutations";
import { requestInclude } from "@/app/lib/client-workspace";

export async function GET(request: Request) {
  const session = await getSession();
  const actor = session && await prisma.user.findFirst({ where: { id: session.userId, role: "PROFESSIONAL", status: "APPROVED" }, select: { id: true } });
  if (!actor) return Response.json({ error: "Professionnel approuvé requis." }, { status: 401 });
  const cursor = Number(new URL(request.url).searchParams.get("before") || 2147483647);
  if (!Number.isSafeInteger(cursor) || cursor < 1) return Response.json({ error: "Curseur invalide." }, { status: 400 });
  const requests = await prisma.serviceRequest.findMany({ where: { professionalId: actor.id, id: { lt: cursor } }, include: { ...requestInclude, client: { select: { id: true, name: true, phone: true, email: true } } }, orderBy: { id: "desc" }, take: 50 });
  return Response.json({ requests, nextCursor: requests.length === 50 ? requests[requests.length - 1].id : null }, { headers: { "Cache-Control": "private, no-store" } });
}

// Professional counterpart: only the professional assigned to a request can act on it.
export async function POST(request: Request) {
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  const session = await getSession();
  const actor = session && await prisma.user.findFirst({ where: { id: session.userId, role: "PROFESSIONAL", status: "APPROVED" }, select: { id: true, role: true } });
  if (!actor) return Response.json({ error: "Professionnel approuvé requis." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !["message.send", "quote.propose", "booking.confirm", "intervention.status"].includes(body.action)) return Response.json({ error: "Action invalide." }, { status: 400 });
  try { return Response.json(await mutateWorkspace(actor, body)); }
  catch (e) {
    if (e instanceof WorkflowError) return Response.json({ error: e.message }, { status: e.status });
    if (e && typeof e === "object" && "code" in e) return Response.json({ error: "Les données ont changé. Actualisez puis réessayez." }, { status: 409 });
    return Response.json({ error: e instanceof Error ? e.message : "Opération impossible." }, { status: 400 });
  }
}
