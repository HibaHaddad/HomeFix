"use client";

import "./complaints.css";

export default function AdminComplaintsError({ reset }: { reset: () => void }) {
  return <main className="admin-content"><section className="admin-error-card">
    <span>SUPERVISION DES RÉCLAMATIONS</span>
    <h1>Les réclamations n’ont pas pu être chargées.</h1>
    <p>Une erreur est survenue pendant la lecture des données. Réessayez dans quelques instants.</p>
    <button className="admin-button admin-button-primary" onClick={() => reset()}>Réessayer</button>
  </section></main>;
}
