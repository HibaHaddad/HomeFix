import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarClock, ClipboardList, MessageSquareText, Search, Siren } from "lucide-react";
import type { AdminRequestFilters } from "@/app/lib/admin-requests";
import type { getAdminRequestList } from "@/app/lib/admin-requests";

type Result = Awaited<ReturnType<typeof getAdminRequestList>>;
const statusLabels: Record<string, string> = {
  SENT: "Envoyée", QUOTED: "Devis reçu", PRICE_ACCEPTED: "Prix accepté", BOOKED: "Confirmée",
  EN_ROUTE: "En route", IN_PROGRESS: "En cours", COMPLETED: "Terminée", CANCELLED: "Annulée",
  REJECTED: "Refusée", CONVERSATION: "Conversation libre",
};
const urgencyLabels: Record<string, string> = { NORMAL: "Normale", SOON: "Sous 48 h", URGENT: "Urgente" };
const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Africa/Tunis" });

function pageHref(filters: AdminRequestFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status !== "ALL") params.set("status", filters.status);
  if (filters.category) params.set("category", filters.category);
  if (filters.urgency !== "ALL") params.set("urgency", filters.urgency);
  if (filters.type !== "ALL") params.set("type", filters.type);
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  params.set("page", String(page));
  return `/admin/demandes?${params.toString()}`;
}

export default function AdminRequestList({ filters, result }: { filters: AdminRequestFilters; result: Result }) {
  const { requests, counts, categories, matching, page, pageCount, pageSize } = result;
  const stats = [
    { label: "Demandes de service", value: counts.total, icon: ClipboardList, tone: "blue" },
    { label: "En attente", value: counts.pending, icon: CalendarClock, tone: "amber" },
    { label: "En cours", value: counts.inProgress, icon: MessageSquareText, tone: "cyan" },
    { label: "Terminées", value: counts.completed, icon: ClipboardList, tone: "green" },
    { label: "Annulées", value: counts.cancelled, icon: ClipboardList, tone: "slate" },
    { label: "Refusées", value: counts.rejected, icon: ClipboardList, tone: "slate" },
    { label: "Urgentes", value: counts.urgent, icon: Siren, tone: "rose" },
  ];
  const hasFilters = Boolean(filters.q || filters.status !== "ALL" || filters.category || filters.urgency !== "ALL" || filters.type !== "ALL");

  return <div className="admin-content admin-requests-page">
    <div className="admin-page-heading"><div><div className="admin-eyebrow"><span/>SUPERVISION DE LA PLATEFORME</div><h1>Demandes et interventions</h1><p>Consultez les demandes, réservations et événements sans modifier leur parcours métier.</p></div><span className="admin-total-pill">{new Intl.NumberFormat("fr-FR").format(counts.total)} demandes de service</span></div>

    <section className="admin-request-stat-grid" aria-label="Statistiques des demandes">
      {stats.map(({ label, value, icon: Icon, tone }) => <article className="admin-request-stat" key={label}><span className={`admin-request-stat-icon tone-${tone}`}><Icon size={17}/></span><span>{label}</span><strong>{new Intl.NumberFormat("fr-FR").format(value)}</strong></article>)}
    </section>

    <section className="admin-card">
      <form className="admin-toolbar admin-request-filters" action="/admin/demandes" method="get">
        <label className="admin-search"><Search size={16} aria-hidden="true"/><input name="q" defaultValue={filters.q} maxLength={100} placeholder="Titre, client, e-mail ou professionnel…" aria-label="Rechercher une demande"/></label>
        <label className="admin-filter"><span>Type</span><select name="type" defaultValue={filters.type}><option value="ALL">Tous les types</option><option value="SERVICE">Demandes de service</option><option value="MESSAGE">Messages</option></select></label>
        <label className="admin-filter"><span>Statut</span><select name="status" defaultValue={filters.status}><option value="ALL">Tous les statuts</option><option value="SENT">Envoyée</option><option value="QUOTED">Devis reçu</option><option value="PRICE_ACCEPTED">Prix accepté</option><option value="BOOKED">Confirmée</option><option value="EN_ROUTE">En route</option><option value="IN_PROGRESS">En cours</option><option value="COMPLETED">Terminée</option><option value="CANCELLED">Annulée</option><option value="REJECTED">Refusée</option><option value="CONVERSATION">Conversation libre</option></select></label>
        <label className="admin-filter"><span>Catégorie</span><select name="category" defaultValue={filters.category}><option value="">Toutes les catégories</option>{categories.map((category) => <option value={category} key={category}>{category}</option>)}</select></label>
        <label className="admin-filter"><span>Urgence</span><select name="urgency" defaultValue={filters.urgency}><option value="ALL">Toutes</option><option value="NORMAL">Normale</option><option value="SOON">Sous 48 h</option><option value="URGENT">Urgente</option></select></label>
        <label className="admin-filter"><span>Création</span><select name="sort" defaultValue={filters.sort}><option value="newest">Plus récentes</option><option value="oldest">Plus anciennes</option></select></label>
        <button className="admin-button admin-button-primary" type="submit">Filtrer</button>
      </form>

      {requests.length === 0
        ? <div className="admin-empty"><span><ClipboardList size={21}/></span><h2>{hasFilters ? "Aucun résultat correspondant" : "Aucune demande enregistrée"}</h2><p>{hasFilters ? "Modifiez la recherche ou les filtres pour afficher des résultats." : "Les demandes réelles apparaîtront ici dès leur création."}</p></div>
        : <div className="admin-table-wrap admin-request-table-wrap"><table className="admin-table admin-request-table"><thead><tr><th>Demande</th><th>Client</th><th>Professionnel</th><th>Type</th><th>Statut</th><th>Urgence</th><th>Création</th><th/></tr></thead><tbody>{requests.map((request) => <tr key={request.id}>
          <td><span className="admin-request-title"><strong>{request.title}</strong><small>{request.category || "Sans catégorie"}</small></span></td>
          <td><span className="admin-request-person"><strong>{request.client.name}</strong><small>{request.client.email}</small></span></td>
          <td><span className="admin-request-person"><strong>{request.professional.businessName || request.professional.name}</strong><small>{request.professional.name}</small></span></td>
          <td><span className={`admin-request-kind ${request.kind === "MESSAGE" ? "is-message" : "is-service"}`}>{request.kind === "MESSAGE" ? "Message" : request.kind === "INTERVENTION" ? "Intervention" : request.kind}</span></td>
          <td><span className={`admin-status status-${request.status.toLowerCase()}`}><i/>{statusLabels[request.status] ?? request.status}</span></td>
          <td><span className={`admin-request-urgency urgency-${request.urgency.toLowerCase()}`}>{urgencyLabels[request.urgency] ?? request.urgency}</span></td>
          <td>{dateFormat.format(request.createdAt)}</td>
          <td><Link className="admin-view-link" href={`/admin/demandes/${request.id}`}>Consulter <ArrowRight size={13}/></Link></td>
        </tr>)}</tbody></table></div>}

      <footer className="admin-request-pagination"><span>{matching === 0 ? "0 résultat" : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, matching)} sur ${matching}`}</span><div><Link aria-disabled={page <= 1} className={page <= 1 ? "is-disabled" : ""} href={pageHref(filters, Math.max(1, page - 1))}><ArrowLeft size={14}/>Précédent</Link><span>Page {matching === 0 ? "—" : page} / {pageCount}</span><Link aria-disabled={page >= pageCount} className={page >= pageCount ? "is-disabled" : ""} href={pageHref(filters, Math.max(1, Math.min(pageCount, page + 1)))}>Suivant<ArrowRight size={14}/></Link></div></footer>
    </section>
  </div>;
}
