"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Send } from "lucide-react";

export default function AdminComplaintResponseForm({ complaintId }: { complaintId: number }) {
  const router = useRouter();
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !window.confirm("Envoyer cette réponse définitive au client ? Elle ne pourra plus être modifiée.")) return;
    setBusy(true);
    setError("");
    try {
      const result = await fetch(`/api/admin/reclamations/${complaintId}/response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response }),
      });
      const data = await result.json().catch(() => null);
      if (!result.ok) throw new Error(data?.error || "La réponse n’a pas pu être envoyée.");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Connexion impossible. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="admin-complaint-response-form" onSubmit={submit}>
    <label htmlFor="complaint-response">Votre réponse</label>
    <textarea id="complaint-response" value={response} onChange={(event) => setResponse(event.target.value)} minLength={10} maxLength={3000} rows={6} required disabled={busy} placeholder="Rédigez une réponse claire et complète…"/>
    <div className="admin-complaint-response-form-footer"><small>{response.trim().length} / 3 000 caractères · Envoi définitif</small><button className="admin-button admin-button-primary" type="submit" disabled={busy || response.trim().length < 10}>{busy ? <LoaderCircle size={15} className="admin-complaint-spinner"/> : <Send size={15}/>} {busy ? "Envoi…" : "Envoyer la réponse"}</button></div>
    {error && <p className="admin-action-error" role="alert">{error}</p>}
  </form>;
}
