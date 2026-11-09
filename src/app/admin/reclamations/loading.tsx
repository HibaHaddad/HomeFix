import "./complaints.css";

export default function AdminComplaintsLoading() {
  return <div className="admin-content admin-complaints-page" aria-busy="true" aria-live="polite">
    <div className="admin-page-heading"><div><div className="admin-eyebrow"><span/>SUPERVISION DE LA PLATEFORME</div><h1>Chargement des réclamations…</h1></div></div>
    <div className="admin-complaint-stat-grid" aria-hidden="true">{Array.from({ length: 4 }, (_, index) => <div className="admin-request-stat admin-complaint-skeleton" key={index}/>)}</div>
    <div className="admin-card admin-complaint-table-skeleton" aria-hidden="true"/>
  </div>;
}
