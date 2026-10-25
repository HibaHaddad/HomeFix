export default function ProfessionalLoading() {
  return <div className="pro-content" aria-busy="true" aria-live="polite"><div className="pro-page-heading"><div><div className="pro-eyebrow"><span />ESPACE PROFESSIONNEL</div><h1>Chargement de votre espace…</h1><p>Nous récupérons les informations de votre compte.</p></div></div><div className="pro-stat-grid">{[1, 2, 3, 4].map((item) => <div className="pro-stat-card pro-skeleton" key={item} />)}</div><div className="pro-panel pro-skeleton pro-skeleton-panel" /></div>;
}
