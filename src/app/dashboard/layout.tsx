import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/session";
import { prisma } from "@/app/lib/prisma";
import HomeFixBrand from "@/components/HomeFixBrand";
import "./client.css";
import "./workspace.css";
import "./client-theme.css";
import "./intervention-flow.css";
import "./payments.css";
import ClientAvatar from "@/components/client/ClientAvatar";
import ClientNavigation from "@/components/client/ClientNavigation";
import NotificationBell from "@/components/notifications/NotificationBell";
import NotificationProvider from "@/components/notifications/NotificationProvider";
import ChatNotifications from "@/components/ChatNotifications";
import FloatingAssistant from "@/components/client/FloatingAssistant";
import "./realtime-chat.css";
import "./intervention-journey.css";
import "./notifications.css";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true, role: true, status: true, isSuspended: true, profilePhotoMime: true } });
  if (!user) redirect("/login");
  if (user.role === "ADMIN") redirect("/admin/professionnels");
  if (user.role === "PROFESSIONAL") redirect("/professionnel/tableau-de-bord");
  if (user.role !== "CLIENT" || user.status !== "ACTIVE" || user.isSuspended) redirect("/login");
  const unreadCount = await prisma.clientNotification.count({ where: { userId: session.userId, readAt: null } });
  return <NotificationProvider key={session.userId} initialUnread={unreadCount}><div className="client-app cx-app"><ChatNotifications userId={session.userId}/><ClientNavigation/><div className="cx-main">
    <header className="client-header"><HomeFixBrand className="cx-header-brand"/>
      <nav aria-label="Espace client"><Link href="/dashboard">Mon espace <span className="cx-header-divider">/</span> <strong>Client</strong></Link></nav>
      <div className="client-account"><NotificationBell/><ClientAvatar name={user.name} hasPhoto={!!user.profilePhotoMime}/><span><small>ESPACE CLIENT</small><strong>{user.name}</strong></span></div>
    </header>
    <main className="client-content">{children}</main>
    <footer className="client-footer"><HomeFixBrand/><span>Les bons pros. La tranquillité en plus.</span><Link href="/dashboard/reclamations">Besoin d’aide ? ↗</Link></footer>
  </div><FloatingAssistant/></div></NotificationProvider>;
}
