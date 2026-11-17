"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCheck, ClipboardList, Clock3, Eye, Inbox, MessageSquareText, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import type { getAdminComplaintList } from "@/app/lib/admin-complaints";
import { complaintStatuses, complaintPriorities, complaintRoles } from "@/lib/admin-complaint-filters";
import AdminAutoFiltersForm from "./AdminAutoFiltersForm";
import AdminComplaintDrawer from "./AdminComplaintDrawer";

type Result = Awaited<ReturnType<typeof getAdminComplaintList>>;
const number = new Intl.NumberFormat("fr-FR");
const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Africa/Tunis" });
const text = (labels: Record<string, string>, value: string) => labels[value] ?? value;
function pageHref(result: Result, page: number) {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(result.filters)) if (name !== "page" && value && value !== "ALL") params.set(name, String(value));
  params.set("page", String(page));
  return `/admin/reclamations?${params}`;
}

export default function AdminComplaintList({ result }: { result: Result }) {
  const { complaints, statuses, stats, matching, page, pageCount, pageSize, filters } = result;
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const hasFilters = Boolean(filters.q || filters.status !== "ALL" || filters.priority !== "ALL" || filters.role !== "ALL" || filters.from || filters.to);
  const cards = [
    { label: "Total", detail: "Toutes les réclamations", value: stats.total, icon: ClipboardList, tone: "forest" },
    { label: "En attente", detail: "À prendre en charge", value: stats.pending, icon: Clock3, tone: "amber" },
    { label: "En cours de traitement", detail: "Dossiers pris en charge", value: stats.inProgress, icon: MessageSquareText, tone: "blue" },
    { label: "Résolues", detail: "Dossiers résolus et clôturés", value: stats.resolved, icon: CheckCheck, tone: "green" },
  ];
  return <div className="admin-content admin-complaints-page">
    <header className="admin-page-heading cc-page-heading"><div><div className="admin-eyebrow"><span/>RELATION & CONFIANCE</div><h1>Réclamations</h1><p>Écoutez, répondez et accompagnez chaque demande jusqu’à sa résolution.</p></div></header>
    <section className="admin-complaint-stat-grid" aria-label="Statistiques des réclamations">{cards.map(({ label, detail, value, icon: Icon, tone }) => <article className={`cc-kpi cc-tone-${tone}`} key={label}><span className="cc-kpi-icon"><Icon size={21} strokeWidth={1.8}/></span><div><span className="cc-kpi-label">{label}</span><strong>{number.format(value)}</strong><small>{detail}</small></div></article>)}</section>
    <section className="admin-card cc-list-card">
      <div className="cc-list-heading"><div><span className="cc-section-icon"><MessageSquareText size={17}/></span><h2>Suivi des réclamations</h2></div><span role="status">{number.format(matching)} résultat{matching > 1 ? "s" : ""}</span></div>
      <AdminAutoFiltersForm action="/admin/reclamations" className="cc-filters">
        <label className="cc-search"><Search size={17} aria-hidden="true"/><input name="q" type="search" defaultValue={filters.q} maxLength={120} placeholder="Référence, sujet, nom ou e-mail…" aria-label="Rechercher une réclamation"/></label>
        <label><span>Statut</span><select name="status" defaultValue={filters.status}><option value="ALL">Tous les statuts</option>{statuses.map(status => <option value={status} key={status}>{text(complaintStatuses, status)}</option>)}</select></label>
        <label><span>Priorité</span><select name="priority" defaultValue={filters.priority}><option value="ALL">Toutes les priorités</option>{Object.entries(complaintPriorities).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>Rôle utilisateur</span><select name="role" defaultValue={filters.role}><option value="ALL">Tous les rôles</option>{Object.entries(complaintRoles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>Du</span><input name="from" type="date" defaultValue={filters.from} max={filters.to || undefined} onChange={event => event.currentTarget.form?.requestSubmit()}/></label>
        <label><span>Au</span><input name="to" type="date" defaultValue={filters.to} min={filters.from || undefined} onChange={event => event.currentTarget.form?.requestSubmit()}/></label>
        <label><span>Trier</span><select name="sort" defaultValue={filters.sort}><option value="newest">Plus récentes</option><option value="oldest">Plus anciennes</option></select></label>
        {hasFilters && <Link className="cc-filter-reset" href="/admin/reclamations"><RotateCcw size={14}/>Réinitialiser</Link>}
      </AdminAutoFiltersForm>
      {complaints.length === 0 ? <div className="cc-empty"><span><Inbox size={30} strokeWidth={1.5}/></span><h2>{hasFilters ? "Aucune réclamation correspondante" : "Tout est calme pour le moment"}</h2><p>{hasFilters ? "Essayez un autre terme ou ajustez vos filtres pour retrouver un dossier." : "Les réclamations apparaîtront ici dès leur envoi par les utilisateurs."}</p>{hasFilters && <Link href="/admin/reclamations" className="admin-button admin-button-light"><SlidersHorizontal size={15}/>Afficher toutes les réclamations</Link>}</div> : <div className="cc-table-scroll"><table className="cc-table"><thead><tr><th>Référence</th><th>Utilisateur</th><th>Rôle</th><th>Sujet</th><th>Date</th><th>Priorité</th><th>Statut</th><th>Actions</th></tr></thead><tbody>{complaints.map(complaint => <tr key={complaint.id} onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey) setSelectedId(complaint.id); }}>
        <td><a className="cc-reference" href={`/admin/reclamations/${complaint.id}`} onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey) { event.preventDefault(); setSelectedId(complaint.id); } }}>REC-{String(complaint.id).padStart(4, "0")}</a></td>
        <td><div className="cc-user-cell"><span className="cc-avatar">{complaint.client.name.split(/\s+/).slice(0, 2).map(part => part[0]).join("")}</span><div><strong>{complaint.client.name}</strong><small>{complaint.client.email}</small></div></div></td>
        <td><span className={`cc-role role-${complaint.client.role.toLowerCase()}`}>{text(complaintRoles, complaint.client.role)}</span></td>
        <td className="cc-subject-cell"><strong title={complaint.subject}>{complaint.subject}</strong><small>{complaint.response ? "Réponse envoyée" : "Sans réponse"}</small></td>
        <td className="cc-date-cell">{date.format(new Date(complaint.createdAt))}</td>
        <td><span className={`cc-priority priority-${complaint.priority.toLowerCase()}`}><i/>{text(complaintPriorities, complaint.priority)}</span></td>
        <td><span className={`cc-status status-${complaint.status.toLowerCase()}`}>{text(complaintStatuses, complaint.status)}</span></td>
        <td><button className="cc-open-button" onClick={() => setSelectedId(complaint.id)} aria-label={`Consulter la réclamation ${complaint.subject}`}><Eye size={15}/><span>Consulter</span></button></td>
      </tr>)}</tbody></table></div>}
      {matching > 0 && <footer className="cc-pagination"><span>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, matching)} sur {number.format(matching)} réclamation{matching > 1 ? "s" : ""}</span><nav aria-label="Pagination des réclamations"><Link aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : undefined} className={page <= 1 ? "is-disabled" : ""} href={pageHref(result, Math.max(1, page - 1))}><ArrowLeft size={14}/><span>Précédent</span></Link><span className="cc-page-number">{page} <small>/ {pageCount}</small></span><Link aria-disabled={page >= pageCount} tabIndex={page >= pageCount ? -1 : undefined} className={page >= pageCount ? "is-disabled" : ""} href={pageHref(result, Math.max(1, Math.min(pageCount, page + 1)))}><span>Suivant</span><ArrowRight size={14}/></Link></nav></footer>}
    </section>
    {selectedId !== null && <AdminComplaintDrawer key={selectedId} complaintId={selectedId} onClose={() => setSelectedId(null)}/>}
  </div>;
}
