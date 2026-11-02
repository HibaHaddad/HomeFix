"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, CalendarDays, Check, ChevronDown, Clock3, MapPin, MessageSquare, Paperclip } from "lucide-react";
import type { WorkspaceData } from "@/app/lib/client-workspace";
import { dateLabel, money } from "@/lib/client-domain";
import { tunisTime } from "@/lib/availability";
import { getInterventionProgress } from "@/lib/intervention-progress";
import InterventionJourney from "./InterventionJourney";
import FinishIntervention from "./FinishIntervention";

export default function InterventionTrackingCard({ request: r, selected = false }: { request: WorkspaceData["requests"][number]; selected?: boolean }) {
  const card = useRef<HTMLElement>(null);
  const [expanded, setExpanded] = useState(selected);
  useEffect(() => {
    if (selected) { setExpanded(true); card.current?.focus({ preventScroll: true }); card.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); }
  }, [selected]);
  const progress = getInterventionProgress(r);
  const price = r.quotes.find((q) => q.status === "ACCEPTED");
  const proposed = r.quotes.find((q) => q.status === "PENDING");
  const name = r.professional.businessName || r.professional.name;
  const photo = r.attachments.find((file) => file.mime.startsWith("image/"));
  const booking = r.booking;
  const scheduled = booking && !["CANCELLED", "REJECTED"].includes(booking.status);
  const day = booking ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Tunis" }).format(new Date(booking.startsAt)) : null;
  return <article ref={card} id={`intervention-${r.id}`} tabIndex={selected ? -1 : undefined} className={`cx-panel cx-confirmed-intervention ij-card${progress.stopped ? " is-stopped" : ""}${selected ? " is-highlighted" : ""}`}>
    <header className="ij-card-heading"><div><span className="ij-eyebrow">{r.category || "VOTRE INTERVENTION"}</span><h2>{r.title}</h2></div><Link className="ij-chat-link" href={`/dashboard/messagerie?demande=${r.conversationId ?? r.id}`}><MessageSquare size={16}/><span>Conversation</span><ArrowUpRight size={13}/></Link></header>
    <div className="ij-card-facts"><div className="cx-intervention-professional ij-professional"><span className="cx-intervention-avatar"><span>{name.slice(0, 1).toUpperCase()}</span>{r.professional.profilePhotoMime && <img src={`/api/client/professionnels/${r.professionalId}/photo`} alt={`Photo de ${name}`} loading="lazy" onError={(e) => { e.currentTarget.hidden = true; }}/>}</span><div><small>VOTRE PROFESSIONNEL</small><strong>{name}</strong><small>{r.professional.specialty || "Professionnel HomeFix"}</small></div></div>
      <div className="ij-fact"><span className="ij-fact-icon"><CalendarDays size={18}/></span><div><small>{scheduled ? "RENDEZ-VOUS" : booking ? "ANCIEN CRÉNEAU" : "RENDEZ-VOUS"}</small><strong>{day || "À convenir"}</strong>{booking && <span><Clock3 size={11}/>{tunisTime(booking.startsAt)} – {tunisTime(booking.endsAt)}</span>}</div></div>
      <div className="cx-confirmed-price ij-price"><div><small>{price ? "PRIX CONFIRMÉ" : proposed ? "PRIX PROPOSÉ" : "PRIX"}</small><strong>{price ? money(price.amountMillimes) : proposed ? money(proposed.amountMillimes) : "À convenir"}</strong></div>{price && <span className="ij-price-check"><Check size={16}/></span>}</div>
    </div>
    <InterventionJourney request={r} professionalName={name}/>
    <footer className="ij-card-footer"><details className="ij-details" open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}><summary>Voir les détails<ChevronDown size={15}/></summary><div className="ij-details-content">
      {r.address && <p className="ij-address"><MapPin size={15}/>{r.address}</p>}
      {r.message && <p>{r.message}</p>}
      {photo && <img className="cx-intervention-photo" src={`/api/client/fichiers/${photo.id}`} alt={`Photo du problème : ${r.title}`} loading="lazy"/>}
      {r.attachments.length > 0 && <div className="cx-attachments">{r.attachments.map((file) => <a href={`/api/client/fichiers/${file.id}`} key={file.id}><Paperclip size={13}/>{file.name}</a>)}</div>}
      <h3>Historique complet</h3><ol className="ij-history">{r.events.length ? r.events.map((event) => <li key={event.id}><span/><div><strong>{event.description.replace(/^Intervention\s*#\d+\s*[·?]\s*/, "")}</strong><time dateTime={event.createdAt}>{dateLabel(event.createdAt)}</time></div></li>) : <li><span/><div><strong>Demande envoyée</strong><time dateTime={r.createdAt}>{dateLabel(r.createdAt)}</time></div></li>}</ol>
      {r.clientConfirmedAt && <p>Fin validée le {dateLabel(r.clientConfirmedAt)}</p>}
      <Link className="cx-text-btn" href={`/dashboard/reclamations?demande=${r.id}`}>Signaler un problème<ArrowUpRight size={13}/></Link>
    </div></details>
      {r.status === "COMPLETED" ? <FinishIntervention requestId={r.id} confirmed={Boolean(r.clientConfirmedAt)} paid={price?.invoice?.status === "PAID"} testPaid={price?.invoice?.testPaid}/> : <span className="ij-updated">{progress.stopped ? "Parcours clôturé" : "Suivi synchronisé"}<span/></span>}
    </footer>
  </article>;
}
