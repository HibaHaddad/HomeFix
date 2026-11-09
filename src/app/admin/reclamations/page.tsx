import { getAdminComplaintList, parseAdminComplaintFilters } from "@/app/lib/admin-complaints";
import AdminComplaintList from "@/components/admin/AdminComplaintList";
import "./complaints.css";

export default async function AdminComplaintsPage({ searchParams }: PageProps<"/admin/reclamations">) {
  const filters = parseAdminComplaintFilters(await searchParams);
  const result = await getAdminComplaintList(filters);
  return <AdminComplaintList result={result} />;
}
