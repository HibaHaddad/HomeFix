import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/session";
import { prisma } from "@/app/lib/prisma";
import AdminShell from "@/components/admin/AdminShell";
import "./admin.css";
import "./admin-shell.css";
import "./admin-dashboard.css";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await getSession();
  if (!session) redirect("/login");
  const admin = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, role: true },
  });
  if (!admin || admin.role !== "ADMIN") redirect("/dashboard");

  return <AdminShell adminName={admin.name}>{children}</AdminShell>;
}
