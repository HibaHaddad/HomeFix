"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MessageSquare } from "lucide-react";
import InterventionComposer from "./InterventionComposer";
import { workspaceAction } from "./WorkspaceForm";
export default function ProfessionalContact({ professionalId, address }: { professionalId: number; address: string }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  return <section id="contact" className="client-contact-form"><span className="eyebrow">LES DISPONIBILITÉS DU PROFESSIONNEL</span><h2>Choisissez votre créneau.</h2><p>Seuls les créneaux publiés et encore libres sont proposés. Le rendez-vous sera confirmé après acceptation du professionnel et du devis.</p><InterventionComposer professionalId={professionalId} address={address} inline/><div className="flow-contact-divider"><span>Vous préférez en discuter d’abord ?</span><button className="cx-btn secondary" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { const result = await workspaceAction("conversation.open", { professionalId }); router.push(`/dashboard/messagerie?demande=${result.id}`); } catch (e) { setError(e instanceof Error ? e.message : "Conversation indisponible."); } finally { setBusy(false); } }}><MessageSquare size={16}/>{busy ? "Ouverture…" : "Discuter avec ce professionnel"}</button></div>{error && <p className="cx-feedback is-error" role="alert">{error}</p>}</section>;
}
