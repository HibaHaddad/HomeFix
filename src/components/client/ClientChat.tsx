"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MapPin, Paperclip, Send, MessageSquare, CheckCheck, ShieldCheck } from "lucide-react";
import type { WorkspaceData } from "@/app/lib/client-workspace";
import { dateLabel } from "@/lib/client-domain";
import { workspaceAction } from "./WorkspaceForm";
type Message = { id: number; senderId: number; text: string; latitude: number | null; longitude: number | null; readAt: string | null; createdAt: string; attachments: { id: number; name: string; mime: string; size: number }[] };
export default function ClientChat({ requests, selected }: { requests: WorkspaceData["requests"]; selected?: number }) {
  const conversations = requests.filter((r) => r.professionalId);
  const [activeId, setActiveId] = useState(selected && conversations.some((r) => r.id === selected) ? selected : conversations[0]?.id);
  const [messages, setMessages] = useState<Message[]>([]); const [actorId, setActorId] = useState(0); const [text, setText] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [loading, setLoading] = useState(false); const end = useRef<HTMLDivElement>(null);
  const active = conversations.find((r) => r.id === activeId);
  const activeRef = useRef(activeId); activeRef.current = activeId;
  const reload = useCallback(async () => {
    if (!activeId) return;
    try {
      let cursor = 0; const all: Message[] = [];
      // Cursor pagination keeps long histories accessible without truncation.
      while (true) {
        const response = await fetch(`/api/client/conversations/${activeId}?after=${cursor}`, { cache: "no-store" }); const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (activeRef.current !== activeId) return;
        all.push(...data.messages); setActorId(data.actorId);
        if (data.messages.length < 100) break;
        cursor = data.messages[data.messages.length - 1].id;
      }
      setMessages(all); setError("");
      if (document.visibilityState === "visible") await fetch(`/api/client/conversations/${activeId}`, { method: "POST" });
    } catch (e) { if (activeRef.current === activeId) setError(e instanceof Error ? e.message : "Connexion interrompue."); }
    finally { if (activeRef.current === activeId) setLoading(false); }
  }, [activeId]);
  useEffect(() => { setMessages([]); setLoading(true); void reload(); const timer = setInterval(() => { if (document.visibilityState === "visible") void reload(); }, 5000); return () => clearInterval(timer); }, [reload]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages.length]);
  async function send(extra: Record<string, unknown> = {}) {
    if (!activeId || busy) return; setBusy(true); setError("");
    try { await workspaceAction("message.send", { requestId: activeId, text: text.trim() || "Position exacte de l’intervention", ...extra }); setText(""); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Envoi impossible."); } finally { setBusy(false); }
  }
  if (!conversations.length) return <section className="cx-empty"><MessageSquare size={34}/><h2>Le premier échange commence ici.</h2><p>Choisissez un professionnel pour lui transmettre votre demande et ouvrir une conversation.</p><Link href="/dashboard/professionnels" className="cx-btn">Trouver un professionnel</Link></section>;
  return <div className="cx-chat"><aside className="cx-conversations"><div className="cx-panel-title"><h2>Conversations</h2><span className="cx-count">{conversations.length}</span></div>{conversations.map((r) => <button key={r.id} className={r.id === activeId ? "is-active" : ""} onClick={() => { setActiveId(r.id); setError(""); }}><span className="cx-person-avatar">{r.professional?.name[0]}</span><span><strong>{r.professional?.businessName || r.professional?.name}</strong><small>#{r.id} · {r.title}</small></span></button>)}</aside>
    <section className="cx-chat-main"><header><span className="cx-person-avatar">{active?.professional?.name[0]}</span><div><h2>{active?.professional?.businessName || active?.professional?.name}</h2><p>Demande #{activeId} · {active?.title}</p></div><Link href={`/dashboard/professionnels/${active?.professionalId}`} className="cx-text-btn">Voir le profil</Link></header><div className="cx-chat-security"><ShieldCheck size={14}/> Conversation privée · actualisation toutes les 5 secondes</div>
      <div className="cx-messages" aria-live="polite" aria-busy={loading}>{active?.message && <div className="cx-chat-context"><small>VOTRE DEMANDE INITIALE</small><p>{active.message}</p></div>}{loading && <p>Chargement de la conversation…</p>}{messages.map((m) => <article className={`cx-message ${m.senderId === actorId ? "outgoing" : "incoming"}`} key={m.id}><p>{m.text}</p>{m.latitude !== null && m.longitude !== null && <a className="cx-gps" href={`https://www.openstreetmap.org/?mlat=${m.latitude}&mlon=${m.longitude}#map=18/${m.latitude}/${m.longitude}`} target="_blank" rel="noreferrer"><MapPin size={20}/><span>Position partagée<strong>{m.latitude.toFixed(6)}, {m.longitude.toFixed(6)}</strong>Ouvrir la carte ↗</span></a>}{m.attachments.map((f) => <a className="cx-attachment" key={f.id} href={`/api/client/fichiers/${f.id}`}><Paperclip size={14}/>{f.name}</a>)}<small>{dateLabel(m.createdAt)} {m.senderId === actorId && <span><CheckCheck size={13}/>{m.readAt ? "Lu" : "Envoyé"}</span>}</small></article>)}<div ref={end}/></div>
      {error && <p className="cx-feedback is-error" role="alert">{error}</p>}<form className="cx-chat-compose" onSubmit={(e) => { e.preventDefault(); if (text.trim()) void send(); }}><label className="cx-file-button" title="Joindre un fichier"><Paperclip size={19}/><input type="file" aria-label="Joindre un fichier" accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf" disabled={busy || active?.status === "CANCELLED"} onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; setBusy(true); setError(""); try { const form = new FormData(); form.set("requestId", String(activeId)); form.set("file", file); form.set("chat", "true"); const response = await fetch("/api/client/fichiers", { method: "POST", body: form }); const result = await response.json(); if (!response.ok) throw new Error(result.error); await reload(); } catch (e) { setError(e instanceof Error ? e.message : "Envoi impossible."); } finally { setBusy(false); } e.target.value = ""; }}/></label>
      <button type="button" aria-label="Partager ma position exacte" title="Partager ma position exacte" disabled={busy || active?.status === "CANCELLED"} onClick={() => { if (!navigator.geolocation) { setError("La géolocalisation n’est pas disponible sur cet appareil."); return; } if (!window.confirm("Partager votre position GPS exacte avec ce professionnel ?")) return; setBusy(true); navigator.geolocation.getCurrentPosition((position) => { setBusy(false); void send({ latitude: position.coords.latitude, longitude: position.coords.longitude, text: "Position exacte de l’intervention" }); }, () => { setBusy(false); setError("Position inaccessible. Vérifiez l’autorisation GPS de votre navigateur."); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }); }}><MapPin size={19}/></button>
      <input aria-label="Votre message" placeholder="Écrivez votre message…" maxLength={3000} value={text} onChange={(e) => setText(e.target.value)} disabled={busy || active?.status === "CANCELLED"}/><button className="cx-send" disabled={busy || !text.trim() || active?.status === "CANCELLED"} type="submit" aria-label="Envoyer le message"><Send size={18}/></button></form>
    </section></div>;
}
