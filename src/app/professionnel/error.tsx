"use client";

export default function ProfessionalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="pro-error-page"><span>HOMEFIX TN · ESPACE PROFESSIONNEL</span><h1>Votre espace n’a pas pu être chargé.</h1><p>Une erreur est survenue lors de la récupération des informations. Réessayez dans quelques instants.</p><button onClick={() => reset()}>Réessayer</button></main>;
}
