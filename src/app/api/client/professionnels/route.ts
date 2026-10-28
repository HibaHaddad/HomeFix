import { getClient } from "@/app/lib/client-access";
import { searchProfessionals } from "@/app/lib/professional-directory";
import { parseDirectoryFilters } from "@/lib/directory-filters";

export async function GET(request: Request) {
  if (!await getClient()) return Response.json({ error: "Accès réservé aux clients connectés." }, { status: 401 });
  let filters;
  try { filters = parseDirectoryFilters(new URL(request.url).searchParams); }
  catch (error) { return Response.json({ error: (error as Error).message }, { status: 400 }); }
  try {
    return Response.json(await searchProfessionals(filters), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Professional directory:", error);
    return Response.json({ error: "La recherche est temporairement indisponible. Réessayez dans un instant." }, { status: 503 });
  }
}
