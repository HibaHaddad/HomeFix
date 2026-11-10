import { requireAdmin } from "@/app/lib/admin-access";
import { adminUsersErrorResponse, getAdminUserDetail } from "@/app/lib/admin-users";
import { prisma } from "@/app/lib/prisma";
import { hasAllowedRequestOrigin } from "@/lib/request-origin";
import { audit } from "@/app/lib/admin-audit";

async function targetId(params: Promise<{ id: string }>) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireAdmin();
  if ("error" in access) return access.error;
  const id = await targetId(params);
  if (!id) return Response.json({ error: "Utilisateur introuvable." }, { status: 404 });
  try {
    const detail = await getAdminUserDetail(id);
    if (!detail) return Response.json({ error: "Utilisateur introuvable." }, { status: 404 });
    return Response.json(detail, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return adminUsersErrorResponse(error, "loading user detail");
  }
}

const editableFields = new Set([
  "name", "email", "phone", "address", "city", "businessName",
  "specialty", "description", "experience", "serviceCity", "coveredAreas", "priceRange",
]);
const professionalFields = new Set([
  "businessName", "specialty", "description", "experience", "serviceCity", "coveredAreas", "priceRange",
]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasAllowedRequestOrigin(request)) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  const access = await requireAdmin();
  if ("error" in access) return access.error;
  const id = await targetId(params);
  if (!id) return Response.json({ error: "Utilisateur introuvable." }, { status: 404 });
  if (id === access.admin.id) return Response.json({ error: "Vous ne pouvez pas modifier votre propre compte depuis cette interface." }, { status: 403 });

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "Requête invalide." }, { status: 400 });
  const input = body as Record<string, unknown>;
  const keys = Object.keys(input);
  if (!keys.length || keys.some((key) => !editableFields.has(key))) return Response.json({ error: "Champs modifiables invalides." }, { status: 400 });

  const data: Record<string, string | null> = {};
  const required = new Set(["name", "email"]);
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== "string") return Response.json({ error: `Valeur invalide pour ${key}.` }, { status: 400 });
    const normalized = value.trim();
    const max = key === "description" ? 2000 : key === "coveredAreas" ? 1000 : key === "email" ? 254 : 160;
    if (normalized.length > max || (required.has(key) && normalized.length < (key === "name" ? 2 : 3))) {
      return Response.json({ error: `Valeur invalide pour ${key}.` }, { status: 400 });
    }
    if (key === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return Response.json({ error: "Adresse e-mail invalide." }, { status: 400 });
    data[key] = key === "email" ? normalized.toLowerCase() : normalized || null;
  }

  try {
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!target) return Response.json({ error: "Utilisateur introuvable." }, { status: 404 });
    if (target.role === "ADMIN") return Response.json({ error: "Les comptes administrateur ne peuvent pas être modifiés ici." }, { status: 403 });
    if (target.role !== "PROFESSIONAL" && keys.some((key) => professionalFields.has(key))) {
      return Response.json({ error: "Les champs professionnels ne s’appliquent qu’aux prestataires." }, { status: 400 });
    }

    const email = data.email;
    if (email && await prisma.user.findFirst({ where: { email, id: { not: id } }, select: { id: true } })) {
      return Response.json({ error: "Cette adresse e-mail est déjà utilisée." }, { status: 409 });
    }
    const result = await prisma.$transaction(async tx => {
      const result = await tx.user.updateMany({ where: { id, role: { not: "ADMIN" } }, data });
      if (result.count === 1) await audit(tx, access.admin, "USER_UPDATE", `user:${id}`, undefined, { fields: keys });
      return result;
    });
    if (result.count !== 1) return Response.json({ error: "Utilisateur introuvable ou non modifiable." }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    return adminUsersErrorResponse(error, "updating user");
  }
}
