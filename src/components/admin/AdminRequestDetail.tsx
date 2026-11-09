import Link from "next/link";
import { ArrowLeft, CalendarClock, ClipboardList, MapPin, Package, Quote as QuoteIcon, UserRound } from "lucide-react";
import type { getAdminRequestDetail } from "@/app/lib/admin-requests";

type RequestDetail = NonNullable<Awaited<ReturnType<typeof getAdminRequestDetail>>>;
const statusLabels: Record<string, string> = {
  SENT: "Envoyée", QUOTED: "Devis reçu", PRICE_ACCEPTED: "Prix accepté", BOOKED: "Confirmée",
  EN_ROUTE: "En route", IN_PROGRESS: "En cours", COMPLETED: "Terminée", CANCELLED: "Annulée",
  REJECTED: "Refusée", CONVERSATION: "Conversation libre", PROPOSED: "À confirmer",
  COUNTER_PROPOSED: "Contre-proposition", ACCEPTED: "Accepté", CONFIRMED: "Confirmé",
  PENDING: "En attente", NEGOTIATING: "En négociation", SUPERSEDED: "Remplacé",
};
const urgencyLabels: Record<string, string> = { NORMAL: "Normale", SOON: "Sous 48 h", URGENT: "Urgente" };
const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Africa/Tunis" });
const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Tunis" });
const currencyFormat = new Intl.NumberFormat("fr-TN", { style: "currency", currency: "TND", minimumFractionDigits: 3, maximumFractionDigits: 3 });

function label(value: string) {
  return statusLabels[value] ?? value.replaceAll("_", " ");
}

function Info({ title, value }: { title: string; value: string | number | null | undefined }) {
  return <div className="admin-request-info"><dt>{title}</dt><dd>{value === null || value === undefined || value === "" ? "Non renseigné" : value}</dd></div>;
}

export default function AdminRequestDetail({ request }: { request: RequestDetail }) {
  const isMessage = request.kind === "MESSAGE";
  const kindLabel = isMessage ? "Message / conversation" : request.kind === "INTERVENTION" ? "Intervention" : request.kind;
  const events = [...request.events].reverse();

  return <div className="admin-content admin-request-detail-page">
    <Link href="/admin/demandes" className="admin-back-link"><ArrowLeft size={14}/>Retour aux demandes</Link>

    <div className="admin-page-heading admin-request-detail-heading"><div><div className="admin-eyebrow"><span/>SUPERVISION · #{request.id}</div><h1>{request.title}</h1><p>{request.category} · Créée le {dateFormat.format(request.createdAt)}</p></div><div className="admin-request-badges"><span className={`admin-request-kind ${isMessage ? "is-message" : "is-service"}`}>{kindLabel}</span><span className={`admin-status status-${request.status.toLowerCase()}`}><i/>{label(request.status)}</span>{request.urgency === "URGENT" && <span className="admin-request-urgency urgency-urgent">Urgente</span>}</div></div>

    <section className="admin-request-detail-grid">
      <article className="admin-card admin-request-detail-card admin-request-overview">
        <header className="admin-request-section-title"><span><ClipboardList size={17}/></span><div><h2>Informations de la demande</h2><p>Contenu transmis et statut courant</p></div></header>
        <dl className="admin-request-info-grid">
          <Info title="Type" value={kindLabel}/><Info title="Catégorie" value={request.category}/>
          <Info title="Urgence" value={urgencyLabels[request.urgency] ?? request.urgency}/><Info title="Statut actuel" value={label(request.status)}/>
          <Info title="Adresse d’intervention" value={request.address}/><Info title="Dates souhaitées" value={request.preferredDates}/>
          <Info title="Création" value={dateTimeFormat.format(request.createdAt)}/><Info title="Dernière modification" value={dateTimeFormat.format(request.updatedAt)}/>
          {request.clientConfirmedAt && <Info title="Fin confirmée par le client" value={dateTimeFormat.format(request.clientConfirmedAt)}/>}
        </dl>
        <div className="admin-request-description"><h3>{isMessage ? "Message initial" : "Description"}</h3><p>{request.message || "Aucun texte renseigné."}</p></div>
      </article>

      <article className="admin-card admin-request-detail-card">
        <header className="admin-request-section-title"><span><UserRound size={17}/></span><div><h2>Personnes associées</h2><p>Coordonnées disponibles dans le dossier</p></div></header>
        <div className="admin-request-party"><strong>Client</strong><dl><Info title="Nom" value={request.client.name}/><Info title="E-mail" value={request.client.email}/><Info title="Téléphone" value={request.client.phone}/></dl></div>
        <div className="admin-request-party"><strong>Professionnel</strong><dl><Info title="Nom" value={request.professional.businessName || request.professional.name}/><Info title="Contact" value={request.professional.name}/><Info title="E-mail" value={request.professional.email}/><Info title="Téléphone" value={request.professional.phone}/></dl></div>
      </article>

      {request.equipment && <article className="admin-card admin-request-detail-card">
        <header className="admin-request-section-title"><span><Package size={17}/></span><div><h2>Équipement associé</h2><p>Équipement du client relié à la demande</p></div></header>
        <dl className="admin-request-info-grid"><Info title="Nom" value={request.equipment.name}/><Info title="Catégorie" value={request.equipment.category}/><Info title="Marque" value={request.equipment.brand}/><Info title="Notes" value={request.equipment.notes}/></dl>
      </article>}

      {request.booking && <article className="admin-card admin-request-detail-card">
        <header className="admin-request-section-title"><span><CalendarClock size={17}/></span><div><h2>Réservation associée</h2><p>Informations enregistrées pour le créneau</p></div></header>
        <dl className="admin-request-info-grid"><Info title="Statut" value={label(request.booking.status)}/><Info title="Début" value={dateTimeFormat.format(request.booking.startsAt)}/><Info title="Fin" value={dateTimeFormat.format(request.booking.endsAt)}/><Info title="Créneau retenu" value={request.booking.holdsSlot ? "Oui" : "Non"}/><Info title="Motif" value={request.booking.reason}/></dl>
      </article>}

      {request.quotes.length > 0 && <article className="admin-card admin-request-detail-card admin-request-quotes">
        <header className="admin-request-section-title"><span><QuoteIcon size={17}/></span><div><h2>Devis associés</h2><p>{request.quotes.length} devis enregistré{request.quotes.length !== 1 ? "s" : ""}</p></div></header>
        <div className="admin-request-quote-list">{request.quotes.map((quote) => <section className="admin-request-quote" key={quote.id}><div><strong>{currencyFormat.format(quote.amountMillimes / 1000)}</strong><span className={`admin-status status-${quote.status.toLowerCase()}`}><i/>{label(quote.status)}</span></div><p>{quote.details}</p>{quote.counterAmountMillimes !== null && <small>Contre-proposition : {currencyFormat.format(quote.counterAmountMillimes / 1000)}</small>}<small>Valide jusqu’au {dateTimeFormat.format(quote.validUntil)} · Créé le {dateTimeFormat.format(quote.createdAt)}</small></section>)}</div>
      </article>}
    </section>

    <section className="admin-card admin-request-timeline-card">
      <header className="admin-request-section-title"><span><MapPin size={17}/></span><div><h2>Historique enregistré</h2><p>Événements présents dans RequestEvent</p></div></header>
      {events.length === 0 ? <p className="admin-request-no-events">Aucun événement historique n’est enregistré pour cette demande.</p> : <ol className="admin-request-timeline">{events.map((event) => <li key={event.id}><span className="admin-request-timeline-dot"/><article><div className="admin-request-event-head"><strong>{label(event.status)}</strong><time dateTime={event.createdAt.toISOString()}>{dateTimeFormat.format(event.createdAt)}</time></div><p>{event.description}</p><small>{event.actor ? `${event.actor.name} · ${event.actor.role}` : "Auteur indisponible"}</small></article></li>)}</ol>}
    </section>
    <p className="admin-request-readonly-note">Cette fiche est en consultation seule. Les statuts, devis et réservations restent gérés dans les parcours client et professionnel.</p>
  </div>;
}
