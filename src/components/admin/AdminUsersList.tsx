import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Search, Shield, UserRound, Users } from "lucide-react";
import type { AdminUserFilters } from "@/app/lib/admin-users";

type Result = Awaited<ReturnType<typeof import("@/app/lib/admin-users").getAdminUserList>>;
const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Africa/Tunis" });
const roleLabel: Record<string, string> = { CLIENT: "Client", PROFESSIONAL: "Prestataire", ADMIN: "Administrateur" };
const verificationLabel: Record<string, string> = {
  PENDING_VERIFICATION: "Vérification en attente", APPROVED: "Vérifié", REJECTED: "Dossier refusé",
};

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function pageHref(filters: AdminUserFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.role !== "ALL") params.set("role", filters.role.toLowerCase());
  if (filters.account !== "ALL") params.set("account", filters.account.toLowerCase());
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  params.set("page", String(page));
  return `/admin/utilisateurs?${params.toString()}`;
}

export default function AdminUsersList({ filters, result }: { filters: AdminUserFilters; result: Result }) {
  const { counts, users, matching, page, pageCount } = result;
  const stats = [
    { label: "Utilisateurs", value: counts.total, icon: Users, tone: "blue" },
    { label: "Clients", value: counts.clients, icon: UserRound, tone: "violet" },
    { label: "Prestataires", value: counts.professionals, icon: BriefcaseBusiness, tone: "cyan" },
    { label: "Comptes suspendus", value: counts.suspended, icon: Shield, tone: "rose" },
  ];

  return <div className="admin-content admin-users-page">
    <div className="admin-page-heading admin-users-heading">
      <div><div className="admin-eyebrow"><span/>GESTION DE LA PLATEFORME</div><h1>Gestion des utilisateurs</h1><p>Consultez les comptes et leurs informations de profil.</p></div>
      <span className="admin-users-total">{new Intl.NumberFormat("fr-FR").format(counts.total)} comptes</span>
    </div>

    <section className="admin-users-stats" aria-label="Comptes par catégorie">
      {stats.map(({ label, value, icon: Icon, tone }) => <article className="admin-users-stat" key={label}>
        <span className={`admin-users-stat-icon tone-${tone}`}><Icon size={19}/></span><span>{label}</span><strong>{new Intl.NumberFormat("fr-FR").format(value)}</strong>
      </article>)}
    </section>

    <section className="admin-card admin-users-card">
      <form className="admin-users-filters" action="/admin/utilisateurs" method="get">
        <label className="admin-users-search"><Search size={17}/><input name="q" defaultValue={filters.q} placeholder="Nom, email ou téléphone" aria-label="Rechercher par nom, email ou téléphone" maxLength={100}/></label>
        <label><span>Rôle</span><select name="role" defaultValue={filters.role}><option value="ALL">Tous les utilisateurs</option><option value="CLIENT">Clients</option><option value="PROFESSIONAL">Prestataires</option><option value="ADMIN">Administrateurs</option></select></label>
        <label><span>Compte</span><select name="account" defaultValue={filters.account}><option value="ALL">Tous les statuts</option><option value="ACTIVE">Actifs</option><option value="SUSPENDED">Suspendus</option></select></label>
        <label><span>Inscription</span><select name="sort" defaultValue={filters.sort}><option value="newest">Plus récents</option><option value="oldest">Plus anciens</option></select></label>
        <button type="submit" className="admin-users-filter-button">Filtrer</button>
      </form>

      <div className="admin-users-table-wrap">
        {users.length === 0 ? <div className="admin-users-empty"><span><Users size={21}/></span><h2>{matching === 0 && filters.q ? "Aucun résultat" : "Aucun utilisateur"}</h2><p>{filters.q || filters.role !== "ALL" || filters.account !== "ALL" ? "Modifiez la recherche ou les filtres pour continuer." : "Les comptes apparaîtront ici après leur inscription."}</p></div> : <table className="admin-users-table">
          <thead><tr><th>Utilisateur</th><th>Coordonnées</th><th>Rôle</th><th>Statut du compte</th><th>Inscription</th><th>Action</th></tr></thead>
          <tbody>{users.map((user) => <tr key={user.id}>
            <td><span className="admin-user-identity"><span className="admin-user-avatar">{user.profilePhotoMime ? <Image src={`/api/admin/users/${user.id}/avatar`} alt="" width={38} height={38} unoptimized/> : initials(user.name)}</span><span><strong>{user.name}</strong>{user.role === "PROFESSIONAL" && user.specialty && <small>{user.specialty}</small>}</span></span></td>
            <td><strong className="admin-user-email">{user.email}</strong><small className="admin-user-phone">{user.phone || "Téléphone non renseigné"}</small></td>
            <td><span className={`admin-role-badge role-${user.role.toLowerCase()}`}>{roleLabel[user.role] ?? user.role}</span>{user.role === "PROFESSIONAL" && <small className="admin-user-verification">{verificationLabel[user.status] ?? user.status}</small>}</td>
            <td><span className={`admin-account-badge ${user.isSuspended ? "is-suspended" : "is-active"}`}><i/>{user.isSuspended ? "Suspendu" : "Actif"}</span></td>
            <td className="admin-user-date">{dateFormat.format(user.createdAt)}</td>
            <td><Link className="admin-user-detail-link" href={`/admin/utilisateurs/${user.id}`}>Voir le profil <ArrowRight size={14}/></Link></td>
          </tr>)}</tbody>
        </table>}
      </div>
      <footer className="admin-users-pagination">
        <span>{matching === 0 ? "0 résultat" : `${(page - 1) * filters.pageSize + 1}–${Math.min(page * filters.pageSize, matching)} sur ${matching}`}</span>
        <div><Link aria-disabled={page <= 1} className={page <= 1 ? "is-disabled" : ""} href={pageHref(filters, Math.max(1, page - 1))}><ArrowLeft size={15}/>Précédent</Link><span>Page {matching === 0 ? "—" : page} / {pageCount}</span><Link aria-disabled={page >= pageCount} className={page >= pageCount ? "is-disabled" : ""} href={pageHref(filters, Math.max(1, Math.min(pageCount, page + 1)))}>Suivant<ArrowRight size={15}/></Link></div>
      </footer>
    </section>
  </div>;
}
