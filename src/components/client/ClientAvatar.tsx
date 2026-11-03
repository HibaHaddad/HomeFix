"use client";
import { useEffect, useState } from "react";

export const clientPhotoUpdated = "homefix:client-photo-updated";

export default function ClientAvatar({ name, hasPhoto, className = "client-avatar" }: { name: string; hasPhoto: boolean; className?: string }) {
  const [version, setVersion] = useState<number | null>(null);
  useEffect(() => {
    const update = (event: Event) => setVersion((event as CustomEvent<number>).detail);
    window.addEventListener(clientPhotoUpdated, update);
    return () => window.removeEventListener(clientPhotoUpdated, update);
  }, []);
  return <span className={`${className} cx-client-photo-avatar`}>
    <span>{name.slice(0, 1).toUpperCase()}</span>
    {(hasPhoto || version !== null) && <img key={version ?? "saved"} src={`/api/client/photo${version !== null ? `?v=${version}` : ""}`} alt={`Photo de ${name}`} onError={(event) => { event.currentTarget.hidden = true; }}/>}
  </span>;
}
