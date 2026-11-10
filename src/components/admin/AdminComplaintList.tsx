import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ClipboardList, MessageSquare, Search, ShieldAlert } from "lucide-react";
import type { getAdminComplaintList } from "@/app/lib/admin-complaints";

type Result = Awaited<ReturnType<typeof getAdminComplaintList>>;
const numberFormat = new Intl.NumberFormat("fr-FR");
const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Africa/Tunis" });
const labels: Record<string, string> = { OPEN: "Ouverte", IN_PROGRESS: "En cours", RESOLVED: "Résolue", CLOSED: "Clôturée" };

function label(status: string) {
  if (!status.trim()) return "Statut vide";
  return labels[status] ?? status.replaceAll("_", " ");
}

function pageHref(result: Result, page: number) {
  const params = new URLSearchParams();
  if (result.filters.q) params.set("q", result.filters.q);
  if (result.filters.status !== "ALL") params.set("status", result.filters.status);
  if (result.filters.sort !== "newest") params.set("sort", result.filters.sort);
  params.set("page", String(page));
  return `/admin/reclamations?${params.toString()}`;
}

export default function AdminComplaintList({ result }: { result: Result }) {
  const { complaints, statuses, stats, matching, page, pageCount, pageSize, filters } = result;
  const hasFilters = Boolean(filters.q || filters.status !== "ALL");
  const cards = [
    { label: "Réclamations au total", value: stats.total, icon: ClipboardList, tone: "blue" },
    { label: "Ouvertes", value: stats.open, icon: ShieldAlert, tone: "amber" },
    { label: "Avec réponse", value: stats.withResponse, icon: MessageSquare, tone: "green" },
    { label: "Sans réponse", value: stats.withoutResponse, icon: Check, tone: "slate" },
  ];

  return <div className="admin-content admin-complaints-page">
    <div className="admin-page-heading"><div><div className="admin-eyebrow"><span/>SUPERVISION DE LA PLATEFORME</div><h1>Réclamations</h1><p>Consultez les signalements transmis par les clients et les réponses enregistrées.</p></div><span className="admin-total-pill">{numberFormat.format(stats.total)} réclamation{stats.total !== 1 ? "s" : ""}</span></div>

    <section className="admin-complaint-stat-grid" aria-label="Statistiques des réclamations">
      {cards.map(({ label: title, value, icon: Icon, tone }) => <article className="admin-request-stat admin-complaint-stat" key={title}><span className={`admin-request-stat-icon tone-${tone}`}><Icon size={17}/></span><span>{title}</span><strong>{numberFormat.format(value)}</strong></article>)}
    </section>

    <section className="admin-card">
      <form className="admin-toolbar admin-complaint-filters" action="/admin/reclamations" method="get">
        <label className="admin-search"><Search size={16} aria-hidden="true"/><input name="q" type="search" defaultValue={filters.q} maxLength={120} placeholder="Sujet, message, nom ou e-mail…" aria-label="Rechercher une réclamation"/></label>
        <label className="admin-filter"><span>Statut réel</span><select name="status" defaultValue={filters.status}><option value="ALL">Tous les statuts</option>{statuses.map((status) => <option value={status} key={status}>{label(status)}</option>)}</select></label>
        <label className="admin-filter"><span>Création</span><select name="sort" defaultValue={filters.sort}><option value="newest">Plus récentes</option><option value="oldest">Plus anciennes</option></select></label>
        <button className="admin-button admin-button-primary" type="submit">Filtrer</button>
      </form>

      {complaints.length === 0 ? <div className="admin-empty"><span><ClipboardList size={21}/></span><h2>{hasFilters ? "Aucun résultat correspondant" : "Aucune réclamation enregistrée"}</h2><p>{hasFilters ? "Modifiez la recherche ou les filtres pour afficher des résultats." : "Les réclamations apparaîtront ici lorsqu’elles seront soumises."}</p></div> : <div className="admin-complaint-table-wrap"><table className="admin-table admin-complaint-table"><thead><tr><th>Réclamation</th><th>Client</th><th>Demande associée</th><th>Statut</th><th>Création</th><th/></tr></thead><tbody>{complaints.map((complaint) => <tr key={complaint.id}>
        <td><span className="admin-complaint-subject"><strong>#{complaint.id} · {complaint.subject}</strong><small>{complaint.response ? "Réponse enregistrée" : "Sans réponse"}</small></span></td>
        <td><span className="admin-complaint-client"><strong>{complaint.client.name}</strong><small>{complaint.client.email}</small></span></td>
        <td>{complaint.request ? <span className="admin-complaint-request">#{complaint.request.id} · {complaint.request.title}</span> : <span className="admin-complaint-muted">Question générale</span>}</td>
        <td><span className={`admin-status status-${complaint.status.toLowerCase().replaceAll(/[^a-z0-9_-]/g, "")}`}><i/>{label(complaint.status)}</span></td>
        <td>{dateFormat.format(complaint.createdAt)}</td>
        <td><Link className="admin-view-link" href={`/admin/reclamations/${complaint.id}`}>Consulter <ArrowRight size={13}/></Link></td>
      </tr>)}</tbody></table></div>}

      <footer className="admin-request-pagination"><span>{matching === 0 ? "0 résultat" : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, matching)} sur ${matching}`}</span><div><Link aria-disabled={page <= 1} className={page <= 1 ? "is-disabled" : ""} href={pageHref(result, Math.max(1, page - 1))}><ArrowLeft size={14}/>Précédent</Link><span>Page {matching === 0 ? "—" : page} / {pageCount}</span><Link aria-disabled={page >= pageCount} className={page >= pageCount ? "is-disabled" : ""} href={pageHref(result, Math.max(1, Math.min(pageCount, page + 1)))}>Suivant<ArrowRight size={14}/></Link></div></footer>
    </section>
  </div>;
}
