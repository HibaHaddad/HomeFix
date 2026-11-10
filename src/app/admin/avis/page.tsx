import { requireAdminPage } from "@/app/lib/admin-access";
import { adminReviews, opsFilters, reviewStatuses } from "@/app/lib/admin-operations";
import { AdminSection, AdminMetrics, AdminFilters, AdminTable, AdminPagination, AdminBadge, adminDate } from "@/components/admin/AdminWorkspace";
import AdminAction from "@/components/admin/AdminAction";
import Link from "next/link";
export default async function ReviewsPage({ searchParams }: PageProps<"/admin/avis">) {
  await requireAdminPage();
  const f = opsFilters(await searchParams, reviewStatuses);
  const data = await adminReviews(f);
  return <AdminSection title="Avis et modération" description="Préservez la confiance. Examinez les commentaires et les signalements avant chaque décision.">
    <AdminMetrics items={[{ label: "Avis publiés", value: data.published }, { label: "Signalements à examiner", value: data.reported }, { label: "Avis masqués", value: data.hidden }]}/>
    <AdminFilters {...f} options={[{ value: "PUBLISHED", label: "Publiés" }, { value: "HIDDEN", label: "Masqués" }, { value: "REPORTED", label: "Signalés" }, { value: "UNPUBLISHED", label: "Non publiés" }]}/>
    <AdminTable headings={["Avis", "Client et professionnel", "Publication", "Modération"]} empty={!data.rows.length}>{data.rows.map(r => <tr key={r.id}><td><strong>{r.rating === null ? "Sans note" : `${r.rating} / 5`}</strong><p className="aw-prose">{r.comment || "Sans commentaire"}</p><small>{adminDate(r.createdAt)}</small>{r.requestId && <Link href={`/admin/demandes/${r.requestId}`}>Intervention #{r.requestId}</Link>}</td><td>{r.client.name}<small>→ {r.professional.businessName || r.professional.name}</small>{r._count.reports > 0 && <div className="aw-review-reports"><strong>{r._count.reports} signalement(s) ouvert(s)</strong>{r.reports.map(report => <p className="aw-prose" key={report.id}>{report.reason}</p>)}</div>}</td><td><AdminBadge value={r.moderationStatus === "HIDDEN" ? "HIDDEN" : r.published ? "APPROVED" : "PENDING"}/>{r.moderationReason && <p className="aw-prose">{r.moderationReason}</p>}</td><td><div className="aw-actions"><AdminAction label={r.published ? "Masquer" : "Publier"} endpoint={`/api/admin/avis/${r.id}/moderation`} danger={r.published} payload={{ action: r.published ? "HIDE" : "PUBLISH" }} fields={[{ name: "reason", label: "Motif de la décision", type: "textarea" }]}/>{r._count.reports > 0 && <AdminAction label="Classer les signalements" endpoint={`/api/admin/avis/${r.id}/moderation`} payload={{ action: "DISMISS_REPORTS" }} fields={[{ name: "reason", label: "Motif du classement", type: "textarea" }]}/>}</div></td></tr>)}</AdminTable>
    <AdminPagination page={data.page} total={data.total} query={{ q: f.q, status: f.status }}/>
  </AdminSection>;
}
