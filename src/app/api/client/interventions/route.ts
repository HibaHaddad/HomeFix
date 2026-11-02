import { getClient } from "@/app/lib/client-access";
import { clientInterventions } from "@/app/lib/client-workspace";
import { id } from "@/lib/client-domain";

export async function GET(request: Request) {
  const client = await getClient();
  if (!client) return Response.json({ error: "Connexion client requise." }, { status: 401 });
  const raw = new URL(request.url).searchParams.get("demande");
  let selected: number | undefined;
  try { selected = raw === null ? undefined : id(raw); } catch { return Response.json({ error: "Intervention invalide." }, { status: 400 }); }
  return Response.json({ requests: await clientInterventions(client.id, selected) }, { headers: { "Cache-Control": "private, no-store" } });
}
