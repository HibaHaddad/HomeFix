"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { Eye, LockKeyhole, RefreshCw, Paperclip, MapPin, LoaderCircle } from "lucide-react";
import type { AdminConversationAccess, AdminConversationSummary } from "@/lib/admin-messaging";
import { formatBookingChatText, bookingRangeLabel } from "@/lib/booking-message";
import { formatInterventionStatusMessage } from "@/lib/intervention-status-message";
import { money, statusLabels } from "@/lib/client-domain";
import AdminReviewAvatar from "./AdminReviewAvatar";

const day = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Africa/Tunis" }).format(new Date(value));
const clock = (value: string) => new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Tunis" }).format(new Date(value));
const readable = (value: string) => formatBookingChatText(formatInterventionStatusMessage(value).replace(/^Intervention\s*#\d+\s*[·?]\s*/, "").replace("Le rendez-vous sera confirmé après accord sur le devis.", "").trim());

async function fetchConversation(id: number, before?: number, signal?: AbortSignal): Promise<AdminConversationAccess> {
  const response = await fetch(`/api/admin/conversations/${id}/access`, { method: "POST", cache: "no-store", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(before ? { before } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "La consultation est indisponible.");
  return data;
}

export default function AdminConversationChat({ conversation, back }: { conversation: AdminConversationSummary; back: ReactNode }) {
  const [result, setResult] = useState<AdminConversationAccess | null>(null);
  const [grants, setGrants] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const viewport = useRef<HTMLDivElement>(null);
  const scrollRestore = useRef<number | null>(null);
  const pro = conversation.professional;

  useEffect(() => {
    const controller = new AbortController();
    void fetchConversation(conversation.id, undefined, controller.signal).then(access => {
      if (controller.signal.aborted) return;
      setGrants(Object.fromEntries(access.messages.map(message => [message.id, access.accessId])));
      setResult(access);
    }).catch(failure => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "La consultation est indisponible.");
    }).finally(() => {
      if (!controller.signal.aborted) setBusy(false);
    });
    return () => controller.abort();
  }, [conversation.id]);

  useLayoutEffect(() => {
    if (!viewport.current || !result) return;
    viewport.current.scrollTop = scrollRestore.current === null ? viewport.current.scrollHeight : viewport.current.scrollHeight - scrollRestore.current;
    scrollRestore.current = null;
  }, [result]);

  async function consult(before?: number) {
    if (busy) return;
    setBusy(true); setError("");
    const previousBottom = viewport.current ? viewport.current.scrollHeight - viewport.current.scrollTop : 0;
    try {
      const access = await fetchConversation(conversation.id, before);
      const batchGrants = Object.fromEntries(access.messages.map(message => [message.id, access.accessId]));
      scrollRestore.current = before ? previousBottom : null;
      setGrants(previous => before ? { ...previous, ...batchGrants } : batchGrants);
      setResult(previous => before && previous ? { ...access, initialMessage: previous.initialMessage, messages: [...access.messages, ...previous.messages] } : access);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "La consultation est indisponible."); }
    finally { setBusy(false); }
  }

  return <section className="cx-chat-main" aria-label="Conversation en lecture seule">
    <header className="am-thread-heading">{back}<div className="am-participant-avatars"><AdminReviewAvatar userId={conversation.client.id} name={conversation.client.name} hasPhoto={!!conversation.client.profilePhotoMime}/><AdminReviewAvatar userId={pro.id} name={pro.businessName || pro.name} hasPhoto={!!pro.profilePhotoMime} professional/></div><div className="am-thread-title"><h2>{conversation.client.name} <span>et</span> {pro.businessName || pro.name}</h2><p>{conversation.title}</p></div><span className="am-readonly"><Eye size={14}/>Lecture seule</span>{result && <div className="am-thread-actions"><button title="Actualiser les échanges" aria-label="Actualiser les échanges" disabled={busy} onClick={() => void consult()}><RefreshCw size={17} className={busy ? "am-spin" : ""}/></button></div>}</header>
    {result && !!result.interventions.length && <details className="am-interventions"><summary>Interventions et devis associés <span>{result.interventions.length}</span></summary><div>{result.interventions.map(item => <article key={item.id}><Link href={`/admin/demandes/${item.id}`}><strong>{item.title}</strong></Link><span>{statusLabels[item.status] ?? item.status}</span>{item.booking && <small>{bookingRangeLabel(new Date(item.booking.startsAt), new Date(item.booking.endsAt))}</small>}{item.quotes.map(quote => <small key={quote.id}>Devis : {money(quote.amountMillimes)} · {statusLabels[quote.status] ?? quote.status}</small>)}</article>)}</div></details>}
    {error && <p className="am-error" role="alert">{error}</p>}
    <div className="cx-messages" ref={viewport} aria-busy={busy}>
      {!result ? <div className="am-lock-state">{busy ? <><LoaderCircle size={30} className="am-spin"/><h2>Chargement de la conversation</h2></> : <><h2>Historique indisponible</h2><button className="admin-button admin-button-primary" onClick={() => void consult()}>Réessayer</button></>}</div> : <>
        {result.nextBefore && <button className="am-load-older" disabled={busy} onClick={() => void consult(result.nextBefore!)}>{busy ? <LoaderCircle size={15} className="am-spin"/> : null}Charger les messages précédents</button>}
        {result.initialMessage && !result.nextBefore && <div className="am-initial"><span>Début de la conversation</span><p>{readable(result.initialMessage)}</p></div>}
        {!result.messages.length && !result.initialMessage && <div className="am-lock-state"><h2>Aucun message pour le moment</h2><p>Les échanges apparaîtront ici dès leur envoi.</p></div>}
        {result.messages.map((message, index) => {
          const professional = message.senderId === pro.id;
          const fileUrl = (fileId: number) => `/api/admin/conversations/${conversation.id}/attachments/${fileId}?access=${grants[message.id]}`;
          return <div key={message.id} className="rt-message-row">{(!index || day(result.messages[index - 1].createdAt) !== day(message.createdAt)) && <div className="rt-day">{day(message.createdAt)}</div>}<article className={`cx-message ${professional ? "outgoing" : "incoming"}`}><strong className="am-message-sender">{message.sender} <span>· {professional ? "Professionnel" : "Client"}</span></strong>{message.text && <p>{readable(message.text)}</p>}
            {message.quote && <div className="rt-booking-offer"><span className="rt-offer-label">DEVIS</span><strong className="rt-offer-price">{money(message.quote.amountMillimes)}</strong><p>{statusLabels[message.quote.status] ?? message.quote.status}</p>{message.quote.request.booking && <p>{bookingRangeLabel(new Date(message.quote.request.booking.startsAt), new Date(message.quote.request.booking.endsAt))}</p>}</div>}
            {message.latitude !== null && message.longitude !== null && <a className="am-location" href={`https://www.openstreetmap.org/?mlat=${message.latitude}&mlon=${message.longitude}#map=16/${message.latitude}/${message.longitude}`} target="_blank" rel="noreferrer"><MapPin size={17}/>Voir la localisation partagée</a>}
            {message.attachments.map(file => <a key={file.id} className="rt-attachment" href={fileUrl(file.id)} target="_blank" rel="noreferrer">{["image/jpeg", "image/png", "image/webp"].includes(file.mime) ? <Image src={fileUrl(file.id)} alt={file.name} width={290} height={200} style={{ width: "auto", height: "auto" }} unoptimized/> : <Paperclip size={18}/>}<span>{file.name} · {Math.max(1, Math.round(file.size / 1024))} Ko</span></a>)}
            <small><time dateTime={message.createdAt}>{clock(message.createdAt)}</time></small>
          </article></div>;
        })}
      </>}
    </div>
    <footer className="am-chat-footer"><LockKeyhole size={14}/>Consultation uniquement · Aucun message ne peut être envoyé</footer>
  </section>;
}
