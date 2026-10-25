"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ProfessionalIcon from "@/components/professional/ProfessionalIcon";

const PHOTO_URL = "/api/professionnel/photo";

export default function ProfessionalPhotoUploader({ name, hasPhoto }: { name: string; hasPhoto: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [photoAvailable, setPhotoAvailable] = useState(hasPhoto);
  const [photoVersion, setPhotoVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => setPhotoAvailable(hasPhoto), [hasPhoto]);
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function choosePhoto(selected: File | undefined) {
    if (!selected) return;
    setError(""); setMessage("");
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(selected.type)) {
      setError("Choisissez une image JPG, PNG ou WebP."); return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      setError("La photo ne doit pas dépasser 5 Mo."); return;
    }
    setFile(selected);
  }

  async function savePhoto() {
    if (!file) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const formData = new FormData();
      formData.set("photo", file);
      const response = await fetch(PHOTO_URL, { method: "POST", body: formData });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setError(result.error || "La photo n’a pas pu être enregistrée."); return; }
      setPhotoAvailable(true); setPhotoVersion(Date.now()); setFile(null);
      setMessage(result.message || "Photo de profil mise à jour.");
      router.refresh();
    } catch { setError("Impossible de joindre le serveur. Réessayez."); }
    finally { setBusy(false); }
  }

  async function removePhoto() {
    if (!photoAvailable || !window.confirm("Supprimer votre photo de profil ?")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(PHOTO_URL, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setError(result.error || "La photo n’a pas pu être supprimée."); return; }
      setPhotoAvailable(false); setPhotoVersion(Date.now()); setFile(null);
      setMessage(result.message || "Photo supprimée.");
      router.refresh();
    } catch { setError("Impossible de joindre le serveur. Réessayez."); }
    finally { setBusy(false); }
  }

  const imageSrc = preview || (photoAvailable ? `${PHOTO_URL}?v=${photoVersion}` : "");
  return <section className="pro-photo-card" aria-labelledby="pro-photo-title">
    <div className="pro-photo-preview">{imageSrc ? <img src={imageSrc} alt={`Photo de profil de ${name}`} /> : <span>{name.slice(0, 1).toUpperCase()}</span>}</div>
    <div className="pro-photo-content"><div className="pro-photo-card-heading"><span className="pro-photo-kicker">IDENTITÉ VISUELLE</span><h2 id="pro-photo-title">Photo de profil</h2></div>
      <div className="pro-photo-controls"><div className="pro-photo-actions"><input ref={inputRef} className="pro-photo-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => choosePhoto(event.currentTarget.files?.[0])} aria-label="Choisir une photo de profil"/><button className="pro-photo-button" type="button" disabled={busy} onClick={() => inputRef.current?.click()}><ProfessionalIcon name="user" size={16}/>{photoAvailable ? "Choisir une autre photo" : "Choisir une photo"}</button>{file && <button className="pro-photo-save" type="button" disabled={busy} onClick={savePhoto}>{busy ? "Enregistrement…" : "Enregistrer la photo"}</button>}{photoAvailable && !file && <button className="pro-photo-remove" type="button" disabled={busy} onClick={removePhoto}>Supprimer</button>}<small>JPG, PNG ou WebP · 5 Mo maximum</small></div></div>
    </div>
    {error && <p className="pro-photo-feedback is-error" role="alert">{error}</p>}{message && <p className="pro-photo-feedback is-success" role="status">{message}</p>}
  </section>;
}
