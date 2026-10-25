"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ProfessionalReviewActions({ professionalId, professionalName }: { professionalId: number; professionalName: string }) {
  const router = useRouter();
  const [showRefusal, setShowRefusal] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  async function decide(decision: "APPROVED" | "REJECTED") {
    if (decision === "APPROVED" && !window.confirm(`Confirmer l’approbation du dossier de ${professionalName} ?`)) return;
    if (decision === "REJECTED" && !window.confirm(`Confirmer le refus du dossier de ${professionalName} ?`)) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/professionnels/${professionalId}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, reason: decision === "REJECTED" ? reason.trim() : undefined }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setError(result.error || "La décision n’a pas pu être enregistrée."); return; }
      setFeedback(decision === "APPROVED" ? "Le dossier a été approuvé. Le professionnel peut maintenant se connecter." : "Le dossier a été refusé. Le motif est enregistré.");
      setShowRefusal(false);
      router.refresh();
    } catch { setError("Impossible de joindre le serveur. Réessayez."); }
    finally { setBusy(false); }
  }

  return <div className="admin-decision-area">
    {feedback && <div className="admin-action-feedback" role="status">✓ {feedback}</div>}
    {error && <p className="admin-action-error" role="alert">{error}</p>}
    {!feedback && <div className="admin-decision-card"><div><strong>Décision de vérification</strong><p>La décision sera enregistrée dans le dossier et appliquée à l’accès du professionnel.</p></div><div className="admin-decision-buttons"><button className="admin-button admin-button-danger" disabled={busy} onClick={() => { setError(""); setShowRefusal(true); }}>Refuser</button><button className="admin-button admin-button-primary" disabled={busy} onClick={() => decide("APPROVED")}>{busy ? "Enregistrement…" : "Approuver"}</button></div></div>}
    {showRefusal && <div className="admin-dialog-backdrop" role="presentation"><section className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="refusal-title"><button className="admin-dialog-close" onClick={() => setShowRefusal(false)} aria-label="Fermer">×</button><div className="admin-eyebrow"><span/>DÉCISION DE DOSSIER</div><h2 id="refusal-title">Refuser cette inscription ?</h2><p>Indiquez le motif qui sera conservé avec le dossier.</p><label className="admin-reason-label" htmlFor="refusal-reason">Motif du refus <i>*</i></label><textarea id="refusal-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} rows={4} required placeholder="Expliquez la raison du refus…"/><div className="admin-dialog-actions"><button className="admin-button admin-button-light" disabled={busy} onClick={() => setShowRefusal(false)}>Annuler</button><button className="admin-button admin-button-danger" disabled={busy || reason.trim().length < 3} onClick={() => decide("REJECTED")}>{busy ? "Enregistrement…" : "Confirmer le refus"}</button></div></section></div>}
  </div>;
}
