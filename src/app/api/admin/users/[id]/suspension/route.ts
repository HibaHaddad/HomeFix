import { requireAdmin } from "@/app/lib/admin-access";
import { adminUsersErrorResponse } from "@/app/lib/admin-users";
import { prisma } from "@/app/lib/prisma";
import { chatServer, userRoom } from "@/app/lib/chat-events";
import { hasAllowedRequestOrigin } from "@/lib/request-origin";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasAllowedRequestOrigin(request)) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  const access = await requireAdmin();
  if ("error" in access) return access.error;
  const rawId = (await params).id;
  const userId = Number(rawId);
  if (!Number.isSafeInteger(userId) || userId < 1) return Response.json({ error: "Utilisateur introuvable." }, { status: 404 });
  if (userId === access.admin.id) return Response.json({ error: "Vous ne pouvez pas suspendre votre propre compte." }, { status: 403 });

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "Requête invalide." }, { status: 400 });
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some((key) => !["action", "reason"].includes(key))) return Response.json({ error: "Champs invalides." }, { status: 400 });
  if (input.action !== "SUSPEND" && input.action !== "REACTIVATE") return Response.json({ error: "Action invalide." }, { status: 400 });

  const suspending = input.action === "SUSPEND";
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (suspending && (reason.length < 3 || reason.length > 1000)) {
    return Response.json({ error: "Le motif doit contenir entre 3 et 1 000 caractères." }, { status: 400 });
  }
  if (!suspending && input.reason !== undefined) return Response.json({ error: "Le motif ne peut être fourni lors d’une réactivation." }, { status: 400 });

  let user;
  try {
    user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, isSuspended: true } });
  } catch (error) {
    return adminUsersErrorResponse(error, "loading user suspension state");
  }
  if (!user) return Response.json({ error: "Utilisateur introuvable." }, { status: 404 });
  if (user.role === "ADMIN") return Response.json({ error: "Les comptes administrateur ne peuvent pas être suspendus ici." }, { status: 403 });
  if (user.isSuspended === suspending) {
    return Response.json({ error: suspending ? "Ce compte est déjà suspendu." : "Ce compte n’est pas suspendu." }, { status: 409 });
  }

  let result;
  try {
    result = await prisma.user.updateMany({
      where: { id: userId, role: { not: "ADMIN" }, isSuspended: !suspending },
      data: {
        isSuspended: suspending,
        ...(suspending ? { suspensionReason: reason } : {}),
        suspensionUpdatedAt: new Date(),
      },
    });
  } catch (error) {
    return adminUsersErrorResponse(error, "updating user suspension");
  }
  if (result.count !== 1) return Response.json({ error: "Le compte a changé pendant cette opération. Actualisez la page." }, { status: 409 });

  if (suspending) chatServer()?.in(userRoom(userId)).disconnectSockets(true);
  return Response.json({ id: userId, isSuspended: suspending, suspensionUpdatedAt: new Date().toISOString() });
}
