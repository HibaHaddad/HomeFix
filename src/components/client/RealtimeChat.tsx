"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, CheckCheck, MapPin, Paperclip, Send, MessageSquare, ShieldCheck, X } from "lucide-react";
import type { WorkspaceData } from "@/app/lib/client-workspace";
import type { ChatMessage } from "@/lib/chat-types";
import { chatCommand, getChatSocket } from "@/lib/chat-socket";
import { dateLabel } from "@/lib/client-domain";
import { formatBookingChatText } from "@/lib/booking-message";
import InterventionComposer from "./InterventionComposer";
import ConversationInterventions from "./ConversationInterventions";
import ChatBookingOffer from "./ChatBookingOffer";

type Thread = WorkspaceData["requests"][number] & { client?: { name: string } };
const merge = (old: ChatMessage[], next: ChatMessage[]) => Array.from(new Map([...old, ...next].map((m) => [m.id, m])).values()).sort((a, b) => a.id - b.id);
export default function RealtimeChat({ requests, selected, professional = false, address = "" }: { requests: Thread[]; selected?: number; professional?: boolean; address?: string }) {
  const conversations = Array.from(new Map(requests.filter((r) => r.kind === "MESSAGE" || !r.conversationId).map((r) => [r.id, r])).values());
  const selectedThread = requests.find((r) => r.id === selected)?.conversationId ?? selected;
  const [activeId, setActiveId] = useState(selectedThread || conversations[0]?.id);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [interventions, setInterventions] = useState<WorkspaceData["requests"]>([]);
  const [actorId, setActorId] = useState(0);
  const [text, setText] = useState(""); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false); const [online, setOnline] = useState(false); const [typing, setTyping] = useState(false);
  const [file, setFile] = useState<File | null>(null); const [preview, setPreview] = useState("");
  const [mobileOpen, setMobileOpen] = useState(Boolean(selected));
  const end = useRef<HTMLDivElement>(null); const viewport = useRef<HTMLDivElement>(null);
  const activeRef = useRef(activeId); activeRef.current = activeId;
  const liveMessages = useRef(messages); liveMessages.current = messages;
  const typingAt = useRef(0); const pending = useRef<{ signature: string; nonce: string } | null>(null);
  const firstScroll = useRef(true);
  const active = conversations.find((r) => r.id === activeId);
  const name = (r: Thread) => professional ? r.client?.name || "Client HomeFix" : r.professional.businessName || r.professional.name;
  useEffect(() => { if (selectedThread) { setActiveId(selectedThread); setMobileOpen(true); } }, [selectedThread]);
  useEffect(() => { if (!file) { setPreview(""); return; } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  const reload = useCallback(async () => {
    if (!activeId) return;
    try {
      let cursor = 0; const all: ChatMessage[] = [];
      while (true) {
        const response = await fetch(`/api/client/conversations/${activeId}?after=${cursor}`, { cache: "no-store" });
        const data = await response.json(); if (!response.ok) throw new Error(data.error);
        if (activeRef.current !== activeId) return;
        all.push(...data.messages); setActorId(data.actorId);
        if (!cursor) setInterventions(data.interventions || []);
        if (data.messages.length < 100) break;
        cursor = data.messages[data.messages.length - 1].id;
      }
      // Keep messages that arrived while the history was being fetched.
      setMessages((old) => merge(old, all)); setError("");
    } catch (e) { if (activeRef.current === activeId) setError(e instanceof Error ? e.message : "Historique indisponible."); }
    finally { if (activeRef.current === activeId) setLoading(false); }
  }, [activeId]);
  useEffect(() => {
    firstScroll.current = true;
    setMessages([]); setInterventions([]); setText(""); setFile(null); setLoading(Boolean(activeId)); setTyping(false); setOnline(false);
    if (!activeId) return;
    const socket = getChatSocket(); let disposed = false; let typingTimer: ReturnType<typeof setTimeout>;
    const open = async () => {
      setConnected(true);
      try {
        const result = await chatCommand<{ online: boolean; actorId: number }>("chat:open", { requestId: activeId });
        if (disposed) return; setOnline(result.online); setActorId(result.actorId); await reload();
      } catch (e) { if (!disposed) setError(e instanceof Error ? e.message : "Conversation indisponible."); }
    };
    const receive = (m: ChatMessage) => { if (m.requestId === activeId) { setMessages((old) => merge(old, [m])); if (m.quote) void reload(); } };
    const updated = (m: ChatMessage) => { receive(m); if (m.requestId === activeId) void reload(); };
    const receipts = (data: { requestId: number; messages: Pick<ChatMessage, "id" | "deliveredAt" | "readAt">[] }) => {
      if (data.requestId === activeId) setMessages((old) => old.map((m) => ({ ...m, ...data.messages.find((r) => r.id === m.id) })));
    };
    const presence = (data: { online: boolean }) => setOnline(data.online);
    const writing = (data: { requestId: number; typing: boolean }) => { if (data.requestId !== activeId) return; setTyping(data.typing); clearTimeout(typingTimer); typingTimer = setTimeout(() => setTyping(false), 3000); };
    const workflowUpdated = () => { void reload(); };
    const disconnect = () => { setConnected(false); setOnline(false); setTyping(false); };
    socket.on("connect", open); socket.on("disconnect", disconnect); socket.on("chat:message", receive); socket.on("chat:message-updated", updated); socket.on("intervention:updated", workflowUpdated); socket.on("chat:receipts", receipts); socket.on("chat:presence", presence); socket.on("chat:typing", writing);
    if (socket.connected) void open(); else { socket.connect(); void reload(); }
    return () => { disposed = true; clearTimeout(typingTimer); socket.off("connect", open); socket.off("disconnect", disconnect); socket.off("chat:message", receive); socket.off("chat:message-updated", updated); socket.off("intervention:updated", workflowUpdated); socket.off("chat:receipts", receipts); socket.off("chat:presence", presence); socket.off("chat:typing", writing); if (socket.connected) { void chatCommand("chat:typing", { requestId: activeId, typing: false }).catch(() => {}); void chatCommand("chat:close", {}).catch(() => {}); } };
  }, [activeId, reload]);
  useEffect(() => {
    if (!activeId || !actorId || !connected) return;
    const acknowledge = () => {
      const incoming = liveMessages.current.filter((m) => m.senderId !== actorId);
      const delivered = incoming.filter((m) => !m.deliveredAt).map((m) => m.id);
      for (let i = 0; i < delivered.length; i += 200) void chatCommand("chat:delivered", { requestId: activeId, ids: delivered.slice(i, i + 200) }).catch(() => {});
      if (document.visibilityState !== "visible" || !document.hasFocus() || !viewport.current?.getClientRects().length) return;
      const unread = incoming.filter((m) => !m.readAt).map((m) => m.id);
      for (let i = 0; i < unread.length; i += 200) void chatCommand("chat:read", { requestId: activeId, ids: unread.slice(i, i + 200) }).catch(() => {});
    };
    acknowledge(); document.addEventListener("visibilitychange", acknowledge); window.addEventListener("focus", acknowledge);
    return () => { document.removeEventListener("visibilitychange", acknowledge); window.removeEventListener("focus", acknowledge); };
  }, [activeId, actorId, connected, messages, mobileOpen]);
  useEffect(() => { const box = viewport.current; if (messages.length && (firstScroll.current || !box || box.scrollHeight - box.scrollTop - box.clientHeight < 350 || messages.at(-1)?.senderId === actorId)) { end.current?.scrollIntoView({ behavior: firstScroll.current ? "instant" : "smooth", block: "nearest" }); firstScroll.current = false; } }, [messages.length, loading, actorId]);
  async function send(gps?: { latitude: number; longitude: number }) {
    if (!activeId || busy) return;
    setBusy(true); setError(""); const requestId = activeId;
    try {
      const value = gps ? "Position exacte de l’intervention" : text.trim();
      const signature = JSON.stringify({ requestId, value, gps, file: file ? [file.name, file.size, file.lastModified] : null });
      if (pending.current?.signature !== signature) pending.current = { signature, nonce: crypto.randomUUID() };
      if (file && !gps) {
        const form = new FormData(); form.set("requestId", String(requestId)); form.set("file", file); form.set("chat", "true"); form.set("nonce", pending.current.nonce); form.set("text", value);
        const response = await fetch("/api/client/fichiers", { method: "POST", body: form }); const result = await response.json(); if (!response.ok) throw new Error(result.error);
        if (activeRef.current === requestId) { setFile(null); setText(""); }
      } else {
        const message = await chatCommand<ChatMessage>("chat:send", { requestId, nonce: pending.current.nonce, text: value, ...gps });
        if (activeRef.current === requestId) { setMessages((old) => merge(old, [message])); if (!gps) setText(""); }
      }
      pending.current = null;
      void chatCommand("chat:typing", { requestId, typing: false }).catch(() => {});
    } catch (e) { setError(e instanceof Error ? e.message : "Envoi non confirmé. Réessayez : aucun doublon ne sera créé."); }
    finally { setBusy(false); }
  }
  if (!conversations.length) return <section className="cx-empty"><MessageSquare size={34}/><h2>Le premier échange commence ici.</h2><p>{professional ? "Vos échanges avec les clients apparaîtront ici." : "Contactez un professionnel pour démarrer une conversation privée."}</p>{!professional && <Link href="/dashboard/professionnels" className="cx-btn">Trouver un professionnel</Link>}</section>;
  return <div className={`cx-chat rt-chat ${mobileOpen ? "rt-thread-open" : ""}`}><aside className="cx-conversations"><div className="cx-panel-title"><h2>Conversations</h2><span className="cx-count">{conversations.length}</span></div>{conversations.map((r) => <button key={r.id} className={r.id === activeId ? "is-active" : ""} onClick={() => { setActiveId(r.id); setMobileOpen(true); }}><span className="cx-person-avatar">{name(r)[0]}</span><span><strong>{name(r)}</strong><small>Conversation privée</small></span></button>)}</aside>
    <section className="cx-chat-main"><header><button className="rt-back" onClick={() => setMobileOpen(false)} aria-label="Retour aux conversations">←</button><span className="cx-person-avatar">{active ? name(active)[0] : ""}</span><div><h2>{active ? name(active) : "Conversation"}</h2><p><i className={`rt-presence ${online ? "online" : ""}`}/>{connected ? online ? "En ligne" : "Hors ligne" : "Reconnexion en cours…"}</p></div>{!professional && <Link href={`/dashboard/professionnels/${active?.professionalId}`} className="cx-text-btn">Voir le profil</Link>}</header>
      <div className="cx-chat-security"><ShieldCheck size={14}/>Conversation privée · {connected ? "Temps réel connecté" : "Connexion interrompue"}</div>
      <div className="flow-chat-toolbar">{!professional && active && <InterventionComposer key={activeId} professionalId={active.professionalId} conversationId={activeId} address={address} onCreated={() => void reload()}/>}<details className="flow-chat-projects"><summary>Interventions et devis ({interventions.length})</summary><ConversationInterventions requests={interventions} professional={professional} onChange={() => void reload()}/></details></div>
      <div ref={viewport} className="cx-messages" aria-live="polite" aria-busy={loading}>{active?.message && <div className="cx-chat-context"><small>DEMANDE INITIALE</small><p>{active.message}</p></div>}{loading && <p>Chargement de la conversation…</p>}{!loading && !messages.length && <p className="rt-start">Présentez votre problème, ajoutez une photo et échangez directement.</p>}{messages.map((m, index) => <div className="rt-message-row" key={m.id}>{(!index || new Date(messages[index - 1].createdAt).toDateString() !== new Date(m.createdAt).toDateString()) && <div className="rt-day">{new Date(m.createdAt).toLocaleDateString("fr-TN", { dateStyle: "long" })}</div>}<article className={`cx-message ${m.senderId === actorId ? "outgoing" : "incoming"}`}><p>{formatBookingChatText(m.text.replace(/^Intervention\s*#\d+\s*[\u00b7?]\s*/, "").replace("Le rendez-vous sera confirm\u00e9 apr\u00e8s accord sur le devis.", "").trim())}</p>{m.quote && <ChatBookingOffer quote={m.quote} professional={professional} onChange={() => void reload()}/>} {m.latitude !== null && m.longitude !== null && <div className="rt-location"><iframe title="Position partagée" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" src={`https://www.openstreetmap.org/export/embed.html?bbox=${m.longitude - .003},${m.latitude - .002},${m.longitude + .003},${m.latitude + .002}&layer=mapnik&marker=${m.latitude},${m.longitude}`}/><a className="cx-gps" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${m.latitude},${m.longitude}`)}`} target="_blank" rel="noreferrer"><MapPin size={18}/><span>Position partagée<strong>{m.latitude.toFixed(6)}, {m.longitude.toFixed(6)}</strong>Ouvrir la carte ↗</span></a></div>}{m.attachments.map((f) => <a className="cx-attachment rt-attachment" key={f.id} href={`/api/client/fichiers/${f.id}`} target="_blank" rel="noreferrer">{f.mime.startsWith("image/") ? <img src={`/api/client/fichiers/${f.id}`} alt={f.name} loading="lazy"/> : <Paperclip size={16}/>}<span>{f.name}</span></a>)}<small><time dateTime={m.createdAt} title={dateLabel(m.createdAt)}>{new Date(m.createdAt).toLocaleTimeString("fr-TN", { hour: "2-digit", minute: "2-digit" })}</time>{m.senderId === actorId && <span className={m.readAt ? "rt-read" : ""} title={m.readAt ? "Lu" : m.deliveredAt ? "Délivré" : "Envoyé"}>{m.deliveredAt || m.readAt ? <CheckCheck size={15}/> : <Check size={15}/>}</span>}</small></article></div>)}<div ref={end}/></div>
      <div className="rt-typing" role="status">{typing && "En train d’écrire…"}</div>{error && <p className="cx-feedback is-error" role="alert">{error}</p>}
      {file && <div className="rt-preview">{preview && <img src={preview} alt="Aperçu de la photo à envoyer"/>}<span>{file.name}<small>{(file.size / 1024 / 1024).toFixed(1)} Mo</small></span><button type="button" aria-label="Retirer la photo" disabled={busy} onClick={() => setFile(null)}><X size={18}/></button></div>}
      <form className="cx-chat-compose" onSubmit={(e) => { e.preventDefault(); if (text.trim() || file) void send(); }}><label className="cx-file-button" title="Ajouter une photo"><Paperclip size={19}/><input type="file" aria-label="Ajouter une photo" accept="image/jpeg,image/png,image/webp" disabled={busy || !connected} onChange={(e) => { const chosen = e.target.files?.[0]; e.target.value = ""; if (!chosen) return; if (chosen.size > 8 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(chosen.type)) { setError("Choisissez une photo JPEG, PNG ou WebP de 8 Mo maximum."); return; } setFile(chosen); setError(""); }}/></label>
        {!professional && <button type="button" aria-label="Partager ma position exacte" title="Partager volontairement ma position" disabled={busy || !connected} onClick={() => { if (!navigator.geolocation) { setError("Géolocalisation indisponible."); return; } if (!window.confirm("Partager votre position GPS exacte avec ce professionnel ? La carte utilisera OpenStreetMap pour l’afficher.")) return; setBusy(true); navigator.geolocation.getCurrentPosition((position) => { setBusy(false); void send({ latitude: position.coords.latitude, longitude: position.coords.longitude }); }, () => { setBusy(false); setError("Position inaccessible. Vérifiez l’autorisation GPS du navigateur."); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }); }}><MapPin size={19}/></button>}
        <input aria-label="Votre message" placeholder="Écrivez votre message…" maxLength={3000} value={text} disabled={busy} onChange={(e) => { setText(e.target.value); if (activeId && connected && Date.now() - typingAt.current > 1000) { typingAt.current = Date.now(); void chatCommand("chat:typing", { requestId: activeId, typing: Boolean(e.target.value) }).catch(() => {}); } }}/><button className="cx-send" disabled={busy || !connected || (!text.trim() && !file)} type="submit" aria-label="Envoyer le message"><Send size={18}/></button></form>
    </section></div>;
}
