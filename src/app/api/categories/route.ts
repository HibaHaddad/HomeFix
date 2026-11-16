import { activeServiceCategories } from "@/app/lib/service-categories";

export async function GET() {
  try {
    return Response.json({ categories: await activeServiceCategories() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Les catégories sont momentanément indisponibles." }, { status: 503 });
  }
}
