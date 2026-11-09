export default function AdminLoading() {
  return <div className="admin-content admin-dashboard" aria-busy="true" aria-live="polite">
    <div className="admin-page-heading"><div><div className="admin-eyebrow"><span/>ESPACE ADMINISTRATEUR</div><h1>Chargement du tableau de bord…</h1><p>Récupération des indicateurs et de l’activité récente.</p></div></div>
    <div className="admin-kpi-grid">{Array.from({ length: 8 }, (_, index) => <div className="admin-skeleton-card" key={index}/>)}</div>
    <div className="admin-chart-grid admin-dashboard-skeleton"><div className="admin-skeleton-card"/><div className="admin-skeleton-card"/><div className="admin-skeleton-card"/><div className="admin-skeleton-card"/></div>
  </div>;
}
