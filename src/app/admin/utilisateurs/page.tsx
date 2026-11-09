import { getAdminUserList, parseAdminUserFilters } from "@/app/lib/admin-users";
import AdminUsersList from "@/components/admin/AdminUsersList";
import "./users.css";

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/utilisateurs">) {
  const filters = parseAdminUserFilters(await searchParams);
  const result = await getAdminUserList(filters);
  return <AdminUsersList filters={{ ...filters, page: result.page }} result={result} />;
}
