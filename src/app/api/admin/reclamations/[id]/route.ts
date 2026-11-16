import { requireAdmin } from "@/app/lib/admin-access";
import { getAdminComplaintDetail, adminComplaintActionErrorResponse } from "@/app/lib/admin-complaints";
import { adminId } from "@/lib/admin-validation";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireAdmin();
  if ("error" in access) return access.error;
  let id: number;
  try { id = adminId((await params).id); } catch { return Response.json({ error: "Réclamation introuvable." }, { status: 404 }); }
  try {
    const complaint = await getAdminComplaintDetail(id);
    return complaint ? Response.json(complaint, { headers: { "Cache-Control": "private, no-store" } }) : Response.json({ error: "Réclamation introuvable." }, { status: 404 });
  } catch (error) { return adminComplaintActionErrorResponse(error); }
}
