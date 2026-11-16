import { getClient } from "@/app/lib/client-access";
import { hasAllowedRequestOrigin } from "@/lib/request-origin";
import { clientComplaintHistory, createClientComplaint, supportFiles } from "@/app/lib/client-complaints";
import { SupportComplaintError, SUPPORT_TOTAL_LIMIT } from "@/lib/support-complaints";

export async function GET(request: Request) {
  const client = await getClient();
  if (!client) return Response.json({ error: "Connexion client requise." }, { status: 401 });
  const cursor = new URL(request.url).searchParams.get("before");
  if (cursor !== null && (!/^\d+$/.test(cursor) || !Number.isSafeInteger(Number(cursor)) || Number(cursor) < 1 || Number(cursor) > 2147483647)) return Response.json({ error: "Pagination invalide." }, { status: 400 });
  return Response.json(await clientComplaintHistory(client.id, cursor ? Number(cursor) : undefined), { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (!hasAllowedRequestOrigin(request)) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  const client = await getClient();
  if (!client) return Response.json({ error: "Connexion client requise." }, { status: 401 });
  try {
    const max = SUPPORT_TOTAL_LIMIT + 64000;
    if (Number(request.headers.get("content-length") || 0) > max) throw new SupportComplaintError("La demande dépasse la taille autorisée.", 413);
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) throw new SupportComplaintError("Format de formulaire invalide.", 415);
    const reader = request.body?.getReader();
    if (!reader) throw new SupportComplaintError("Formulaire manquant.");
    const chunks: Uint8Array<ArrayBuffer>[] = []; let size = 0;
    while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.byteLength; if (size > max) { await reader.cancel(); throw new SupportComplaintError("La demande dépasse la taille autorisée.", 413); } chunks.push(new Uint8Array(chunk.value)); }
    const form = await new Request(request.url, { method: "POST", headers: { "Content-Type": request.headers.get("content-type")! }, body: new Blob(chunks) }).formData().catch(() => null);
    if (!form) throw new SupportComplaintError("Formulaire invalide.");
    const input: Record<string, string> = {}; const files: File[] = [];
    for (const [key, value] of form.entries()) {
      if (key === "files" && value instanceof File) { if (value.name || value.size) files.push(value); continue; }
      if (!["type", "category", "requestId", "subject", "message"].includes(key) || typeof value !== "string" || Object.hasOwn(input, key)) throw new SupportComplaintError("Champs non autorisés.");
      input[key] = value;
    }
    const complaint = await createClientComplaint(client.id, input, await supportFiles(files));
    return Response.json({ ok: true, id: complaint.id }, { status: 201 });
  } catch (error) {
    if (error instanceof SupportComplaintError) return Response.json({ error: error.message }, { status: error.status });
    console.error("[Client complaints] submission failed", error);
    return Response.json({ error: "Votre demande n’a pas pu être envoyée. Réessayez dans un instant." }, { status: 503 });
  }
}
