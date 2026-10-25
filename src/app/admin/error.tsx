"use client";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="admin-content"><section className="admin-error-card"><span>ESPACE ADMINISTRATEUR</span><h1>Les dossiers n’ont pas pu être chargés.</h1><p>Une erreur est survenue pendant la récupération des inscriptions. Réessayez dans quelques instants.</p><button className="admin-button admin-button-primary" onClick={() => reset()}>Réessayer</button></section></main>;
}
