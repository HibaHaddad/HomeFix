import { hasAllowedRequestOrigin } from "@/lib/request-origin";
import { workflowErrorResponse } from "@/app/lib/workflow-response";
import { getClient } from "@/app/lib/client-access";
import { mutateWorkspace } from "@/app/lib/workspace-mutations";

export async function POST(request: Request) {
  if (!hasAllowedRequestOrigin(request)) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  const client = await getClient();
  if (!client) return Response.json({ error: "Connexion client requise." }, { status: 401 });
  if (Number(request.headers.get("content-length") || 0) > 20000) return Response.json({ error: "Requête trop volumineuse." }, { status: 413 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "Requête invalide." }, { status: 400 });
  try { return Response.json(await mutateWorkspace({ id: client.id, role: "CLIENT" }, body)); }
  catch (e) { return workflowErrorResponse(e); }
}
