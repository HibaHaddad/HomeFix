import Link from "next/link";
import { Activity, CalendarDays, ClipboardList, FileSearch, History, LockKeyhole, RotateCcw, Search, Settings2, ShieldCheck, Users } from "lucide-react";
import { requireAdminPage } from "@/app/lib/admin-access";
import { adminAudit, opsFilters } from "@/app/lib/admin-operations";
import { prisma } from "@/app/lib/prisma";
import { AdminSection, AdminTable, AdminPagination } from "@/components/admin/AdminWorkspace";
import AdminAutoFiltersForm from "@/components/admin/AdminAutoFiltersForm";
import "./audit.css";

const labels: Record<string, string> = {
  USER_UPDATE: "Informations du compte modifiées", USER_SUSPEND: "Compte suspendu", USER_REACTIVATE: "Compte réactivé",
  PROFESSIONAL_APPROVED: "Profil professionnel approuvé", PROFESSIONAL_REJECTED: "Profil professionnel refusé",
  REVIEW_HIDE: "Avis masqué", REVIEW_PUBLISH: "Avis republié", REVIEW_DISMISS: "Signalement classé",
  COMPLAINT_STATUS: "Statut de réclamation modifié", COMPLAINT_PRIORITY: "Priorité de réclamation modifiée", COMPLAINT_RESPONSE: "Réponse à une réclamation",
  CONVERSATION_READ: "Conversation consultée", DOCUMENT_READ: "Document consulté", NOTIFICATIONS_READ: "Notifications marquées comme lues",
  SETTINGS_UPDATE: "Paramètres modifiés", CATEGORY_CREATE: "Catégorie ajoutée", CATEGORY_UPDATE: "Catégorie modifiée", CATEGORY_ACTIVATE: "Catégorie activée", CATEGORY_DEACTIVATE: "Catégorie désactivée", CATEGORY_DELETE: "Catégorie supprimée",
  REFUND_REQUEST: "Remboursement demandé", REFUND_SUCCEEDED: "Remboursement confirmé", REFUND_PENDING: "Remboursement en attente", REFUND_FAILED: "Échec du remboursement",
  SANCTION_APPLY: "Sanction appliquée", SANCTION_REJECT: "Sanction refusée", SANCTION_REVOKE: "Sanction annulée", SANCTION_ACCEPT_APPEAL: "Contestation acceptée", SANCTION_UPHOLD_APPEAL: "Sanction maintenue", SANCTION_RULES_UPDATE: "Règles de sanction modifiées",
};
const actionLabel = (value: string) => labels[value] ?? value.replaceAll("_", " ").toLocaleLowerCase("fr-FR");
const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Africa/Tunis" });
const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Tunis" });
function category(action: string) {
  if (action.endsWith("_READ")) return { label: "Consultation", tone: "blue", icon: FileSearch };
  if (action.startsWith("SANCTION_") || action === "USER_SUSPEND") return { label: "Décision", tone: "rose", icon: ShieldCheck };
  if (action.startsWith("SETTINGS_") || action.startsWith("CATEGORY_")) return { label: "Configuration", tone: "peach", icon: Settings2 };
  return { label: "Gestion", tone: "green", icon: Activity };
}
function targetLabel(target: string) {
  if (target.startsWith("settings:DASHBOARD_PREFERENCES")) return "Préférences du dashboard";
  const kinds: Record<string, string> = { user: "Compte utilisateur", review: "Avis client", complaint: "Réclamation", conversation: "Conversation", settings: "Paramètres Admin", category: "Catégorie de service", payment: "Paiement", sanction: "Dossier de sanction", sanctions: "Règles de sanction" };
  return kinds[target.split(":")[0]] ?? "Dossier enregistré";
}

export default async function AuditPage({ searchParams }: PageProps<"/admin/activites">) {
  await requireAdminPage();
  const actions = await prisma.adminAuditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } });
  const f = opsFilters(await searchParams, actions.map(a => a.action));
  const now = new Date();
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Tunis", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const [data, total, today, actors] = await Promise.all([
    adminAudit(f), prisma.adminAuditLog.count(), prisma.adminAuditLog.count({ where: { createdAt: { gte: new Date(`${day}T00:00:00+01:00`) } } }), prisma.adminAuditLog.findMany({ distinct: ["actorId"], select: { actorId: true } }),
  ]);
  const metrics = [
    { label: "Événements enregistrés", value: total, detail: "Historique complet", icon: History, tone: "green" },
    { label: "Actions aujourd’hui", value: today, detail: "Depuis minuit · heure de Tunis", icon: CalendarDays, tone: "peach" },
    { label: "Administrateurs intervenants", value: actors.length, detail: "Comptes présents dans le journal", icon: Users, tone: "blue" },
    { label: "Types d’action", value: actions.length, detail: "Décisions et consultations tracées", icon: ClipboardList, tone: "rose" },
  ];
  const filtered = Boolean(f.q || f.status !== "ALL");
  return <div className="admin-audit-page"><AdminSection title="Journal d’audit" description="Retrouvez les décisions, les modifications et les consultations sensibles de l’équipe." actions={<span className="au-readonly"><LockKeyhole size={14}/>Traçabilité protégée</span>}>
    <section className="admin-kpi-grid au-kpis" aria-label="Résumé du journal">{metrics.map(({ label, value, detail, icon: Icon, tone }) => <article className="admin-kpi-card" key={label}><span className={`admin-kpi-icon tone-${tone}`}><Icon size={20} strokeWidth={1.8}/></span><span className="admin-kpi-label">{label}</span><strong className="admin-kpi-value">{new Intl.NumberFormat("fr-FR").format(value)}</strong><small className="admin-kpi-detail">{detail}</small></article>)}</section>
    <section className="au-history" aria-labelledby="au-history-title"><header className="au-list-heading"><div><span><Activity size={18}/></span><div><h2 id="au-history-title">{filtered ? "Événements correspondants" : "Historique des actions"}</h2><p>Chaque événement conserve sa date, son auteur et son contexte.</p></div></div><small>{data.total} résultat{data.total > 1 ? "s" : ""}</small></header>
      <AdminAutoFiltersForm action="/admin/activites" className="au-filters"><label className="au-search"><span>Rechercher dans le journal</span><span><Search size={16}/><input type="search" name="q" defaultValue={f.q} maxLength={100} placeholder="Administrateur, dossier ou motif…"/></span></label><label className="au-action-filter"><span>Type d’action</span><select name="status" defaultValue={f.status}><option value="ALL">Toutes les actions</option>{actions.map(a => <option key={a.action} value={a.action}>{actionLabel(a.action)}</option>)}</select></label>{filtered && <Link className="au-reset" href="/admin/activites"><RotateCcw size={14}/>Réinitialiser</Link>}</AdminAutoFiltersForm>
      {!data.rows.length ? <div className="au-empty"><span><FileSearch size={29} strokeWidth={1.5}/></span><h3>{filtered ? "Aucun événement trouvé" : "Le journal est encore vide"}</h3><p>{filtered ? "Ajustez votre recherche ou le type d’action sélectionné." : "Les décisions et consultations de l’équipe apparaîtront ici."}</p></div> : <div className="au-table"><AdminTable headings={["Date · Tunis", "Administrateur", "Action", "Dossier concerné", "Contexte et détails"]}>{data.rows.map(event => {
        const kind = category(event.action);
        const initials = event.actorName.trim().split(/\s+/).slice(0,2).map(word => word[0]?.toUpperCase()).join("");
        return <tr key={event.id}><td><time className="au-date" dateTime={event.createdAt.toISOString()}>{date.format(event.createdAt)}<small>{time.format(event.createdAt)}</small></time></td><td><div className="au-actor"><span aria-hidden="true">{initials || "A"}</span><div><strong>{event.actorName}</strong><small>Administrateur</small></div></div></td><td><span className={`au-category ${kind.tone}`}><kind.icon size={12}/>{kind.label}</span><p className="au-action-label">{actionLabel(event.action)}</p></td><td><span className="au-target">{targetLabel(event.target)}</span></td><td><p className={`au-reason${event.reason ? "" : " is-empty"}`}>{event.reason || "Aucun motif complémentaire"}</p><details className="au-details"><summary>Voir les détails de traçabilité</summary><dl><div><dt>Événement</dt><dd>{event.id}</dd></div><div><dt>Compte Admin</dt><dd>{event.actorId}</dd></div><div><dt>Code d’action</dt><dd>{event.action}</dd></div><div><dt>Référence du dossier</dt><dd>{event.target}</dd></div><div><dt>Horodatage complet</dt><dd>{event.createdAt.toISOString()}</dd></div></dl><pre>{JSON.stringify(event.details, null, 2)}</pre></details></td></tr>;
      })}</AdminTable></div>}
      {data.total > 0 && <div className="au-pagination"><AdminPagination page={data.page} total={data.total} query={{ q: f.q, status: f.status }}/></div>}
    </section>
  </AdminSection></div>;
}
