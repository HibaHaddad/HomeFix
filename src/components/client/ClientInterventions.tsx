"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Wrench } from "lucide-react";
import type { WorkspaceData } from "@/app/lib/client-workspace";
import { getChatSocket } from "@/lib/chat-socket";
import InterventionTrackingCard from "./InterventionTrackingCard";

export default function ClientInterventions({ requests, selected }: { requests: WorkspaceData["requests"]; selected?: number }) {
  const [items, setItems] = useState(requests);
  const [error, setError] = useState("");
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
  return <>{error && <p className="cx-feedback is-error" role="status">{error}</p>}{!items.length ? <section className="cx-empty"><Wrench size={32}/><h2>Votre prochain projet commence ici.</h2><p>Retrouvez ici le parcours de vos interventions.</p><Link className="cx-btn" href="/dashboard/messagerie">Ouvrir la messagerie</Link></section> : <div className="ij-list">{items.map((request) => <InterventionTrackingCard key={request.id} request={request} selected={selected === request.id}/>)}</div>}</>;
}
