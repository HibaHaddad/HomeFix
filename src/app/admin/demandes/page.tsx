import { getAdminRequestList, parseAdminRequestFilters } from "@/app/lib/admin-requests";
import AdminRequestList from "@/components/admin/AdminRequestList";
import "./requests.css";

export default async function AdminRequestsPage({ searchParams }: PageProps<"/admin/demandes">) {
  const filters = parseAdminRequestFilters(await searchParams);
  const result = await getAdminRequestList(filters);
  return <AdminRequestList filters={{ ...filters, page: result.page }} result={result} />;
}
