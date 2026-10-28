"use client";
export default function DirectoryError({ reset }: { reset: () => void }) {
  return <div className="directory-empty" role="alert"><h1>Cette page est momentanément indisponible.</h1><p>Vos critères sont conservés. Réessayez dans un instant.</p><button className="button button-dark" onClick={reset}>Réessayer</button></div>;
}
