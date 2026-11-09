import { hasAllowedRequestOrigin } from "@/lib/request-origin";
import {
  adminComplaintActionErrorResponse,
  sendAdminComplaintResponse,
} from "@/app/lib/admin-complaints";

export async function POST(request: Request, { params }: RouteContext<"/api/admin/reclamations/[id]/response">) {
  if (!hasAllowedRequestOrigin(request)) {
    return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  }
  if (Number(request.headers.get("content-length") || 0) > 10_000) {
    return Response.json({ error: "Requête trop volumineuse." }, { status: 413 });
  }

  const { id: rawId } = await params;
  if (!/^\d+$/.test(rawId)) {
    return Response.json({ error: "Identifiant de réclamation invalide." }, { status: 400 });
  }
  const rawBody = await request.text().catch(() => "");
  if (new TextEncoder().encode(rawBody).byteLength > 10_000) {
    return Response.json({ error: "Requête trop volumineuse." }, { status: 413 });
  }
  const body = await Promise.resolve().then(() => JSON.parse(rawBody)).catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }

  try {
    const result = await sendAdminComplaintResponse(Number(rawId), body.response);
    if ("error" in result) return result.error;
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return adminComplaintActionErrorResponse(error);
  }
}
