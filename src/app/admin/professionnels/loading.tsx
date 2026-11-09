import "./professionals.css";

export default function ProfessionalsLoading() {
  return <div className="admin-content admin-professionals-page" aria-busy="true" aria-live="polite">
    <div className="admin-page-heading"><div><div className="admin-eyebrow"><span/>ESPACE ADMINISTRATEUR</div><h1>Chargement des professionnels…</h1></div></div>
    <div className="admin-professional-stats" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <div className="admin-professional-skeleton" key={index}/>)}</div>
    <div className="admin-card admin-professional-skeleton admin-professional-table-skeleton"/>
  </div>;
}
