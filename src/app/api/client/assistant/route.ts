import { getClient } from "@/app/lib/client-access";
import { categories, text } from "@/lib/client-domain";
export async function POST(request: Request) {
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  if (!await getClient()) return Response.json({ error: "Connexion requise." }, { status: 401 });
  const { HOMEFIX_AI_URL: url, HOMEFIX_AI_KEY: key, HOMEFIX_AI_MODEL: model } = process.env;
  if (!url || !key || !model) return Response.json({ error: "L’assistant IA n’est pas encore configuré. Vous pouvez créer votre demande manuellement." }, { status: 503 });
  let description: string;
  try { const body = await request.json(); description = text(body.description, "Description", 20, 3000); }
  catch { return Response.json({ error: "Décrivez le problème en 20 à 3 000 caractères." }, { status: 400 }); }
  try {
    // Contract of the configured server-side AI adapter; no private address, GPS or user identity is sent.
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, description, categories, language: "fr" }), signal: AbortSignal.timeout(20000), redirect: "error", cache: "no-store" });
    if (!response.ok) throw new Error("Provider unavailable");
    const result = await response.json();
    if (!(categories as readonly string[]).includes(result.category)) throw new Error("Invalid category");
    return Response.json({ category: result.category, description: text(result.description, "Suggestion", 20, 3000) });
  } catch { return Response.json({ error: "L’assistant est indisponible. Votre description reste disponible pour une saisie manuelle." }, { status: 502 }); }
}
