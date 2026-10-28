"use client";

import { useState } from "react";
import Icon from "@/components/professional/ProfessionalIcon";

export default function ProfessionalContact({ professionalId, initialKind }: { professionalId: number; initialKind: "QUOTE" | "MESSAGE" }) {
  const [kind, setKind] = useState(initialKind);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  return <form id="contact" className="client-contact-form" onSubmit={async (e) => {
    e.preventDefault(); setBusy(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/client/demandes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ professionalId, kind, message }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "L’envoi a échoué.");
      setSuccess(result.message); setMessage("");
    } catch (error) { setError(error instanceof Error ? error.message : "Impossible de joindre le serveur."); }
    finally { setBusy(false); }
  }}><span className="eyebrow">PARLONS DE VOTRE PROJET</span><h2>Le premier pas, c’est un échange.</h2><p>Décrivez votre besoin. Le professionnel recevra votre demande dans son espace HomeFix.</p>
    <label>Votre demande<select value={kind} onChange={(e) => setKind(e.target.value as "QUOTE" | "MESSAGE")}><option value="QUOTE">Demander un devis</option><option value="MESSAGE">Contacter le professionnel</option></select></label>
    <label>Votre message<textarea rows={5} required minLength={20} maxLength={3000} placeholder="Nature des travaux, zone d’intervention, dates souhaitées…" value={message} onChange={(e) => setMessage(e.target.value)}/></label><small>Vos nom, e-mail et téléphone de compte seront partagés avec ce professionnel pour sa réponse.</small>
    {error && <p className="client-feedback error" role="alert">{error}</p>}{success && <p className="client-feedback success" role="status">{success}</p>}
    <button type="submit" className="button button-dark" disabled={busy}>{busy ? "Envoi en cours…" : kind === "QUOTE" ? "Envoyer ma demande de devis" : "Envoyer mon message"}<Icon name="arrow" size={16}/></button>
  </form>;
}
