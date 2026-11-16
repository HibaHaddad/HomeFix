import Link from "next/link";
import { ArrowUpRight, Bell, BellOff, Clock3, Flag, MessageSquareWarning, ShieldAlert, UserRoundCheck } from "lucide-react";
import { requireAdminPage } from "@/app/lib/admin-access";
import { prisma } from "@/app/lib/prisma";
import { AdminSection, AdminPagination } from "@/components/admin/AdminWorkspace";
import AdminAction from "@/components/admin/AdminAction";
import { adminPage } from "@/lib/admin-validation";
import "./notifications.css";

const dayLabel = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Africa/Tunis" });
const timeLabel = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Tunis" });
export default async function NotificationsPage({ searchParams }: PageProps<"/admin/notifications">) {
  const admin = await requireAdminPage();
  const settings = await prisma.adminSetting.findUnique({ where: { key: "GENERAL" } });
  const value = settings?.value;
  const hours = value && typeof value === "object" && !Array.isArray(value) && typeof value.complaintSlaHours === "number" ? value.complaintSlaHours : 48;
  const overdueBefore = new Date();
  overdueBefore.setHours(overdueBefore.getHours() - hours);
  const [total, unread, pending, reports, overdue] = await Promise.all([
    prisma.clientNotification.count({ where: { userId: admin.id } }),
    prisma.clientNotification.count({ where: { userId: admin.id, readAt: null } }),
    prisma.user.count({ where: { role: "PROFESSIONAL", status: "PENDING_VERIFICATION" } }),
    prisma.reviewReport.count({ where: { status: "OPEN" } }),
    prisma.complaint.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] }, createdAt: { lt: overdueBefore } } }),
  ]);
  const page = Math.min(adminPage((await searchParams).page), Math.max(1, Math.ceil(total / 20)));
  const rows = await prisma.clientNotification.findMany({ where: { userId: admin.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 20 });
  const metrics = [
    { label: "Notifications non lues", value: unread, detail: "Votre activité à consulter", icon: Bell, tone: "green" },
    { label: "Professionnels à valider", value: pending, detail: "Inscriptions en attente", icon: UserRoundCheck, tone: "sage" },
    { label: "Signalements ouverts", value: reports, detail: "Avis à examiner", icon: Flag, tone: "rose" },
    { label: "Réclamations en retard", value: overdue, detail: `Délai de traitement supérieur à ${hours} h`, icon: Clock3, tone: "peach" },
  ];
  return <div className="admin-notifications-page"><AdminSection title="Notifications" description="Retrouvez votre activité et les dossiers qui nécessitent votre attention." actions={unread > 0 ? <AdminAction label="Tout marquer comme lu" endpoint="/api/admin/notifications" method="PATCH"/> : undefined}>
    <section className="admin-kpi-grid an-kpis" aria-label="Résumé des notifications">{metrics.map(({ label, value, detail, icon: Icon, tone }) => <article className="admin-kpi-card" key={label}><span className={`admin-kpi-icon tone-${tone}`}><Icon size={20} strokeWidth={1.8} aria-hidden="true"/></span><span className="admin-kpi-label">{label}</span><strong className="admin-kpi-value">{new Intl.NumberFormat("fr-FR").format(value)}</strong><small className="admin-kpi-detail">{detail}</small></article>)}</section>
    <section className="an-activity" aria-labelledby="an-activity-title"><header className="an-list-heading"><div><span className="an-heading-icon"><Bell size={18}/></span><div><h2 id="an-activity-title">Activité récente</h2><p>Vos notifications, de la plus récente à la plus ancienne.</p></div></div>{unread > 0 && <span className="an-unread-count"><i/>{unread} non lue{unread > 1 ? "s" : ""}</span>}</header>
      {rows.length ? <div className="an-list">{rows.map(notification => {
        const href = notification.href.startsWith("/admin/") && !notification.href.startsWith("//") ? notification.href : "/admin";
        const kind = href.includes("reclamations") ? { icon: MessageSquareWarning, label: "Réclamation", tone: "orange" } : href.includes("sanctions") ? { icon: ShieldAlert, label: "Sanction", tone: "red" } : href.includes("professionnels") || href.includes("utilisateurs") ? { icon: UserRoundCheck, label: "Professionnel", tone: "green" } : href.includes("avis") ? { icon: Flag, label: "Modération", tone: "orange" } : { icon: Bell, label: "Information", tone: "green" };
        return <article key={notification.id} className={`an-notification${notification.readAt ? "" : " is-unread"}`}><span className={`an-notification-icon ${kind.tone}`}><kind.icon size={20} strokeWidth={1.7} aria-hidden="true"/></span><div className="an-notification-body"><div className="an-notification-meta"><span>{kind.label}</span><span className={notification.readAt ? "an-read" : "an-unread"}><i/>{notification.readAt ? "Lue" : "Non lue"}</span></div><h3><Link href={href}>{notification.title}</Link></h3><Link className="an-open" href={href}>Consulter le dossier<ArrowUpRight size={13}/></Link></div><time className="an-time" dateTime={notification.createdAt.toISOString()}>{dayLabel.format(notification.createdAt)}<small>{timeLabel.format(notification.createdAt)}</small></time></article>;
      })}</div> : <div className="an-empty"><span><BellOff size={29} strokeWidth={1.5}/></span><h3>Aucune notification pour le moment</h3><p>Les nouvelles activités et les dossiers à examiner apparaîtront ici.</p></div>}
      {total > 0 && <div className="an-pagination"><AdminPagination page={page} total={total} query={{}}/></div>}
    </section>
  </AdminSection></div>;
}
