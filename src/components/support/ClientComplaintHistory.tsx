"use client";
import { useState } from "react";
import { CheckCheck, ChevronDown, Clock3, Download, Inbox, MessageSquare } from "lucide-react";
import type { ClientSupportPage } from "@/lib/support-complaints";
import styles from "./HomeFixHelp.module.css";

const statusLabels: Record<string, string> = { OPEN: "En attente", IN_PROGRESS: "En cours de traitement", RESOLVED: "Résolue", CLOSED: "Clôturée" };
const date = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Tunis" }).format(new Date(value));
export default function ClientComplaintHistory({ initialPage }: { initialPage: ClientSupportPage }) {
  const [page, setPage] = useState(initialPage);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function more() {
    if (!page.nextCursor || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/client/reclamations?before=${page.nextCursor}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Chargement impossible.");
      setPage(current => ({ nextCursor: data.nextCursor, items: [...current.items, ...data.items.filter((item: { id: number }) => !current.items.some(previous => previous.id === item.id))] }));
    } catch (error) { setError(error instanceof Error ? error.message : "Connexion impossible."); }
    finally { setBusy(false); }
  }
  return <section className={`${styles.panel} ${styles.history}`} aria-labelledby="support-history-title">
    <header className={styles.header}><span><MessageSquare size={22}/></span><div><h2 id="support-history-title">Mes demandes et réclamations</h2><p>Retrouvez les réponses de l’équipe HomeFix et l’état de vos dossiers.</p></div></header>
    {page.items.length === 0 ? <div className={styles.emptyHistory}><Inbox size={28}/><p>Aucune demande envoyée pour le moment.</p></div> : <div className={styles.historyList}>{page.items.map(item => <article key={item.id} id={`reclamation-${item.id}`} className={styles.historyItem}>
      <header><h3>{item.subject}</h3><span className={`${styles.status} ${styles[`status_${item.status}`] ?? ""}`}>{statusLabels[item.status] ?? item.status}</span></header>
      <small className={styles.historyDate}><Clock3 size={12}/>{date(item.createdAt)}</small>
      {item.request && <p className={styles.relatedIntervention}><strong>{item.request.title}</strong> · {item.request.professional.businessName || item.request.professional.name}</p>}
      <details><summary>Voir ma demande <ChevronDown size={13}/></summary><p className={styles.originalMessage}>{item.message}</p>{item.attachments.length > 0 && <ul className={styles.attachedFiles}>{item.attachments.map(file => <li key={file.id}><a href={`/api/client/reclamations/${item.id}/attachments/${file.id}`}><Download size={13}/>{file.name} <small>({Math.ceil(file.size / 1024)} Ko)</small></a></li>)}</ul>}</details>
      {item.response?.trim() ? <section className={styles.adminReply}><strong><CheckCheck size={15}/>Réponse de l’équipe HomeFix</strong><p>{item.response}</p></section> : <p className={styles.waitingReply}>Votre demande a bien été transmise à notre équipe.</p>}
    </article>)}</div>}
    {page.nextCursor && <button type="button" className={styles.loadMore} disabled={busy} onClick={() => void more()}>{busy ? "Chargement…" : "Voir les demandes précédentes"}</button>}
    {error && <p className={styles.error} role="alert">{error}</p>}
  </section>;
}
