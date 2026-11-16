"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CalendarDays, CheckCheck, Clock3, Download, History, Mail, MessageSquare, Paperclip, Save, ShieldCheck, UserRound } from "lucide-react";
import type { getAdminComplaintDetail } from "@/app/lib/admin-complaints";
import type { Serialized } from "@/app/lib/client-workspace";
import { complaintStatuses, complaintPriorities, complaintRoles } from "@/lib/admin-complaint-filters";
import { statusLabels } from "@/lib/client-domain";
import AdminComplaintResponseForm from "./AdminComplaintResponseForm";

export type ComplaintCase = Serialized<NonNullable<Awaited<ReturnType<typeof getAdminComplaintDetail>>>>;
const date = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Tunis" }).format(new Date(value));
const label = (values: Record<string, string>, value: string) => values[value] ?? value;

export default function AdminComplaintCase({ complaint, onUpdated }: { complaint: ComplaintCase; onUpdated?: () => void | Promise<void> }) {
  const router = useRouter();
  const [status, setStatus] = useState(complaint.status);
  const [priority, setPriority] = useState(complaint.priority);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(""); setFeedback("");
    try {
      const response = await fetch(`/api/admin/reclamations/${complaint.id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, priority, reason }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Mise à jour impossible.");
      setReason(""); setFeedback("Suivi mis à jour et enregistré dans l’historique.");
      await onUpdated?.(); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Connexion impossible."); }
    finally { setBusy(false); }
  }
  const attachments = [
    ...complaint.attachments.map(file => ({ ...file, source: "complaint" })),
    ...(complaint.request?.attachments ?? []).map(file => ({ ...file, source: "intervention" })),
  ];
  return <div className="admin-complaint-case">
    <div className="cc-case-summary"><span className={`cc-status status-${complaint.status.toLowerCase()}`}>{label(complaintStatuses, complaint.status)}</span><span className={`cc-priority priority-${complaint.priority.toLowerCase()}`}>{label(complaintPriorities, complaint.priority)}</span><span className="cc-case-date"><CalendarDays size={13}/>{date(complaint.createdAt)}</span></div>
    <section className="cc-case-section"><h3><UserRound size={16}/>Utilisateur</h3><div className="cc-person"><span className="cc-avatar">{complaint.client.name.split(/\s+/).slice(0, 2).map(part => part[0]).join("")}</span><div><strong>{complaint.client.name}</strong><span>{label(complaintRoles, complaint.client.role)}</span></div></div><div className="cc-contact"><span><Mail size={13}/>{complaint.client.email}</span>{complaint.client.phone && <span>{complaint.client.phone}</span>}</div></section>
    <section className="cc-case-section"><h3><MessageSquare size={16}/>Message de la réclamation</h3><p className="cc-message">{complaint.message}</p></section>
    <section className="cc-case-section"><h3><Paperclip size={16}/>Pièces jointes <span className="cc-section-count">{attachments.length}</span></h3>{attachments.length ? <ul className="cc-files">{attachments.map(file => <li key={`${file.source}-${file.id}`}><span><Paperclip size={16}/><span><strong>{file.name}</strong><small>{Math.ceil(file.size / 1024)} Ko · {file.source === "intervention" ? "Intervention associée" : "Réclamation"}</small></span></span><a href={`/api/admin/reclamations/${complaint.id}/attachments/${file.id}${file.source === "intervention" ? "?source=intervention" : ""}`} aria-label={`Télécharger ${file.name}`}><Download size={16}/></a></li>)}</ul> : <p className="cc-muted">Aucune pièce jointe enregistrée.</p>}</section>
    <section className="cc-case-section"><h3><ShieldCheck size={16}/>Intervention concernée</h3>{complaint.request ? <Link className="cc-intervention" href={`/admin/demandes/${complaint.request.id}`}><div><strong>{complaint.request.title}</strong><span>{complaint.request.category} · {statusLabels[complaint.request.status] ?? complaint.request.status}</span></div><ArrowUpRight size={17}/></Link> : <p className="cc-muted">Question générale, sans intervention associée.</p>}</section>
    <section className="cc-case-section cc-response-section"><h3><MessageSquare size={16}/>Réponse Admin</h3>{complaint.response?.trim() ? <div className="cc-sent-response"><span><CheckCheck size={15}/>Réponse envoyée</span><p>{complaint.response}</p></div> : <><p className="cc-muted">Votre réponse sera notifiée à l’utilisateur selon ses préférences de notification.</p><AdminComplaintResponseForm complaintId={complaint.id} onSuccess={onUpdated}/></>}</section>
    <section className="cc-case-section"><h3><Clock3 size={16}/>Traitement de la réclamation</h3><form className="cc-treatment" onSubmit={save}><fieldset disabled={busy}><div className="cc-treatment-grid"><label><span>Statut</span><select value={status} onChange={event => setStatus(event.target.value)}>{Object.entries(complaintStatuses).map(([value, text]) => <option value={value} key={value}>{text}</option>)}</select></label><label><span>Priorité</span><select value={priority} onChange={event => setPriority(event.target.value)}>{Object.entries(complaintPriorities).map(([value, text]) => <option value={value} key={value}>{text}</option>)}</select></label></div><label><span>Note de traitement</span><textarea value={reason} onChange={event => setReason(event.target.value)} rows={3} minLength={3} maxLength={1000} required placeholder="Précisez le motif de cette mise à jour…"/></label><p className="cc-muted">Une réponse est nécessaire avant de résoudre ou de clôturer le dossier.</p><div className="cc-treatment-actions"><button type="submit" disabled={busy || (status === complaint.status && priority === complaint.priority)} className="admin-button admin-button-primary"><Save size={14}/>{busy ? "Enregistrement…" : status === "CLOSED" ? "Clôturer la réclamation" : "Enregistrer le suivi"}</button>{complaint.status !== "CLOSED" && complaint.response?.trim() && <button type="button" className="admin-button admin-button-light" disabled={busy} onClick={() => setStatus("CLOSED")}><CheckCheck size={14}/>Clôturer</button>}</div></fieldset>{error && <p className="admin-action-error" role="alert">{error}</p>}{feedback && <p className="cc-success" role="status">{feedback}</p>}</form></section>
    <section className="cc-case-section"><h3><History size={16}/>Historique du traitement</h3><ol className="cc-history"><li><span className="cc-history-dot"/><div><strong>Réclamation créée</strong><span>{complaint.client.name} · {date(complaint.createdAt)}</span></div></li>{complaint.history.map(event => {
      const details = event.details && typeof event.details === "object" && !Array.isArray(event.details) ? event.details : {};
      const change = event.action === "COMPLAINT_RESPONSE" ? "Réponse envoyée" : event.action === "COMPLAINT_PRIORITY" ? `Priorité : ${label(complaintPriorities, String(details.priority ?? ""))}` : `Statut : ${label(complaintStatuses, String(details.status ?? ""))}`;
      return <li key={event.id}><span className="cc-history-dot"/><div><strong>{change}</strong><span>{event.actorName} · {date(event.createdAt)}</span>{event.reason && <p>{event.reason}</p>}</div></li>;
    })}</ol></section>
  </div>;
}
