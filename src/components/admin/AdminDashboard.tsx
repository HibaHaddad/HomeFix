"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowDownRight, ArrowRight, BriefcaseBusiness, CheckCircle2, ClipboardList,
  Clock3, FolderKanban, MessageSquareWarning, Users, Star, UserRound, CalendarDays,
} from "lucide-react";
import type { DashboardPeriod, getAdminDashboardData } from "@/app/lib/admin-dashboard";

type DashboardData = Awaited<ReturnType<typeof getAdminDashboardData>>;

const periodLabels: Record<DashboardPeriod, string> = {
  today: "Aujourd’hui",
  "7d": "7 derniers jours",
  "30d": "30 derniers jours",
  "12m": "12 derniers mois",
};

const numberFormat = new Intl.NumberFormat("fr-FR");
const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Tunis" });
const statusNames: Record<string, string> = {
  SENT: "Envoyée", QUOTED: "Devis reçu", PRICE_ACCEPTED: "Prix accepté", BOOKED: "Confirmée",
  EN_ROUTE: "En route", IN_PROGRESS: "En cours", COMPLETED: "Terminée", CANCELLED: "Annulée",
  REJECTED: "Refusée", OPEN: "Ouverte", RESOLVED: "Résolue", ACTIVE: "Actif",
  PENDING_VERIFICATION: "En vérification", APPROVED: "Approuvé",
};

function labelStatus(status: string) {
  return statusNames[status] ?? status.replaceAll("_", " ").toLocaleLowerCase("fr-FR");
}

function formatDate(date: Date) {
  return dateFormat.format(date);
}

function chartDateLabel(key: string, period: DashboardPeriod) {
  const date = new Date(`${key}${key.length === 7 ? "-01" : ""}T12:00:00Z`);
  return new Intl.DateTimeFormat("fr-FR", period === "12m"
    ? { month: "short", year: "2-digit", timeZone: "UTC" }
    : { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
}

function LineChart({ title, points, period, color, emptyLabel }: {
  title: string;
  points: { key: string; count: number }[];
  period: DashboardPeriod;
  color: string;
  emptyLabel: string;
}) {
  const width = 640;
  const height = 220;
  const left = 36;
  const right = 12;
  const top = 14;
  const bottom = 32;
  const max = Math.max(1, ...points.map((point) => point.count));
  const x = (index: number) => points.length <= 1
    ? (width - left - right) / 2 + left
    : left + (index / (points.length - 1)) * (width - left - right);
  const y = (value: number) => top + (1 - value / max) * (height - top - bottom);
  const coordinates = points.map((point, index) => `${x(index)},${y(point.count)}`);
  const path = coordinates.length ? `M ${coordinates.join(" L ")}` : "";
  const area = points.length ? `${path} L ${x(points.length - 1)},${height - bottom} L ${x(0)},${height - bottom} Z` : "";
  const tickIndexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  const hasValues = points.some((point) => point.count > 0);

  return <section className="admin-chart-card">
    <div className="admin-chart-heading"><div><span className="admin-section-kicker">TENDANCE</span><h2>{title}</h2></div><span className="admin-chart-range">{periodLabels[period]}</span></div>
    {!hasValues ? <div className="admin-chart-empty"><CalendarDays size={20}/><span>{emptyLabel}</span></div> : <div className="admin-chart-plot">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title} preserveAspectRatio="none">
        {[0, .5, 1].map((fraction) => <g key={fraction}><line x1={left} x2={width - right} y1={y(max * fraction)} y2={y(max * fraction)} className="admin-chart-gridline"/><text x={left - 8} y={y(max * fraction) + 4} textAnchor="end" className="admin-chart-axis">{Math.round(max * fraction)}</text></g>)}
        <path d={area} fill={color} opacity=".09" />
        <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => <circle key={point.key} cx={x(index)} cy={y(point.count)} r="3.5" fill="#fff" stroke={color} strokeWidth="2"><title>{`${chartDateLabel(point.key, period)} : ${numberFormat.format(point.count)}`}</title></circle>)}
        {tickIndexes.map((index) => <text key={index} x={x(index)} y={height - 7} textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"} className="admin-chart-axis">{chartDateLabel(points[index].key, period)}</text>)}
      </svg>
    </div>}
  </section>;
}

function CategoryChart({ categories }: { categories: DashboardData["categories"] }) {
  const max = Math.max(1, ...categories.map(({ count }) => count));
  return <section className="admin-chart-card">
    <div className="admin-chart-heading"><div><span className="admin-section-kicker">DEMANDES</span><h2>Par catégorie</h2></div><ClipboardList size={18} className="admin-chart-icon"/></div>
    {categories.length === 0 ? <div className="admin-chart-empty"><ClipboardList size={20}/><span>Aucune demande sur cette période.</span></div> : <div className="admin-category-list">
      {categories.map(({ category, count }) => <div className="admin-category-row" key={category}>
        <div className="admin-category-label"><span title={category}>{category}</span><strong>{numberFormat.format(count)}</strong></div>
        <div className="admin-bar-track"><span style={{ width: `${Math.max(4, count / max * 100)}%` }}/></div>
      </div>)}
    </div>}
  </section>;
}

function StatusChart({ statuses }: { statuses: DashboardData["requestStatuses"] }) {
  const total = statuses.reduce((sum, item) => sum + item.count, 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const colors = ["#167C68", "#164E42", "#FFB86B", "#75A98F", "#D77A64", "#9BB99A", "#A8A99C", "#C58B36"];

  return <section className="admin-chart-card">
    <div className="admin-chart-heading"><div><span className="admin-section-kicker">DEMANDES</span><h2>Répartition par statut</h2></div><ClipboardList size={18} className="admin-chart-icon"/></div>
    {total === 0 ? <div className="admin-chart-empty"><ClipboardList size={20}/><span>Aucune demande sur cette période.</span></div> : <div className="admin-status-chart">
      <div className="admin-donut-wrap"><svg viewBox="0 0 100 100" role="img" aria-label={`Répartition de ${total} demandes`}>
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#edf0eb" strokeWidth="11"/>
        {statuses.map((item, index) => {
          const length = item.count / total * circumference;
          const offset = -statuses.slice(0, index).reduce((sum, previous) => sum + previous.count / total * circumference, 0);
          return <circle key={item.status} cx="50" cy="50" r={radius} fill="none" stroke={colors[index % colors.length]} strokeWidth="11" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={offset} transform="rotate(-90 50 50)"/>;
        })}
        <text x="50" y="47" textAnchor="middle" className="admin-donut-total">{numberFormat.format(total)}</text><text x="50" y="59" textAnchor="middle" className="admin-donut-caption">demandes</text>
      </svg></div>
      <ul className="admin-status-legend">{statuses.map((item, index) => <li key={item.status}><span style={{ backgroundColor: colors[index % colors.length] }}/><span>{labelStatus(item.status)}</span><strong>{numberFormat.format(item.count)}</strong></li>)}</ul>
    </div>}
  </section>;
}

type ActivityTab = "users" | "professionals" | "requests" | "complaints";

export default function AdminDashboard({ data }: { data: DashboardData }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActivityTab>("users");
  const period = data.period;
  const metrics = [
    { label: "Utilisateurs au total", value: data.kpis.totalUsers, detail: "Tous les comptes", icon: Users, tone: "forest" },
    { label: "Clients", value: data.kpis.totalClients, detail: "Comptes clients", icon: UserRound, tone: "sage" },
    { label: "Prestataires", value: data.kpis.totalProfessionals, detail: "Tous les statuts", icon: BriefcaseBusiness, tone: "green" },
    { label: "À vérifier", value: data.kpis.pendingProfessionals, detail: "Prestataires en attente", icon: Clock3, tone: "peach" },
    { label: "Prestataires approuvés", value: data.kpis.approvedProfessionals, detail: "Profils validés", icon: CheckCircle2, tone: "green" },
    { label: "Demandes", value: data.kpis.totalRequests, detail: "Total des interventions", icon: ClipboardList, tone: "forest" },
    { label: "Terminées", value: data.kpis.completedRequests, detail: "Demandes terminées", icon: CheckCircle2, tone: "sage" },
    { label: "Réclamations ouvertes", value: data.kpis.openComplaints, detail: "Statut OPEN", icon: MessageSquareWarning, tone: "rose" },
    { label: "Avis", value: data.kpis.totalReviews, detail: "Tous les avis reçus", icon: Star, tone: "peach" },
  ];

  const tabs: { id: ActivityTab; label: string; count: number }[] = [
    { id: "users", label: "Utilisateurs", count: data.latestUsers.length },
    { id: "professionals", label: "Prestataires", count: data.latestProfessionals.length },
    { id: "requests", label: "Demandes", count: data.latestRequests.length },
    { id: "complaints", label: "Réclamations", count: data.latestComplaints.length },
  ];

  return <div className="admin-content admin-dashboard">
    <div className="admin-page-heading admin-dashboard-heading">
      <div><div className="admin-eyebrow"><span/>ESPACE ADMINISTRATEUR</div><h1>Vue générale</h1><p>Suivez l’activité de HomeFix TN et les indicateurs de la plateforme.</p></div>
      <label className="admin-period-control"><span>Période des graphiques</span><select value={period} onChange={(event) => router.push(`/admin?period=${event.target.value}`)} aria-label="Période des graphiques">{Object.entries(periodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>

    <section className="admin-kpi-grid" aria-label="Indicateurs globaux">
      {metrics.map(({ label, value, detail, icon: Icon, tone }) => <article className="admin-kpi-card" key={label}>
        <div className={`admin-kpi-icon tone-${tone}`}><Icon size={19} strokeWidth={1.8}/></div>
        <span className="admin-kpi-label">{label}</span>
        <strong className="admin-kpi-value">{numberFormat.format(value)}</strong>
        <span className="admin-kpi-detail">{detail}</span>
      </article>)}
    </section>
    <p className="admin-kpi-note"><ArrowDownRight size={14}/> Les indicateurs affichent les totaux actuels ; la période filtre les graphiques ci-dessous.</p>

    <section className="admin-dashboard-section">
      <div className="admin-section-heading"><div><span className="admin-section-kicker">ANALYSE</span><h2>Activité de la plateforme</h2></div><span className="admin-period-chip">{periodLabels[period]}</span></div>
      <div className="admin-chart-grid">
        <LineChart title="Évolution des inscriptions" points={data.signups} period={period} color="#167c68" emptyLabel="Aucune inscription sur cette période." />
        <LineChart title="Interventions terminées" points={data.completed} period={period} color="#75a98f" emptyLabel="Aucune intervention terminée sur cette période." />
        <CategoryChart categories={data.categories}/>
        <StatusChart statuses={data.requestStatuses}/>
      </div>
    </section>

    <section className="admin-dashboard-section admin-activity-section">
      <div className="admin-section-heading"><div><span className="admin-section-kicker">ACTIVITÉ RÉCENTE</span><h2>Dernières opérations</h2></div></div>
      <div className="admin-card admin-activity-card">
        <div className="admin-activity-tabs" role="tablist" aria-label="Activités récentes">
          {tabs.map(({ id, label, count }) => <button key={id} role="tab" aria-selected={activeTab === id} className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id)}>{label}<span>{count}</span></button>)}
        </div>
        {activeTab === "users" && <div className="admin-activity-table-wrap"><table className="admin-activity-table"><thead><tr><th>Utilisateur</th><th>Email</th><th>Rôle</th><th>Inscription</th></tr></thead><tbody>{data.latestUsers.map((user) => <tr key={user.id}><td><strong>{user.name}</strong></td><td>{user.email}</td><td><span className="admin-mini-badge">{labelStatus(user.role)}</span></td><td>{formatDate(user.createdAt)}</td></tr>)}</tbody></table>{data.latestUsers.length === 0 && <EmptyActivity message="Aucun utilisateur enregistré."/>}</div>}
        {activeTab === "professionals" && <div className="admin-activity-table-wrap"><table className="admin-activity-table"><thead><tr><th>Prestataire</th><th>Spécialité</th><th>Vérification</th><th>Inscription</th><th/></tr></thead><tbody>{data.latestProfessionals.map((professional) => <tr key={professional.id}><td><strong>{professional.name}</strong></td><td>{professional.specialty || "—"}</td><td><span className={`admin-mini-badge status-${professional.status.toLowerCase()}`}>{labelStatus(professional.status)}</span></td><td>{formatDate(professional.createdAt)}</td><td><Link href={`/admin/professionnels/${professional.id}`} className="admin-row-link">Dossier <ArrowRight size={14}/></Link></td></tr>)}</tbody></table>{data.latestProfessionals.length === 0 && <EmptyActivity message="Aucun prestataire enregistré."/>}</div>}
        {activeTab === "requests" && <div className="admin-activity-table-wrap"><table className="admin-activity-table"><thead><tr><th>Demande</th><th>Catégorie</th><th>Client</th><th>Statut</th><th>Créée le</th></tr></thead><tbody>{data.latestRequests.map((request) => <tr key={request.id}><td><strong>{request.title}</strong></td><td>{request.category}</td><td>{request.client.name}</td><td><span className="admin-mini-badge">{labelStatus(request.status)}</span></td><td>{formatDate(request.createdAt)}</td></tr>)}</tbody></table>{data.latestRequests.length === 0 && <EmptyActivity message="Aucune demande enregistrée."/>}</div>}
        {activeTab === "complaints" && <div className="admin-activity-table-wrap"><table className="admin-activity-table"><thead><tr><th>Réclamation</th><th>Utilisateur</th><th>Statut</th><th>Créée le</th></tr></thead><tbody>{data.latestComplaints.map((complaint) => <tr key={complaint.id}><td><strong>{complaint.subject}</strong></td><td>{complaint.client.name}</td><td><span className="admin-mini-badge">{labelStatus(complaint.status)}</span></td><td>{formatDate(complaint.createdAt)}</td></tr>)}</tbody></table>{data.latestComplaints.length === 0 && <EmptyActivity message="Aucune réclamation enregistrée."/>}</div>}
      </div>
    </section>

    <section className="admin-dashboard-section">
      <div className="admin-section-heading"><div><span className="admin-section-kicker">ACCÈS RAPIDE</span><h2>Gestion de la plateforme</h2></div></div>
      <div className="admin-quick-links">
        <QuickLink label="Prestataires" href="/admin/professionnels" icon={<BriefcaseBusiness size={18}/>} available/>
        <QuickLink label="Utilisateurs" href="/admin/utilisateurs" icon={<Users size={18}/>} available/>
        <QuickLink label="Demandes" href="/admin/demandes" icon={<ClipboardList size={18}/>} available/>
        <QuickLink label="Réclamations" href="/admin/reclamations" icon={<MessageSquareWarning size={18}/>} available/>
        <QuickLink label="Catégories" href="/admin/categories" icon={<FolderKanban size={18}/>} available/>
      </div>
    </section>
  </div>;
}

function EmptyActivity({ message }: { message: string }) {
  return <div className="admin-activity-empty"><Users size={19}/><span>{message}</span></div>;
}

function QuickLink({ label, href, icon, available = false }: { label: string; href?: string; icon: React.ReactNode; available?: boolean }) {
  const content = <>{icon}<span>{label}</span>{available ? <ArrowRight size={15}/> : <span className="admin-quick-soon">À venir</span>}</>;
  return available && href
    ? <Link href={href} className="admin-quick-link">{content}</Link>
    : <div className="admin-quick-link is-disabled" aria-disabled="true">{content}</div>;
}

