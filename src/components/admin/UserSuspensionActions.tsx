"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shield, ShieldCheck, X } from "lucide-react";

export default function UserSuspensionActions({ userId, isSuspended, reason, updatedAt }: {
  userId: number;
  isSuspended: boolean;
  reason: string | null;
  updatedAt: string | null;
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/users/${userId}/suspension`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: isSuspended ? "REACTIVATE" : "SUSPEND", ...(!isSuspended ? { reason: suspensionReason.trim() } : {}) }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error || "La modification n’a pas pu être enregistrée.");
        return;
      }
      setSuccess(isSuspended ? "Le compte a été réactivé." : "Le compte a été suspendu.");
      setDialogOpen(false);
      setSuspensionReason("");
      router.refresh();
    } catch {
      setError("Impossible de joindre le serveur. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="admin-suspension-actions">
    {success && <p className="admin-user-success" role="status">{success}</p>}
    {error && !dialogOpen && <p className="admin-user-error" role="alert">{error}</p>}
    <button className={isSuspended ? "admin-reactivate-button" : "admin-suspend-button"} onClick={() => { setError(""); setDialogOpen(true); }}>
      {isSuspended ? <ShieldCheck size={16}/> : <Shield size={16}/>} {isSuspended ? "Réactiver" : "Suspendre le compte"}
    </button>
    {dialogOpen && <div className="admin-user-dialog-backdrop">
      <section className="admin-user-dialog" role="dialog" aria-modal="true" aria-labelledby="suspension-dialog-title">
        <button className="admin-user-dialog-close" onClick={() => setDialogOpen(false)} aria-label="Fermer"><X size={18}/></button>
        <span className={`admin-user-dialog-icon${isSuspended ? " is-safe" : ""}`}>{isSuspended ? <ShieldCheck size={21}/> : <Shield size={21}/>}</span>
        <h2 id="suspension-dialog-title">{isSuspended ? "Réactiver ce compte ?" : "Suspendre ce compte ?"}</h2>
        <p>{isSuspended ? "L’utilisateur pourra de nouveau accéder à son espace. Son rôle et son état de vérification resteront inchangés." : "L’utilisateur sera déconnecté et ne pourra plus accéder à ses espaces ni à leurs API."}</p>
        {isSuspended ? <div className="admin-suspension-last"><strong>Dernier motif enregistré</strong><span>{reason || "Aucun motif"}</span>{updatedAt && <small>Décision du {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Africa/Tunis" }).format(new Date(updatedAt))}</small>}</div> : <label className="admin-suspension-reason"><span>Motif de suspension <i>*</i></span><textarea value={suspensionReason} onChange={(event) => setSuspensionReason(event.target.value)} minLength={3} maxLength={1000} rows={4} placeholder="Décrivez le motif à conserver avec le compte." autoFocus/><small>{suspensionReason.trim().length}/1 000 caractères</small></label>}
        {error && <p className="admin-user-error" role="alert">{error}</p>}
        <div className="admin-user-dialog-actions"><button className="admin-user-cancel-button" disabled={busy} onClick={() => setDialogOpen(false)}>Annuler</button><button className={isSuspended ? "admin-reactivate-button" : "admin-suspend-button"} disabled={busy || (!isSuspended && suspensionReason.trim().length < 3)} onClick={submit}>{busy ? "Enregistrement…" : isSuspended ? "Confirmer la réactivation" : "Confirmer la suspension"}</button></div>
      </section>
    </div>}
  </div>;
}
