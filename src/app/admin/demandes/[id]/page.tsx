import { notFound } from "next/navigation";
import { getAdminRequestDetail } from "@/app/lib/admin-requests";
import AdminRequestDetail from "@/components/admin/AdminRequestDetail";
import "../requests.css";

export default async function AdminRequestDetailPage({ params }: PageProps<"/admin/demandes/[id]">) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const request = await getAdminRequestDetail(id);
  if (!request) notFound();
  return <AdminRequestDetail request={request} />;
}
