"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, LoaderCircle } from "lucide-react";
import ClientAvatar, { clientPhotoUpdated } from "./ClientAvatar";

export default function ClientProfilePhoto({ name, hasPhoto }: { name: string; hasPhoto: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState(false);
  async function upload(file: File) {
    if (busy) return;
    setFeedback(""); setError(false);
    if (!file.size || file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError(true); setFeedback("Choisissez une image JPEG, PNG ou WebP de 5 Mo maximum."); return;
    }
    setBusy(true);
    try {
      const data = new FormData(); data.set("photo", file);
      const response = await fetch("/api/client/photo", { method: "POST", body: data });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Envoi impossible.");
      window.dispatchEvent(new CustomEvent(clientPhotoUpdated, { detail: Date.now() }));
      setFeedback("Photo mise à jour.");
      router.refresh();
    } catch (error) { setError(true); setFeedback(error instanceof Error ? error.message : "Envoi impossible."); }
    finally { setBusy(false); }
  }
  return <div className="cx-profile-photo-editor">
    <label className="cx-profile-photo-picker" title="Changer la photo de profil">
      <ClientAvatar name={name} hasPhoto={hasPhoto} className="cx-person-avatar large"/>
      <span className="cx-profile-photo-camera" aria-hidden="true">{busy ? <LoaderCircle size={14} className="cx-spin"/> : <Camera size={14}/>}</span>
      <input className="sr-only" type="file" aria-label="Changer la photo de profil" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void upload(file); }}/>
    </label>
    {feedback && <small className={error ? "cx-photo-error" : ""} role={error ? "alert" : "status"}>{feedback}</small>}
  </div>;
}
