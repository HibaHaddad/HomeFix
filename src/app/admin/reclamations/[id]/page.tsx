import { notFound } from "next/navigation";
import { getAdminComplaintDetail } from "@/app/lib/admin-complaints";
import AdminComplaintDetail from "@/components/admin/AdminComplaintDetail";
import "../complaints.css";

export default async function AdminComplaintDetailPage({ params }: PageProps<"/admin/reclamations/[id]">) {
  const rawId = (await params).id;
  if (!/^\d+$/.test(rawId)) notFound();
  const complaint = await getAdminComplaintDetail(Number(rawId));
  if (!complaint) notFound();
  return <AdminComplaintDetail complaint={complaint} />;
}
