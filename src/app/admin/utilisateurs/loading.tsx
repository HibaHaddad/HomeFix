import "./users.css";

export default function AdminUsersLoading() {
  return <div className="admin-content admin-users-page" aria-busy="true" aria-live="polite"><div className="admin-page-heading"><div><div className="admin-eyebrow"><span/>GESTION DE LA PLATEFORME</div><h1>Chargement des utilisateurs…</h1></div></div><div className="admin-users-stats">{Array.from({ length: 4 }, (_, index) => <div className="admin-users-skeleton" key={index}/>)}</div><div className="admin-users-skeleton admin-users-table-skeleton"/></div>;
}
