import { getSession } from "@/app/lib/session";
import { prisma } from "@/app/lib/prisma";
import { chatServer, userRoom } from "@/app/lib/chat-events";
import { hasAllowedRequestOrigin } from "@/lib/request-origin";
import { id } from "@/lib/client-domain";

async function actor() {
  const session = await getSession();
  return session && prisma.user.findFirst({ where: { id: session.userId, isSuspended: false, OR: [{ role: "CLIENT", status: "ACTIVE" }, { role: "PROFESSIONAL", status: "APPROVED" }] }, select: { id: true } });
}
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  const user = await actor();
  if (!user) return Response.json({ error: "Connexion requise." }, { status: 401 });
  const search = new URL(request.url).searchParams;
  if (search.get("countOnly") === "1") return Response.json({ unreadCount: await prisma.clientNotification.count({ where: { userId: user.id, readAt: null } }) }, { headers });
  let before: number | undefined;
  try { before = search.has("before") ? id(search.get("before")) : undefined; } catch { return Response.json({ error: "Curseur invalide." }, { status: 400 }); }
  const [records, unreadCount] = await prisma.$transaction([
    prisma.clientNotification.findMany({ where: { userId: user.id, ...(before ? { id: { lt: before } } : {}), ...(search.get("unread") === "1" ? { readAt: null } : {}) }, select: { id: true, title: true, href: true, type: true, readAt: true, createdAt: true }, orderBy: { id: "desc" }, take: 41 }),
    prisma.clientNotification.count({ where: { userId: user.id, readAt: null } }),
  ], { isolationLevel: "RepeatableRead" });
  const notifications = records.slice(0, 40);
  return Response.json({ notifications, unreadCount, nextCursor: records.length > 40 ? notifications[39].id : null }, { headers });
}

export async function POST(request: Request) {
  if (!hasAllowedRequestOrigin(request)) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  const user = await actor();
  if (!user) return Response.json({ error: "Connexion requise." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "Requête invalide." }, { status: 400 });
  const all = body.all === true;
  let notificationId: number | undefined;
  try { notificationId = all ? undefined : id(body.id); } catch { return Response.json({ error: "Notification invalide." }, { status: 400 }); }
  if (notificationId && !await prisma.clientNotification.findFirst({ where: { id: notificationId, userId: user.id }, select: { id: true } })) return Response.json({ error: "Notification introuvable." }, { status: 404 });
  const result = await prisma.$transaction(async (tx) => {
    await tx.clientNotification.updateMany({ where: { userId: user.id, readAt: null, ...(notificationId ? { id: notificationId } : {}) }, data: { readAt: new Date() } });
    return { unreadCount: await tx.clientNotification.count({ where: { userId: user.id, readAt: null } }), all, ids: notificationId ? [notificationId] : [] };
  });
  chatServer()?.to(userRoom(user.id)).emit("notifications:read", result);
  return Response.json(result, { headers });
}
