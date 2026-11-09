"use client";

export default function ProfessionalsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="admin-content"><section className="admin-error-card">
    <span>GESTION DES PROFESSIONNELS</span>
    <h1>Les dossiers professionnels n’ont pas pu être chargés.</h1>
    <p>Une erreur est survenue lors de la récupération des dossiers. Réessayez dans quelques instants.</p>
    <button className="admin-button admin-button-primary" onClick={() => reset()}>Réessayer</button>
  </section></main>;
}
