import "./requests.css";

export default function AdminRequestsLoading() {
  return <div className="admin-content admin-requests-page" aria-busy="true" aria-live="polite">
    <div className="admin-page-heading"><div><div className="admin-eyebrow"><span/>SUPERVISION DE LA PLATEFORME</div><h1>Chargement des demandes…</h1></div></div>
    <div className="admin-request-stat-grid" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <div className="admin-request-skeleton" key={index}/>)}</div>
    <div className="admin-card admin-request-skeleton admin-request-list-skeleton"/>
  </div>;
}
