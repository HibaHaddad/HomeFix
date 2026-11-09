import "./categories.css";

export default function AdminCategoriesLoading() {
  return <div className="admin-content admin-categories-page" aria-busy="true" aria-live="polite">
    <div className="admin-page-heading"><div><div className="admin-eyebrow"><span/>INVENTAIRE EN LECTURE SEULE</div><h1>Chargement des catégories…</h1></div></div>
    <div className="admin-category-stat-grid" aria-hidden="true">{Array.from({ length: 4 }, (_, index) => <div className="admin-category-stat admin-category-skeleton" key={index}/>)}</div>
    <div className="admin-card admin-category-skeleton-table" aria-hidden="true"/>
  </div>;
}
