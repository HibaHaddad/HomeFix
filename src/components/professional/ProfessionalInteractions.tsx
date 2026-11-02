"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, ClipboardList, MessageSquare } from "lucide-react";
import ClientChat from "@/components/client/ClientChat";
import ConversationInterventions, { type Intervention } from "@/components/client/ConversationInterventions";
import ProfessionalCalendar from "./ProfessionalCalendar";
type ProfessionalRequest = Intervention & { client: { id: number; name: string; phone: string | null; email: string } };
type Slot = { id: number; startsAt: string; endsAt: string; active: boolean };
const titles: Record<string, string> = { "tableau-de-bord": "Votre activité, en un coup d’œil", demandes: "Demandes d’intervention", reservations: "Agenda & disponibilités", interventions: "Suivi des interventions", messagerie: "Messagerie", notifications: "Notifications" };
export default function ProfessionalInteractions({ section, initialRequests, selected }: { section: string; initialRequests: ProfessionalRequest[]; initialSlots: Slot[]; selected?: number }) {
  const [records, setRecords] = useState(initialRequests); const [error, setError] = useState("");
  useEffect(() => { setRecords(initialRequests); }, [initialRequests]);
  useEffect(() => {
    if (["messagerie", "reservations"].includes(section)) return;
    const timer = setInterval(async () => { if (document.visibilityState !== "visible") return; try { const response = await fetch(`/api/interactions?demande=${selected || ""}`, { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setRecords(data.requests); setError(""); } catch { setError("L’actualisation est interrompue. Vos modifications restent enregistrées."); } }, 5000);
    return () => clearInterval(timer);
  }, [selected, section]);
  const requests = records.filter((r) => r.kind !== "MESSAGE");
  const pending = requests.filter((r) => r.booking?.status === "PROPOSED");
  const bookings = requests.filter((r) => r.booking);
  return <><div className="pro-page-heading"><div><div className="pro-eyebrow"><span/>VOTRE ACTIVITÉ</div><h1>{titles[section]}</h1><p>{section === "reservations" ? "Publiez vos créneaux et retrouvez les rendez-vous de vos clients." : "Demandes, devis et rendez-vous synchronisés avec vos conversations."}</p></div></div><div className="cx-app cx-professional-content">{error && <p className="cx-feedback is-error" role="alert">{error}</p>}
    {section === "messagerie" ? <ClientChat requests={records} selected={selected} professional/> : section === "reservations" ? <>
      <ProfessionalCalendar/>
    </> : section === "tableau-de-bord" ? <><div className="cx-stats">{[["Demandes à traiter", pending.length, ClipboardList, "demandes"], ["Rendez-vous confirmés", bookings.filter((r) => r.booking!.status === "CONFIRMED" && +new Date(r.booking!.startsAt) > Date.now()).length, CalendarDays, "reservations"], ["Conversations", records.filter((r) => r.kind === "MESSAGE").length, MessageSquare, "messagerie"]].map(([label, count, Icon, path]) => { const Glyph = Icon as typeof ClipboardList; return <Link key={String(path)} className="cx-stat" href={`/professionnel/${path}`}><div><span className="cx-icon-tile"><Glyph size={18}/></span></div><strong>{String(count)}</strong><h2>{String(label)}</h2></Link>; })}</div><section className="cx-panel"><h2>Les demandes à traiter</h2><ConversationInterventions requests={pending} professional/>{!pending.length && <p className="flow-note">Vous êtes à jour. Les nouvelles demandes apparaîtront ici.</p>}</section></> : <><div className="cx-stack">{(section === "interventions" ? requests.filter((r) => ["BOOKED", "EN_ROUTE", "IN_PROGRESS", "COMPLETED"].includes(r.status)) : requests).map((r) => <section className="cx-panel" id={`intervention-${r.id}`} key={r.id}><div className="cx-panel-title"><h2>{r.client.name}</h2><Link className="cx-text-btn" href={`/professionnel/messagerie?demande=${r.conversationId ?? r.id}`}>Ouvrir la conversation ↗</Link></div><ConversationInterventions requests={[r]} professional/></section>)}</div>{!requests.length && <section className="cx-empty"><ClipboardList size={30}/><h2>Aucune demande pour le moment.</h2><p>Les demandes créées depuis votre profil ou votre messagerie apparaîtront ici.</p></section>}</>}
    <p className="cx-footnote">{section === "reservations" ? "Horaires et rendez-vous synchronisés avec votre agenda. Heure locale de Tunis." : section === "messagerie" ? "Messages synchronisés en temps réel. Historique privé conservé." : "Les 100 derniers échanges et demandes sont affichés. Actualisation toutes les 5 secondes."}</p>
  </div></>;
}
