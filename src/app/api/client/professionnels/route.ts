import { getClient } from "@/app/lib/client-access";
import { searchProfessionals } from "@/app/lib/professional-directory";
import { parseDirectoryFilters } from "@/lib/directory-filters";
import { prisma } from "@/app/lib/prisma";

export async function GET(request: Request) {
  const client = await getClient();
  if (!client) return Response.json({ error: "Accès réservé aux clients connectés." }, { status: 401 });
  let filters;
  try { filters = parseDirectoryFilters(new URL(request.url).searchParams); }
  catch (error) { return Response.json({ error: (error as Error).message }, { status: 400 }); }
  try {
    const result = await searchProfessionals(filters);
    const favorites = await prisma.favorite.findMany({
      where: { clientId: client.id, professionalId: { in: result.professionals.map((p) => p.id) } },
      select: { professionalId: true },
    });
    return Response.json({ ...result, favoriteIds: favorites.map((f) => f.professionalId) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Professional directory:", error);
    return Response.json({ error: "La recherche est temporairement indisponible. Réessayez dans un instant." }, { status: 503 });
  }
}
