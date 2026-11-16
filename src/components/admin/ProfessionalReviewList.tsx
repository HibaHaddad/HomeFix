import Link from "next/link";
import { ArrowLeft, ArrowRight, BadgeCheck, Clock3, FileCheck2, Mail, MapPin, RotateCcw, Search, ShieldBan, UserRoundX, Users, Wrench } from "lucide-react";
import type { AdminProfessionalFilters } from "@/app/lib/admin-professionals";
import AdminAutoFiltersForm from "./AdminAutoFiltersForm";
import { AdminSection } from "./AdminWorkspace";

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
  const filtered = Boolean(filters.q || filters.specialty || filters.status !== "ALL" || filters.account !== "ALL" || filters.sort !== "newest");
  const stats = [
    { label: "Tous les professionnels", value: counts.total, detail: "Ensemble des dossiers", icon: Users, tone: "green" },
    { label: "En attente", value: counts.pending, detail: "Dossiers à examiner", icon: Clock3, tone: "peach" },
    { label: "Approuvés actifs", value: counts.approved, detail: "Accès professionnel validé", icon: BadgeCheck, tone: "sage" },
    { label: "Refusés", value: counts.rejected, detail: "Décision de refus enregistrée", icon: UserRoundX, tone: "rose" },
    { label: "Suspendus", value: counts.suspended, detail: "Accès au compte suspendu", icon: ShieldBan, tone: "blue" },
  ];
  return <div className="admin-professionals-page pv-page"><AdminSection title="Validation des professionnels" description="Examinez les inscriptions, vérifiez les dossiers et suivez les décisions de validation.">
    <section className="admin-kpi-grid pv-kpis" aria-label="Résumé des professionnels">{stats.map(({ label, value, detail, icon: Icon, tone }) => <article className="admin-kpi-card" key={label}><span className={`admin-kpi-icon tone-${tone}`}><Icon size={20} strokeWidth={1.8}/></span><span className="admin-kpi-label">{label}</span><strong className="admin-kpi-value">{new Intl.NumberFormat("fr-FR").format(value)}</strong><small className="admin-kpi-detail">{detail}</small></article>)}</section>
    <section className="pv-list" aria-labelledby="pv-list-title"><header className="pv-list-heading"><span><FileCheck2 size={19}/></span><div><h2 id="pv-list-title">Dossiers des professionnels</h2><p>Consultez chaque dossier avant de prendre une décision.</p></div></header>
      <AdminAutoFiltersForm className="pv-filters" action="/admin/professionnels">
        <label className="pv-search"><span>Rechercher un professionnel</span><span><Search size={16} aria-hidden="true"/><input type="search" name="q" defaultValue={filters.q} maxLength={100} placeholder="Nom, e-mail ou spécialité…"/></span></label>
        <label><span>Spécialité</span><select name="specialty" defaultValue={filters.specialty}><option value="">Toutes les spécialités</option>{specialties.map(specialty => <option value={specialty} key={specialty}>{specialty}</option>)}</select></label>
        <label><span>Vérification</span><select name="status" defaultValue={filters.status}><option value="ALL">Tous les statuts</option><option value="PENDING_VERIFICATION">En attente</option><option value="APPROVED">Approuvés</option><option value="REJECTED">Refusés</option></select></label>
        <label><span>Compte</span><select name="account" defaultValue={filters.account}><option value="ALL">Tous les comptes</option><option value="ACTIVE">Actifs</option><option value="SUSPENDED">Suspendus</option></select></label>
        <label><span>Inscription</span><select name="sort" defaultValue={filters.sort}><option value="newest">Plus récents</option><option value="oldest">Plus anciens</option></select></label>
        {filtered && <Link className="pv-reset" href="/admin/professionnels"><RotateCcw size={13}/>Réinitialiser</Link>}
      </AdminAutoFiltersForm>
      {!professionals.length ? <div className="pv-empty"><span><Users size={28} strokeWidth={1.5}/></span><h3>{filtered ? "Aucun dossier correspondant" : "Aucune inscription professionnelle"}</h3><p>{filtered ? "Modifiez votre recherche ou vos filtres pour retrouver les dossiers souhaités." : "Les nouveaux dossiers apparaîtront ici après leur inscription."}</p></div> : <div className="pv-table-wrap"><table className="pv-table"><thead><tr>{["Professionnel", "Spécialité", "Zone d’intervention", "Inscription", "Vérification", "Compte", "Actions"].map(heading => <th scope="col" key={heading}>{heading}</th>)}</tr></thead><tbody>{professionals.map(person => {
        const date = new Date(person.createdAt);
        const initials = (person.businessName || person.name).trim().split(/\s+/).slice(0,2).map(part => part[0]?.toUpperCase()).join("");
        return <tr key={person.id}><td><div className="pv-person"><span className="pv-avatar" aria-hidden="true">{initials || "P"}</span><div><Link href={`/admin/professionnels/${person.id}`}><strong>{person.businessName || person.name}</strong></Link>{person.businessName && <small>{person.name}</small>}<span className="pv-email"><Mail size={11}/>{person.email}</span></div></div></td><td>{person.specialty ? <span className="pv-specialty"><Wrench size={11}/>{person.specialty}</span> : <span className="pv-missing">Non renseignée</span>}</td><td><span className="pv-location"><MapPin size={12}/>{person.serviceCity || "Non renseignée"}</span></td><td><time className="pv-date" dateTime={person.createdAt}>{date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Tunis" })}<small>{date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Tunis" })}</small></time></td><td><span className={`pv-status ${person.status.toLowerCase()}`}><i/>{statusText[person.status] || person.status}</span></td><td><span className={`pv-account ${person.isSuspended ? "suspended" : "active"}`}><i/>{person.isSuspended ? "Suspendu" : "Actif"}</span></td><td><Link className="pv-view" href={`/admin/professionnels/${person.id}`}>Voir le dossier<ArrowRight size={13}/></Link></td></tr>;
      })}</tbody></table></div>}
      {matching > 0 && <footer className="pv-pagination"><span>{(page - 1) * result.pageSize + 1}–{Math.min(page * result.pageSize, matching)} sur {matching}</span><div><Link aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : undefined} className={page <= 1 ? "is-disabled" : ""} href={pageHref(filters, Math.max(1,page - 1))}><ArrowLeft size={14}/>Précédent</Link><span>Page {page} / {pageCount}</span><Link aria-disabled={page >= pageCount} tabIndex={page >= pageCount ? -1 : undefined} className={page >= pageCount ? "is-disabled" : ""} href={pageHref(filters, Math.max(1,Math.min(pageCount,page + 1)))}>Suivant<ArrowRight size={14}/></Link></div></footer>}
    </section>
  </AdminSection></div>;
}

