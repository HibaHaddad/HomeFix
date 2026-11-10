import Link from "next/link";
import { ArrowLeft, ArrowRight, Filter, ShieldCheck, Star, CalendarDays, MessagesSquare, CreditCard, Scale, Bell, Activity, Settings } from "lucide-react";

export const adminDate = (value: Date | string) => new Intl.DateTimeFormat("fr-TN", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Tunis" }).format(new Date(value));
export const adminMoney = (millimes: number) => new Intl.NumberFormat("fr-TN", { style: "currency", currency: "TND", minimumFractionDigits: 3 }).format(millimes / 1000);
const labels: Record<string, string> = { OPEN: "Ouvert", RESOLVED: "Résolu", IN_PROGRESS: "En cours", CLOSED: "Clos", SENT: "Envoyée", QUOTED: "Devis reçu", PRICE_ACCEPTED: "Prix accepté", BOOKED: "Réservée", EN_ROUTE: "En route", COMPLETED: "Terminée", CANCELLED: "Annulée", REJECTED: "Refusée", PROPOSED: "Proposée", COUNTER_PROPOSED: "Contre-proposition", CONFIRMED: "Confirmée", SUCCEEDED: "Réussi", REFUNDED: "Remboursé", PENDING: "En attente", PROCESSING: "En traitement", FAILED: "Échec", CREATING: "Initialisation", EXPIRED: "Expiré", NONE: "Sans décision", HIDDEN: "Masqué", APPROVED: "Approuvé", ACTIVE: "Actif", DISMISSED: "Classé" };
export function AdminBadge({ value }: { value: string }) { return <span className={`aw-badge tone-${value.toLowerCase()}`}>{labels[value] ?? value.replaceAll("_", " ")}</span>; }
export function AdminSection({ title, description, children, eyebrow = "HOMEFIX TN · ADMINISTRATION", actions }: { title: string; description: string; eyebrow?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  const Icon = title.includes("Avis") ? Star : title.includes("Réservations") ? CalendarDays : title.includes("Messagerie") || title.includes("Conversation") ? MessagesSquare : title.includes("Paiements") ? CreditCard : title.includes("Sanctions") ? Scale : title.includes("Notifications") ? Bell : title.includes("audit") ? Activity : title.includes("Paramètres") ? Settings : ShieldCheck;
  return <div className="admin-content aw-workspace"><header className="aw-heading"><div><span className="aw-eyebrow"><ShieldCheck size={13}/>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div><div className="aw-heading-aside"><span className="aw-section-emblem" aria-hidden="true"><Icon size={34} strokeWidth={1.35}/></span>{actions}</div></header>{children}</div>;
}
export function AdminMetrics({ items }: { items: { label: string; value: string | number; detail?: string }[] }) {
  return <div className="aw-metrics">{items.map(i => <article className="aw-metric" key={i.label}><span>{i.label}</span><strong>{i.value}</strong>{i.detail && <small>{i.detail}</small>}</article>)}</div>;
}
export function AdminFilters({ q, status, options, children }: { q: string; status: string; options: { value: string; label: string }[]; children?: React.ReactNode }) {
  return <form className="aw-filters"><label><span>Rechercher</span><input type="search" name="q" defaultValue={q} placeholder="Nom, référence, sujet…" maxLength={100}/></label>{options.length > 0 && <label><span>Statut</span><select name="status" defaultValue={status}><option value="ALL">Tous les statuts</option>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>}{children}<button className="admin-button admin-button-primary" type="submit"><Filter size={14}/>Filtrer</button><Link className="admin-button admin-button-light" href="?">Réinitialiser</Link></form>;
}
export function AdminTable({ headings, children, empty }: { headings: string[]; children: React.ReactNode; empty?: boolean }) {
  return <div className="aw-panel">{empty ? <div className="aw-empty"><Filter size={26}/><h2>Aucun résultat</h2><p>Les données apparaîtront ici dès qu’elles seront disponibles. Vous pouvez aussi ajuster vos filtres.</p></div> : <div className="aw-table-scroll"><table className="aw-table"><thead><tr>{headings.map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>}</div>;
}
export function AdminPagination({ page, total, query }: { page: number; total: number; query: Record<string, string> }) {
  const pages = Math.max(1, Math.ceil(total / 20));
  const href = (p: number) => `?${new URLSearchParams({ ...query, page: String(p) })}`;
  return <nav className="aw-pagination" aria-label="Pagination"><span>{total} résultat{total > 1 ? "s" : ""} · Page {page} / {pages}</span><div>{page > 1 && <Link href={href(page - 1)}><ArrowLeft size={14}/>Précédent</Link>}{page < pages && <Link href={href(page + 1)}>Suivant<ArrowRight size={14}/></Link>}</div></nav>;
}
