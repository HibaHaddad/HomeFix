import Link from "next/link";
import { ArrowLeft, ArrowRight, Search, Users } from "lucide-react";
import type { AdminProfessionalFilters } from "@/app/lib/admin-professionals";

export type ReviewRow = {
  id: number;
  name: string;
  email: string;
  businessName: string;
  specialty: string;
  serviceCity: string;
  createdAt: string;
  status: string;
  isSuspended: boolean;
};

type Result = {
  professionals: ReviewRow[];
  specialties: string[];
  counts: { total: number; pending: number; approved: number; rejected: number; suspended: number };
  matching: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

const statusText: Record<string, string> = {
  PENDING_VERIFICATION: "En attente",
  APPROVED: "Approuvé",
  REJECTED: "Refusé",
};

function pageHref(filters: AdminProfessionalFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.specialty) params.set("specialty", filters.specialty);
  if (filters.status !== "ALL") params.set("status", filters.status);
  if (filters.account !== "ALL") params.set("account", filters.account);
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  params.set("page", String(page));
  return `/admin/professionnels?${params.toString()}`;
}

export default function ProfessionalReviewList({ filters, result }: { filters: AdminProfessionalFilters; result: Result }) {
  const { professionals, specialties, counts, matching, page, pageCount } = result;
  const stats = [
    ["Tous les professionnels", counts.total],
    ["En attente", counts.pending],
    ["Approuvés actifs", counts.approved],
    ["Refusés", counts.rejected],
    ["Suspendus", counts.suspended],
  ] as const;

  return <div className="admin-content admin-professionals-page">
    <div className="admin-page-heading">
      <div><div className="admin-eyebrow"><span/>ESPACE ADMINISTRATEUR</div><h1>Validation des professionnels</h1><p>Examinez les dossiers et suivez leur état de vérification et de compte.</p></div>
      <span className="admin-total-pill">{counts.total} professionnel{counts.total !== 1 ? "s" : ""}</span>
    </div>

    <section className="admin-professional-stats" aria-label="Résumé des professionnels">
      {stats.map(([label, value]) => <article className="admin-professional-stat" key={label}><span>{label}</span><strong>{new Intl.NumberFormat("fr-FR").format(value)}</strong></article>)}
    </section>

    <section className="admin-card">
      <form className="admin-toolbar admin-professional-filters" action="/admin/professionnels" method="get">
        <label className="admin-search"><Search size={16} aria-hidden="true"/><input name="q" defaultValue={filters.q} maxLength={100} placeholder="Nom, e-mail ou spécialité…" aria-label="Rechercher par nom, e-mail ou spécialité"/></label>
        <label className="admin-filter"><span>Spécialité</span><select name="specialty" defaultValue={filters.specialty}><option value="">Toutes les spécialités</option>{specialties.map((specialty) => <option value={specialty} key={specialty}>{specialty}</option>)}</select></label>
        <label className="admin-filter"><span>Vérification</span><select name="status" defaultValue={filters.status}><option value="ALL">Tous les statuts</option><option value="PENDING_VERIFICATION">En attente</option><option value="APPROVED">Approuvés</option><option value="REJECTED">Refusés</option></select></label>
        <label className="admin-filter"><span>Compte</span><select name="account" defaultValue={filters.account}><option value="ALL">Tous les comptes</option><option value="ACTIVE">Actifs</option><option value="SUSPENDED">Suspendus</option></select></label>
        <label className="admin-filter"><span>Inscription</span><select name="sort" defaultValue={filters.sort}><option value="newest">Plus récents</option><option value="oldest">Plus anciens</option></select></label>
        <button className="admin-button admin-button-primary" type="submit">Filtrer</button>
      </form>

      {professionals.length === 0
        ? <div className="admin-empty"><span><Users size={21}/></span><h2>{matching === 0 && (filters.q || filters.status !== "ALL" || filters.account !== "ALL") ? "Aucun dossier correspondant" : "Aucune inscription professionnelle"}</h2><p>{matching === 0 && (filters.q || filters.status !== "ALL" || filters.account !== "ALL") ? "Modifiez la recherche ou les filtres pour afficher des résultats." : "Les nouveaux dossiers apparaîtront ici après leur inscription."}</p></div>
        : <div className="admin-table-wrap admin-professional-table-wrap"><table className="admin-table admin-professional-table"><thead><tr><th>Professionnel</th><th>E-mail</th><th>Spécialité</th><th>Ville de service</th><th>Inscription</th><th>Vérification</th><th>Compte</th><th><span className="sr-only">Dossier</span></th></tr></thead><tbody>{professionals.map((person) => <tr key={person.id}>
          <td><span className="admin-person"><span className="admin-person-avatar">{(person.businessName || person.name).slice(0, 1).toUpperCase()}</span><span><strong>{person.businessName || person.name}</strong><small>{person.name}</small></span></span></td>
          <td>{person.email}</td><td>{person.specialty || "—"}</td><td>{person.serviceCity || "—"}</td>
          <td>{new Date(person.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Tunis" })}</td>
          <td><span className={`admin-status status-${person.status.toLowerCase()}`}><i/>{statusText[person.status] || person.status}</span></td>
          <td><span className={`admin-professional-account ${person.isSuspended ? "is-suspended" : "is-active"}`}>{person.isSuspended ? "Suspendu" : "Actif"}</span></td>
          <td><Link className="admin-view-link" href={`/admin/professionnels/${person.id}`}>Voir le dossier <ArrowRight size={13}/></Link></td>
        </tr>)}</tbody></table></div>}

      <footer className="admin-professional-pagination">
        <span>{matching === 0 ? "0 résultat" : `${(page - 1) * result.pageSize + 1}–${Math.min(page * result.pageSize, matching)} sur ${matching}`}</span>
        <div><Link aria-disabled={page <= 1} className={page <= 1 ? "is-disabled" : ""} href={pageHref(filters, Math.max(1, page - 1))}><ArrowLeft size={14}/>Précédent</Link><span>Page {matching === 0 ? "—" : page} / {pageCount}</span><Link aria-disabled={page >= pageCount} className={page >= pageCount ? "is-disabled" : ""} href={pageHref(filters, Math.max(1, Math.min(pageCount, page + 1)))}>Suivant<ArrowRight size={14}/></Link></div>
      </footer>
    </section>
  </div>;
}
