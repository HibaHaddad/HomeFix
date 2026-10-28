export default function DirectorySkeleton() {
  return <div className="directory-cards" role="status" aria-label="Recherche des professionnels en cours" aria-busy="true">{Array.from({ length: 6 }, (_, i) => <div className="directory-skeleton" key={i}><div className="skeleton-avatar"/><div className="skeleton-line"/><div className="skeleton-line short"/><div className="skeleton-line"/><div className="skeleton-line"/><div className="skeleton-button"/></div>)}</div>;
}
