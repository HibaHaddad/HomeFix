"use client";
export default function ClientError({ reset }: { reset: () => void }) { return <section className="cx-empty" role="alert"><h1>Votre espace est momentanément indisponible.</h1><p>Vos données sont conservées. Réessayez dans un instant.</p><button className="cx-btn" onClick={reset}>Réessayer</button></section>; }
