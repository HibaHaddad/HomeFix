"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { workspaceAction } from "./WorkspaceForm";
export default function ContactButton({ professionalId }: { professionalId: number }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  return <><button type="button" disabled={busy} onClick={async () => {
    setBusy(true); setError("");
    try { const result = await workspaceAction("conversation.open", { professionalId }); router.push(`/dashboard/messagerie?demande=${result.id}`); }
    catch (e) { setError(e instanceof Error ? e.message : "Conversation indisponible."); setBusy(false); }
  }}><MessageSquare size={15}/>{busy ? "Ouverture…" : "Contacter"}</button>{error && <small role="alert">{error}</small>}</>;
}
