import { hasAllowedRequestOrigin } from "@/lib/request-origin";
import { workflowErrorResponse } from "@/app/lib/workflow-response";
import { getClient } from "@/app/lib/client-access";
import { mutateWorkspace } from "@/app/lib/workspace-mutations";
export async function POST(request: Request) {
  if (!hasAllowedRequestOrigin(request)) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  const client = await getClient();
  if (!client) return Response.json({ error: "Connexion client requise." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "Requête invalide." }, { status: 400 });
  try {
    const action = body.kind === "MESSAGE" ? "conversation.open" : "request.create";
    const result = await mutateWorkspace({ id: client.id, role: "CLIENT" }, { ...body, text: body.message, action });
    return Response.json(result, { status: 201 });
  } catch (e) { return workflowErrorResponse(e); }
}
