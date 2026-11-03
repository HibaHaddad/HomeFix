"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Wrench } from "lucide-react";
import type { WorkspaceData } from "@/app/lib/client-workspace";
import { getChatSocket } from "@/lib/chat-socket";
import { statusLabels } from "@/lib/client-domain";
import InterventionTrackingCard from "./InterventionTrackingCard";

export default function ClientInterventions({ requests, selected }: { requests: WorkspaceData["requests"]; selected?: number }) {
  const [items, setItems] = useState(requests);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [day, setDay] = useState("");
  const [pagination, setPagination] = useState({ page: Math.floor(Math.max(0, requests.findIndex((r) => r.id === selected)) / 6) + 1, selected });
  const setPage = (page: number) => setPagination({ page, selected });
  const resetFilters = () => { setQuery(""); setStatus(""); setProfessionalId(""); setDay(""); setPage(1); };
  const professionals = Array.from(new Map(items.map((r) => [r.professional.id, r.professional])).values());
  const filtered = items.filter((r) =>
    (!query || `${r.title} ${r.message}`.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr"))) &&
    (!status || r.status === status) &&
    (!professionalId || r.professionalId === Number(professionalId)) &&
    (!day || (r.booking && new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Tunis" }).format(new Date(r.booking.startsAt)) === day)),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / 6));
  const requestedPage = pagination.selected === selected ? pagination.page : Math.floor(Math.max(0, filtered.findIndex((r) => r.id === selected)) / 6) + 1;
  const currentPage = Math.min(requestedPage, pageCount);
  const visibleItems = filtered.slice((currentPage - 1) * 6, currentPage * 6);
  useEffect(() => { setItems(requests); }, [requests]);
  useEffect(() => {
    const socket = getChatSocket();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let connectedBefore = socket.connected, inFlight = false, queued = false;
    const load = async () => {
      if (controller.signal.aborted) return;
      if (inFlight) { queued = true; return; }
      inFlight = true;
      try {
        const response = await fetch(`/api/client/interventions${selected ? `?demande=${selected}` : ""}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!controller.signal.aborted) { setItems(data.requests); setError(""); }
      } catch { if (!controller.signal.aborted) setError("Actualisation interrompue. Le suivi reprendra au retour de la connexion."); }
      finally { inFlight = false; if (queued && !controller.signal.aborted) { queued = false; refresh(); } }
    };
    const refresh = () => { clearTimeout(timer); timer = setTimeout(() => void load(), 250); };
    const connect = () => { if (connectedBefore) refresh(); connectedBefore = true; };
    // Initial data already came from PostgreSQL in the server render. Refresh
    // only changed data or a recovered connection, without restarting RSC.
    socket.on("connect", connect); socket.on("chat:message", refresh); socket.on("chat:message-updated", refresh); socket.on("intervention:updated", refresh);
    window.addEventListener("focus", refresh);
    return () => { controller.abort(); clearTimeout(timer); socket.off("connect", connect); socket.off("chat:message", refresh); socket.off("chat:message-updated", refresh); socket.off("intervention:updated", refresh); window.removeEventListener("focus", refresh); };
  }, [selected]);
  return <>{error && <p className="cx-feedback is-error" role="status">{error}</p>}{!items.length ? <section className="cx-empty"><Wrench size={32}/><h2>Votre prochain projet commence ici.</h2><p>Retrouvez ici le parcours de vos interventions.</p><Link className="cx-btn" href="/dashboard/messagerie">Ouvrir la messagerie</Link></section> : <>
    <section className="cx-panel flow-request-filters" aria-label="Filtres des interventions">
      <div className="cx-form"><div className="cx-fields">
        <label>Rechercher<input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Un problème, une description…"/></label>
        <label>Statut<select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">Tous les statuts</option>{[...new Set(items.map((r) => r.status))].map((value) => <option key={value} value={value}>{statusLabels[value] || value}</option>)}</select></label>
        <label>Professionnel<select value={professionalId} onChange={(e) => { setProfessionalId(e.target.value); setPage(1); }}><option value="">Tous les professionnels</option>{professionals.map((p) => <option key={p.id} value={p.id}>{p.businessName || p.name}</option>)}</select></label>
        <label>Date de l’intervention<input type="date" value={day} onChange={(e) => { setDay(e.target.value); setPage(1); }}/></label>
      </div></div>
      <div className="cx-panel-title"><button type="button" className="cx-text-btn" onClick={resetFilters}>Réinitialiser les filtres</button></div>
    </section>
    <div className="ij-list">{visibleItems.map((request) => <InterventionTrackingCard key={request.id} request={request} selected={selected === request.id}/>)}</div>
    {!filtered.length && <section className="cx-empty"><Wrench size={32}/><h2>Aucune intervention ne correspond aux filtres.</h2><p>Modifiez les critères pour retrouver vos interventions.</p></section>}
    {pageCount > 1 && <nav className="flow-request-pagination" aria-label="Pagination des interventions"><button type="button" className="cx-btn secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={16}/> Précédent</button><span aria-live="polite">Page {currentPage} sur {pageCount}</span><button type="button" className="cx-btn secondary" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Suivant <ChevronRight size={16}/></button></nav>}
  </>}</>;
}
