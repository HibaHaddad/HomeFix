import { getClient } from "@/app/lib/client-access";
import { mutateWorkspace, WorkflowError } from "@/app/lib/workspace-mutations";

export async function POST(request: Request) {
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  const client = await getClient();
  if (!client) return Response.json({ error: "Connexion client requise." }, { status: 401 });
  if (Number(request.headers.get("content-length") || 0) > 20000) return Response.json({ error: "Requête trop volumineuse." }, { status: 413 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "Requête invalide." }, { status: 400 });
  try { return Response.json(await mutateWorkspace({ id: client.id, role: "CLIENT" }, body)); }
  catch (e) {
    if (e instanceof WorkflowError) return Response.json({ error: e.message }, { status: e.status });
    if (e && typeof e === "object" && "code" in e && ["P2034", "P2002"].includes(String(e.code))) return Response.json({ error: "Cette opération a déjà été traitée ou les données ont changé. Actualisez la page." }, { status: 409 });
    if (e instanceof Error && e.constructor === Error) return Response.json({ error: e.message }, { status: 400 });
    console.error("Client workspace mutation failed", e);
    return Response.json({ error: "L’opération n’a pas pu être enregistrée." }, { status: 500 });
  }
}
