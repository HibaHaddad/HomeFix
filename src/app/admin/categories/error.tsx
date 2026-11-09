"use client";

import "./categories.css";

export default function AdminCategoriesError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="admin-content"><section className="admin-error-card">
    <span>INVENTAIRE DES CATÉGORIES</span>
    <h1>Les catégories n’ont pas pu être chargées.</h1>
    <p>Une erreur est survenue pendant la lecture des données. Réessayez dans quelques instants.</p>
    <button className="admin-button admin-button-primary" onClick={() => reset()}>Réessayer</button>
  </section></main>;
}
