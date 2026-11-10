import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/session";
import { prisma } from "@/app/lib/prisma";
import AdminShell from "@/components/admin/AdminShell";
import "./admin.css";
import "./admin-shell.css";
import "./admin-dashboard.css";
import "./admin-workspace.css";
import "./admin-premium.css";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await getSession();
  if (!session) redirect("/login");
  const admin = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, role: true, isSuspended: true },
  });
  if (!admin || admin.isSuspended) redirect("/login");
  if (admin.role !== "ADMIN") redirect("/dashboard");

  const unreadCount = await prisma.clientNotification.count({ where: { userId: admin.id, readAt: null } });
  return <AdminShell adminName={admin.name} unreadCount={unreadCount}>{children}</AdminShell>;
}
