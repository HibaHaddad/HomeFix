import { requireAdmin } from "@/app/lib/admin-access";
import { professionalAdminErrorResponse } from "@/app/lib/admin-professionals";
import { prisma } from "@/app/lib/prisma";
import { hasAllowedRequestOrigin } from "@/lib/request-origin";
import { audit } from "@/app/lib/admin-audit";

const requiredFields = ["businessName", "specialty", "experience", "serviceCity", "coveredAreas"] as const;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasAllowedRequestOrigin(request)) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  const access = await requireAdmin();
  if ("error" in access) return access.error;

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) return Response.json({ error: "Dossier introuvable." }, { status: 404 });

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "Requête invalide." }, { status: 400 });
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some((key) => !["decision", "reason"].includes(key)) || (input.decision !== "APPROVED" && input.decision !== "REJECTED")) {
    return Response.json({ error: "Décision invalide." }, { status: 400 });
  }
  const decision = input.decision as "APPROVED" | "REJECTED";
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (decision === "REJECTED" && (reason.length < 3 || reason.length > 1000)) {
    return Response.json({ error: "Le motif doit contenir entre 3 et 1 000 caractères." }, { status: 400 });
  }
  if (decision === "APPROVED" && input.reason !== undefined) {
    return Response.json({ error: "Un motif ne peut être fourni que pour un refus." }, { status: 400 });
  }

  try {
    const decisionResult = await prisma.$transaction(async (tx) => {
      const professional = await tx.user.findFirst({
        where: { id, role: "PROFESSIONAL" },
        select: {
          status: true, termsAccepted: true, businessName: true, specialty: true,
          experience: true, serviceCity: true, coveredAreas: true,
        },
      });
      if (!professional) return { kind: "missing" as const };
      if (professional.status !== "PENDING_VERIFICATION") return { kind: "not-pending" as const };

      if (decision === "APPROVED") {
        const missing: string[] = requiredFields.filter((field) => {
          const value = professional[field];
          return !value?.trim() || value.trim().length < 2;
        }).map((field) => field === "businessName" ? "Nom commercial" : field === "serviceCity" ? "Ville de service" : field === "coveredAreas" ? "Zones couvertes" : field === "specialty" ? "Spécialité" : "Expérience");
        if (!professional.termsAccepted) missing.push("Acceptation des conditions");
        if (missing.length) return { kind: "incomplete" as const, missing };
      }

      const updated = await tx.user.updateMany({
        where: { id, role: "PROFESSIONAL", status: "PENDING_VERIFICATION" },
        data: {
          status: decision,
          verificationReason: decision === "REJECTED" ? reason : null,
          verifiedAt: new Date(),
          verifiedById: access.admin.id,
        },
      });
      if (updated.count === 1) {
        await audit(tx, access.admin, `PROFESSIONAL_${decision}`, `user:${id}`, decision === "REJECTED" ? reason : undefined);
        await tx.clientNotification.create({ data: { userId: id, title: decision === "APPROVED" ? "Votre dossier professionnel a été approuvé" : "Votre dossier professionnel a été refusé", type: "INFO", href: "/professionnel/profil" } });
      }
      return updated.count === 1 ? { kind: "updated" as const } : { kind: "conflict" as const };
    }, { isolationLevel: "Serializable" });

    if (decisionResult.kind === "missing") return Response.json({ error: "Dossier professionnel introuvable." }, { status: 404 });
    if (decisionResult.kind === "not-pending") return Response.json({ error: "Ce dossier a déjà été traité." }, { status: 409 });
    if (decisionResult.kind === "conflict") return Response.json({ error: "Le dossier a changé pendant la décision. Actualisez puis réessayez." }, { status: 409 });
    if (decisionResult.kind === "incomplete") return Response.json({ error: "Le dossier ne satisfait pas les conditions d’approbation.", missing: decisionResult.missing }, { status: 422 });

    return Response.json({ id, status: decision });
  } catch (error) {
    return professionalAdminErrorResponse(error, "saving verification decision");
  }
}
