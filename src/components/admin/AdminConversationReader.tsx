"use client";
import { useState } from "react";
import { Eye, LockKeyhole } from "lucide-react";
type Message = { id: number; sender: string; text: string; createdAt: string; requestId: number; attachments: { name: string; size: number }[] };
type Result = { title: string; initialMessage: string | null; messages: Message[]; nextBefore: number | null };
export default function AdminConversationReader({ id }: { id: number }) {
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load(before?: number) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/conversations/${id}/access`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason, ...(before ? { before } : {}) }), cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Consultation impossible.");
      setResult(previous => before && previous ? { ...data, initialMessage: previous.initialMessage, messages: [...data.messages, ...previous.messages] } : data);
    } catch (e) { setError(e instanceof Error ? e.message : "Connexion impossible."); }
    finally { setBusy(false); }
  }
  return <><div className="aw-note"><LockKeyhole size={16}/> Consultation réservée au traitement d’un dossier. Chaque accès et chaque chargement supplémentaire sont journalisés avec votre identité et le motif. Aucune réponse ni modification n’est possible.</div><form className="aw-card" onSubmit={event => { event.preventDefault(); void load(); }}><label className="aw-field"><span>Motif précis de la consultation</span><textarea value={reason} onChange={e => setReason(e.target.value)} minLength={10} maxLength={1000} rows={3} required placeholder="Ex. Vérification des échanges liés à la réclamation #42…" disabled={busy}/></label><div className="aw-actions"><button type="submit" className="admin-button admin-button-primary" disabled={busy || reason.trim().length < 10}><Eye size={15}/>{busy ? "Vérification…" : "Autoriser et journaliser la consultation"}</button>{result && <button type="button" className="admin-button admin-button-light" onClick={() => { setResult(null); setReason(""); }}>Fermer la consultation</button>}</div>{error && <p role="alert" className="admin-action-error">{error}</p>}</form>{result && <section className="aw-panel" aria-label="Échanges en lecture seule">{result.nextBefore && <div className="aw-message"><button className="admin-button admin-button-light" disabled={busy} onClick={() => load(result.nextBefore!)}>Charger les messages précédents · Accès journalisé</button></div>}{result.initialMessage && <article className="aw-message"><header><strong>Message initial du client</strong></header><p>{result.initialMessage}</p></article>}{result.messages.map(m => <article className="aw-message" key={m.id}><header><strong>{m.sender}</strong><time>{new Date(m.createdAt).toLocaleString("fr-TN", { timeZone: "Africa/Tunis" })}</time></header><p>{m.text}</p>{m.attachments.map((a, i) => <small key={i}>Pièce jointe : {a.name} ({Math.ceil(a.size / 1024)} Ko) · Contenu non téléchargé<br/></small>)}<small>Échange #{m.id} · Demande #{m.requestId}</small></article>)}{!result.messages.length && !result.initialMessage && <div className="aw-empty">Aucun échange enregistré.</div>}</section>}</>;
}
