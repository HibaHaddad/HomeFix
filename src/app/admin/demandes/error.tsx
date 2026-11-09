"use client";

export default function AdminRequestsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="admin-content"><section className="admin-error-card">
    <span>SUPERVISION DES DEMANDES</span>
    <h1>Les demandes n’ont pas pu être chargées.</h1>
    <p>Une erreur est survenue pendant la récupération des données. Réessayez dans quelques instants.</p>
    <button className="admin-button admin-button-primary" onClick={() => reset()}>Réessayer</button>
  </section></main>;
}
