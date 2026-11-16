import Link from "next/link";
import { CheckCheck, EyeOff, Flag, MessageSquareText, RotateCcw, Search, SlidersHorizontal, Star } from "lucide-react";
import { requireAdminPage } from "@/app/lib/admin-access";
import { adminReviews, opsFilters, reviewStatuses } from "@/app/lib/admin-operations";
import { AdminSection, AdminTable, AdminPagination } from "@/components/admin/AdminWorkspace";
import AdminReviewAvatar from "@/components/admin/AdminReviewAvatar";
import AdminReviewActions from "@/components/admin/AdminReviewActions";
import "./reviews.css";

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Africa/Tunis" });
const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Tunis" });
const number = new Intl.NumberFormat("fr-FR");
const filterLabels = { PUBLISHED: "Publiés", HIDDEN: "Masqués", REPORTED: "Signalés", UNPUBLISHED: "Non publiés" };

function Rating({ value }: { value: number | null }) {
  return <div className={`ar-rating${value === null ? " ar-rating-empty" : ""}`} aria-label={value === null ? "Avis sans note" : `Note : ${value} sur 5`}>
    <span className="ar-stars" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <Star key={index} size={13} strokeWidth={1.6} fill={value !== null && index < value ? "currentColor" : "none"}/>)}</span>
    <span>{value === null ? "Sans note" : <><strong>{value}</strong><small>/ 5</small></>}</span>
  </div>;
}

export default async function ReviewsPage({ searchParams }: PageProps<"/admin/avis">) {
  await requireAdminPage();
  const filters = opsFilters(await searchParams, reviewStatuses);
  const data = await adminReviews(filters);
  const hasFilters = Boolean(filters.q || filters.status !== "ALL");
  const metrics = [
    { label: "Avis publiés", value: data.published, detail: "Visibles sur la plateforme", icon: CheckCheck, tone: "green" },
    { label: "Signalements à examiner", value: data.reported, detail: "Signalements encore ouverts", icon: Flag, tone: "peach" },
    { label: "Avis masqués", value: data.hidden, detail: "Retirés de la publication", icon: EyeOff, tone: "rose" },
  ];
  return <div className="admin-reviews-page"><AdminSection title="Avis et modération" description="Préservez la confiance. Examinez les commentaires et les signalements avant chaque décision.">
    <section className="admin-kpi-grid ar-kpis" aria-label="Statistiques des avis">{metrics.map(({ label, value, detail, icon: Icon, tone }) => <article className="admin-kpi-card" key={label}>
      <span className={`admin-kpi-icon tone-${tone}`}><Icon size={20} strokeWidth={1.8} aria-hidden="true"/></span><span className="admin-kpi-label">{label}</span><strong className="admin-kpi-value">{number.format(value)}</strong><small className="admin-kpi-detail">{detail}</small>
    </article>)}</section>
    <section className="ar-list-section" aria-labelledby="ar-list-title">
      <div className="ar-list-heading"><div><span className="ar-heading-icon"><MessageSquareText size={18}/></span><h2 id="ar-list-title">{hasFilters ? "Avis correspondants" : "Les avis de la communauté"}</h2></div><span>{number.format(data.total)} résultat{data.total > 1 ? "s" : ""}</span></div>
      <form className="ar-filters" action="/admin/avis" method="get">
        <label className="ar-search"><span>Rechercher un avis</span><span className="ar-search-input"><Search size={17} aria-hidden="true"/><input type="search" name="q" defaultValue={filters.q} maxLength={100} placeholder="Commentaire, client ou professionnel…"/></span></label>
        <label className="ar-status-filter"><span>Statut de l’avis</span><select name="status" defaultValue={filters.status}><option value="ALL">Tous les statuts</option>{Object.entries(filterLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className="ar-filter-actions"><button className="admin-button admin-button-primary" type="submit"><SlidersHorizontal size={15}/>Filtrer</button><Link className="ar-reset" href="/admin/avis"><RotateCcw size={14}/>Réinitialiser</Link></div>
      </form>
      {!data.rows.length ? <div className="aw-panel ar-empty"><span><Star size={29} strokeWidth={1.5}/></span><h3>{hasFilters ? "Aucun avis ne correspond à votre recherche" : "Les premiers avis se feront bientôt entendre"}</h3><p>{hasFilters ? "Essayez un autre mot-clé ou un autre statut pour retrouver les avis à examiner." : "Les avis apparaîtront ici dès leur enregistrement sur HomeFix TN."}</p>{hasFilters && <Link href="/admin/avis" className="admin-button admin-button-light">Afficher tous les avis</Link>}</div> : <div className="ar-table-wrapper"><AdminTable headings={["Client", "Professionnel", "Note", "Commentaire", "Date", "Statut", "Actions"]}>{data.rows.map(review => {
        const professionalName = review.professional.businessName || review.professional.name;
        const status = review.moderationStatus === "HIDDEN" ? "hidden" : review.published ? "published" : "pending";
        const comment = review.comment || "Sans commentaire";
        return <tr key={review.id}>
          <td><div className="ar-person"><AdminReviewAvatar userId={review.client.id} name={review.client.name} hasPhoto={Boolean(review.client.profilePhotoMime)}/><span><strong>{review.client.name}</strong><small>Client</small></span></div></td>
          <td><div className="ar-person"><AdminReviewAvatar userId={review.professional.id} name={professionalName} hasPhoto={Boolean(review.professional.profilePhotoMime)} professional/><span><strong>{professionalName}</strong><small>{review.professional.businessName && review.professional.businessName !== review.professional.name ? review.professional.name : "Prestataire"}</small></span></div></td>
          <td><Rating value={review.rating}/></td>
          <td><div className="ar-comment"><p>{comment.length > 155 ? `${comment.slice(0, 155)}…` : comment}</p>{comment.length > 155 && <details><summary>Lire le commentaire complet</summary><p>{comment}</p></details>}{review._count.reports > 0 && <details className="ar-reports"><summary><Flag size={12}/>{review._count.reports} signalement{review._count.reports > 1 ? "s" : ""} à examiner</summary><ul>{review.reports.map(report => <li key={report.id}>{report.reason}</li>)}</ul></details>}</div></td>
          <td><time className="ar-date" dateTime={review.createdAt.toISOString()}>{dateFormat.format(review.createdAt)}<small>{timeFormat.format(review.createdAt)}</small></time></td>
          <td><span className={`ar-status ar-status-${status}`}><i/>{status === "published" ? "Publié" : status === "hidden" ? "Masqué" : "Non publié"}</span>{review.moderationReason && <details className="ar-decision"><summary>Motif de la décision</summary><p>{review.moderationReason}</p></details>}</td>
          <td><AdminReviewActions key={`${review.id}-${review.published}-${review._count.reports}`} reviewId={review.id} published={review.published} hidden={review.moderationStatus === "HIDDEN"} hasReports={review._count.reports > 0} requestId={review.requestId}/></td>
        </tr>;
      })}</AdminTable></div>}
      {data.total > 0 && <div className="ar-pagination"><AdminPagination page={data.page} total={data.total} query={{ q: filters.q, status: filters.status }}/></div>}
    </section>
  </AdminSection></div>;
}
