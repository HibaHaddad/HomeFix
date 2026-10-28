import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/session";
import { prisma } from "@/app/lib/prisma";
import LogoutButton from "@/components/LogoutButton";
import AdminIcon from "@/components/admin/AdminIcon";
import "./admin.css";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await getSession();
  if (!session) redirect("/login");
  const admin = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, name: true, role: true } });
  if (!admin || admin.role !== "ADMIN") redirect("/dashboard");

  return <div className="admin-app">
    <aside className="admin-sidebar">
      <Link href="/" className="admin-brand"><span className="admin-brand-mark"><AdminIcon name="home" size={20}/></span><span>homefix<small>ADMINISTRATION</small></span></Link>
      <div className="admin-nav-label">GESTION DE LA PLATEFORME</div>
      <nav aria-label="Navigation administration"><Link href="/admin/professionnels" className="admin-nav-link active"><AdminIcon name="shield" size={17}/>Validation des professionnels</Link></nav>
      <Link href="/admin/professionnels" className="admin-mobile-link"><AdminIcon name="shield" size={17}/>Validation des professionnels</Link>
      <div className="admin-sidebar-bottom"><span>Connecté en tant que<br/><strong>{admin.name}</strong></span><LogoutButton /></div>
    </aside>
    <main className="admin-main"><header className="admin-header"><span>Administration <i>/</i> Validation des professionnels</span><span className="admin-role-chip">Accès administrateur</span></header>{children}</main>
  </div>;
}
