import { requireAdmin } from "@/app/lib/admin-access";
import { professionalAdminErrorResponse } from "@/app/lib/admin-professionals";
import { prisma } from "@/app/lib/prisma";
import { recordAudit } from "@/app/lib/admin-audit";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireAdmin();
  if ("error" in access) return access.error;

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) return Response.json({ error: "Document introuvable." }, { status: 404 });

  try {
    const professional = await prisma.user.findFirst({ where: { id, role: "PROFESSIONAL" }, select: { certificationPdf: true } });
    if (!professional?.certificationPdf) return Response.json({ error: "Aucun document n’est disponible." }, { status: 404 });
    await recordAudit(access.admin, "DOCUMENT_READ", `user:${id}`);
    return new Response(new Uint8Array(professional.certificationPdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="justificatif-professionnel-${id}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return professionalAdminErrorResponse(error, "loading verification document");
  }
}
