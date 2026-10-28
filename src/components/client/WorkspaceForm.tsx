"use client";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, ArrowUpRight } from "lucide-react";
export async function workspaceAction(action: string, data: Record<string, unknown> = {}) {
  const response = await fetch("/api/client/espace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...data }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "L’opération a échoué.");
  return result as { id?: number };
}
export default function WorkspaceForm({ action, values = {}, children, label = "Enregistrer", success = "Modification enregistrée.", className = "", confirm }: { action: string; values?: Record<string, unknown>; children?: ReactNode; label?: string; success?: string; className?: string; confirm?: string }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [feedback, setFeedback] = useState(""); const [error, setError] = useState(false);
  return <form className={`cx-form ${className}`} onSubmit={async (event) => {
    event.preventDefault(); if (busy || (confirm && !window.confirm(confirm))) return;
    const form = event.currentTarget; setBusy(true); setFeedback("");
    try { const fields = Object.fromEntries(new FormData(form).entries()); await workspaceAction(action, { ...fields, ...values }); setError(false); setFeedback(success); router.refresh(); }
    catch (e) { setError(true); setFeedback(e instanceof Error ? e.message : "Connexion impossible."); } finally { setBusy(false); }
  }}>{children}<button className="cx-btn" disabled={busy} type="submit">{busy ? <LoaderCircle size={15} className="cx-spin"/> : null}{label}{!busy && <ArrowUpRight size={15}/>}</button>{feedback && <p className={`cx-feedback ${error ? "is-error" : ""}`} role={error ? "alert" : "status"}>{feedback}</p>}</form>;
}
