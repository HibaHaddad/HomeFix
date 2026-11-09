import { requireAdmin } from "@/app/lib/admin-access";
import { adminUsersErrorResponse, getAdminUserList, MAX_ADMIN_USER_PAGE, parseAdminUserFilters } from "@/app/lib/admin-users";

const allowedParams = new Set(["q", "role", "account", "sort", "page"]);

export async function GET(request: Request) {
  const access = await requireAdmin();
  if ("error" in access) return access.error;

  const params = new URL(request.url).searchParams;
  for (const key of params.keys()) {
    if (!allowedParams.has(key) || params.getAll(key).length > 1) {
      return Response.json({ error: "Paramètres de recherche invalides." }, { status: 400 });
    }
  }
  const pageValue = params.get("page");
  if (pageValue !== null && (!/^\d+$/.test(pageValue) || Number(pageValue) < 1 || Number(pageValue) > MAX_ADMIN_USER_PAGE || !Number.isSafeInteger(Number(pageValue)))) {
    return Response.json({ error: "Numéro de page invalide." }, { status: 400 });
  }
  const role = params.get("role")?.toUpperCase();
  if (role && !["ALL", "CLIENT", "PROFESSIONAL", "ADMIN"].includes(role)) {
    return Response.json({ error: "Rôle invalide." }, { status: 400 });
  }
  const account = params.get("account")?.toUpperCase();
  if (account && !["ALL", "ACTIVE", "SUSPENDED"].includes(account)) {
    return Response.json({ error: "Filtre de statut invalide." }, { status: 400 });
  }
  const sort = params.get("sort");
  if (sort && !["newest", "oldest"].includes(sort)) {
    return Response.json({ error: "Tri invalide." }, { status: 400 });
  }
  const q = params.get("q") ?? "";
  if (q.length > 100) return Response.json({ error: "La recherche est trop longue." }, { status: 400 });

  try {
    const result = await getAdminUserList(parseAdminUserFilters({
      q, role, account, sort: sort ?? undefined, page: pageValue ?? undefined,
    }));
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return adminUsersErrorResponse(error, "listing users");
  }
}
