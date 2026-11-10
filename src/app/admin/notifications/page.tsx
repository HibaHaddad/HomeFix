import Link from "next/link";
import { requireAdminPage } from "@/app/lib/admin-access";
import { prisma } from "@/app/lib/prisma";
import { AdminSection, AdminMetrics, AdminPagination, adminDate } from "@/components/admin/AdminWorkspace";
import AdminAction from "@/components/admin/AdminAction";
import { adminPage } from "@/lib/admin-validation";
export default async function NotificationsPage({ searchParams }: PageProps<"/admin/notifications">) {
  const admin = await requireAdminPage();
  const settings = await prisma.adminSetting.findUnique({ where: { key: "GENERAL" } });
  const value = settings?.value;
  const hours = value && typeof value === "object" && !Array.isArray(value) && typeof value.complaintSlaHours === "number" ? value.complaintSlaHours : 48;
  const overdueBefore = new Date();
  overdueBefore.setHours(overdueBefore.getHours() - hours);
  const [total, unread, pending, reports, complaints, overdue] = await Promise.all([
    prisma.clientNotification.count({ where: { userId: admin.id } }),
    prisma.clientNotification.count({ where: { userId: admin.id, readAt: null } }),
    prisma.user.count({ where: { role: "PROFESSIONAL", status: "PENDING_VERIFICATION" } }),
    prisma.reviewReport.count({ where: { status: "OPEN" } }),
    prisma.complaint.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.complaint.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] }, createdAt: { lt: overdueBefore } } }),
  ]);
  const page = Math.min(adminPage((await searchParams).page), Math.max(1, Math.ceil(total / 20)));
  const rows = await prisma.clientNotification.findMany({ where: { userId: admin.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 20 });
  return <AdminSection title="Notifications" description="Vos notifications personnelles et les dossiers qui demandent l’attention de l’équipe." actions={unread > 0 ? <AdminAction label="Tout marquer comme lu" endpoint="/api/admin/notifications" method="PATCH"/> : undefined}><AdminMetrics items={[{ label: "Non lues", value: unread }, { label: "Professionnels à valider", value: pending }, { label: "Signalements ouverts", value: reports }, { label: `Réclamations au-delà de ${hours} h`, value: overdue }]}/><div className="aw-note aw-actions"><Link href="/admin/professionnels?status=PENDING_VERIFICATION">Examiner les inscriptions ({pending})</Link> · <Link href="/admin/avis?status=REPORTED">Modérer les signalements ({reports})</Link> · <Link href="/admin/reclamations">Traiter les réclamations ({complaints})</Link></div><div className="aw-panel">{rows.map(n => <article className={`aw-message${n.readAt ? "" : " aw-unread"}`} key={n.id}><header><strong>{n.title}</strong><time>{adminDate(n.createdAt)}</time></header><p><Link href={n.href.startsWith("/admin/") && !n.href.startsWith("//") ? n.href : "/admin"}>Ouvrir le dossier</Link>{!n.readAt && " · Non lue"}</p></article>)}{!rows.length && <div className="aw-empty">Aucune notification personnelle. Les dossiers à traiter restent visibles ci-dessus.</div>}</div><AdminPagination page={page} total={total} query={{}}/></AdminSection>;
}
