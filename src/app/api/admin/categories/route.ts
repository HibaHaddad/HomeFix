import { adminMutation } from "@/app/lib/admin-http";
import { saveCategory } from "@/app/lib/admin-category-mutations";
import { requireAdmin } from "@/app/lib/admin-access";
import { getAdminCategoryInventory } from "@/app/lib/admin-categories";

export async function GET() {
  const access = await requireAdmin();
  if ("error" in access) return access.error;
  try {
    return Response.json({ categories: await getAdminCategoryInventory() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Le catalogue est momentanément indisponible." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  return adminMutation(request, async admin => {
    const category = await saveCategory(admin, await request.json().catch(() => null));
    return Response.json({ category }, { status: 201 });
  });
}
