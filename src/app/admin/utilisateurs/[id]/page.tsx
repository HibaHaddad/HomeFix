import { notFound } from "next/navigation";
import { getSession } from "@/app/lib/session";
import { getAdminUserDetail } from "@/app/lib/admin-users";
import AdminUserDetail from "@/components/admin/AdminUserDetail";
import "../users.css";

export default async function AdminUserPage({ params }: PageProps<"/admin/utilisateurs/[id]">) {
  const [{ id: rawId }, session] = await Promise.all([params, getSession()]);
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1 || !session) notFound();
  const detail = await getAdminUserDetail(id);
  if (!detail) notFound();
  return <AdminUserDetail detail={detail} currentAdminId={session.userId}/>;
}
