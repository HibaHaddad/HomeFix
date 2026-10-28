import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/session";
import { prisma } from "@/app/lib/prisma";
import LogoutButton from "@/components/LogoutButton";
import Icon from "@/components/professional/ProfessionalIcon";
import "./client.css";
import "./workspace.css";
import ClientNavigation from "@/components/client/ClientNavigation";
import { Bell } from "lucide-react";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true, role: true, status: true } });
  if (!user) redirect("/login");
  if (user.role === "ADMIN") redirect("/admin/professionnels");
  if (user.role === "PROFESSIONAL") redirect("/professionnel/tableau-de-bord");
  if (user.role !== "CLIENT" || user.status !== "ACTIVE") redirect("/login");
  return <div className="client-app cx-app"><ClientNavigation/><div className="cx-main">
    <header className="client-header"><Link className="brand" href="/"><span className="brand-mark"><Icon name="wrench" size={20}/></span><span>homefix</span></Link>
      <nav aria-label="Espace client"><Link href="/dashboard">Mon espace <span className="cx-header-divider">/</span> <strong>Client</strong></Link></nav>
      <div className="client-account"><Link href="/dashboard/notifications" className="cx-notification-link" aria-label="Notifications"><Bell size={19}/></Link><span className="client-avatar">{user.name.slice(0, 1).toUpperCase()}</span><span><small>ESPACE CLIENT</small><strong>{user.name}</strong></span><LogoutButton/></div>
    </header>
    <main className="client-content">{children}</main>
    <footer className="client-footer"><Link className="brand" href="/">homefix</Link><span>Les bons pros. La tranquillité en plus.</span><a href="mailto:contact@homefix.tn">Besoin d’aide ? ↗</a></footer>
  </div></div>;
}
