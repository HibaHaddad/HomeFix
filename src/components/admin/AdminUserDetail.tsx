import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft, BriefcaseBusiness, CalendarClock, ClipboardList,
  MapPin, MessageSquareWarning, Shield, Star, UserRound,
} from "lucide-react";
import type { getAdminUserDetail } from "@/app/lib/admin-users";
import UserSuspensionActions from "@/components/admin/UserSuspensionActions";
import AdminUserEditor from "@/components/admin/AdminUserEditor";

type Detail = NonNullable<Awaited<ReturnType<typeof getAdminUserDetail>>>;
const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Africa/Tunis" });
const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Tunis" });
const roleLabel: Record<string, string> = { CLIENT: "Client", PROFESSIONAL: "Prestataire", ADMIN: "Administrateur" };
const statusLabel: Record<string, string> = {
  ACTIVE: "Actif", PENDING_VERIFICATION: "En attente de vérification", APPROVED: "Approuvé", REJECTED: "Refusé",
  SENT: "Envoyée", QUOTED: "Devis reçu", PRICE_ACCEPTED: "Prix accepté", BOOKED: "Confirmée", EN_ROUTE: "En route",
  IN_PROGRESS: "En cours", COMPLETED: "Terminée", CANCELLED: "Annulée", OPEN: "Ouverte", RESOLVED: "Résolue",
  PROPOSED: "Proposée", CONFIRMED: "Confirmée", ACCEPTED: "Acceptée", COUNTER_PROPOSED: "Contre-proposition",
};

function status(value: string) {
  return statusLabel[value] ?? value.replaceAll("_", " ").toLocaleLowerCase("fr-FR");
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return <div className="admin-user-info-item"><dt>{label}</dt><dd>{value || "Non renseigné"}</dd></div>;
}

export default function AdminUserDetail({ detail, currentAdminId }: { detail: Detail; currentAdminId: number }) {
  const { user, history } = detail;
  const displayName = user.businessName || user.name;
  const canManage = user.role !== "ADMIN" && user.id !== currentAdminId;
  const avatar = user.profilePhotoMime
    ? <Image src={`/api/admin/users/${user.id}/avatar`} alt="" width={76} height={76} unoptimized/>
    : <span>{user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")}</span>;

  return <div className="admin-content admin-user-detail-page">
    <Link className="admin-user-back" href="/admin/utilisateurs"><ArrowLeft size={15}/>Retour aux utilisateurs</Link>
    <section className="admin-card admin-user-hero">
      <div className="admin-user-hero-main">
        <div className="admin-user-hero-avatar">{avatar}</div>
        <div className="admin-user-hero-copy"><span className="admin-section-kicker">FICHE UTILISATEUR</span><h1>{displayName}</h1><p>{user.email}</p><div className="admin-user-hero-badges"><span className={`admin-role-badge role-${user.role.toLowerCase()}`}>{roleLabel[user.role] ?? user.role}</span><span className={`admin-account-badge ${user.isSuspended ? "is-suspended" : "is-active"}`}><i/>{user.isSuspended ? "Compte suspendu" : "Compte actif"}</span>{user.role === "PROFESSIONAL" && <span className="admin-verification-badge">{status(user.status)}</span>}</div></div>
      </div>
      {canManage && <UserSuspensionActions userId={user.id} isSuspended={user.isSuspended} reason={user.suspensionReason} updatedAt={user.suspensionUpdatedAt?.toISOString() ?? null}/>}
    </section>

    {user.isSuspended && <section className="admin-suspension-notice"><Shield size={17}/><div><strong>Compte suspendu</strong><p>{user.suspensionReason || "Aucun motif conservé."}</p>{user.suspensionUpdatedAt && <small>Dernière décision : {dateTimeFormat.format(user.suspensionUpdatedAt)}</small>}</div></section>}
    {!user.isSuspended && user.suspensionReason && user.suspensionUpdatedAt && <p className="admin-last-decision">Dernière décision de suspension : {dateTimeFormat.format(user.suspensionUpdatedAt)} · Motif : {user.suspensionReason}</p>}

    <div className="admin-user-detail-grid">
      <section className="admin-card admin-user-info-card">
        <div className="admin-user-section-heading"><span className="admin-user-section-icon"><UserRound size={17}/></span><div><h2>Informations générales</h2><p>Coordonnées et statut du compte</p></div></div>
        <dl className="admin-user-info-grid"><Info label="Nom complet" value={user.name}/><Info label="Email" value={user.email}/><Info label="Téléphone" value={user.phone}/><Info label="Adresse" value={user.address}/><Info label="Ville" value={user.city}/><Info label="Rôle" value={roleLabel[user.role] ?? user.role}/><Info label="Statut du compte" value={user.isSuspended ? "Suspendu" : "Actif"}/><Info label="Inscription" value={dateFormat.format(user.createdAt)}/></dl>
        {user.role !== "ADMIN" && <AdminUserEditor key={user.id} user={{ id: user.id, role: user.role, name: user.name, email: user.email, phone: user.phone, address: user.address, city: user.city, businessName: user.businessName, specialty: user.specialty, description: user.description, experience: user.experience, serviceCity: user.serviceCity, coveredAreas: user.coveredAreas, priceRange: user.priceRange }}/>}
      </section>

      {user.role === "PROFESSIONAL" && <section className="admin-card admin-user-info-card">
        <div className="admin-user-section-heading"><span className="admin-user-section-icon"><BriefcaseBusiness size={17}/></span><div><h2>Profil professionnel</h2><p>Informations et vérification du prestataire</p></div></div>
        <dl className="admin-user-info-grid"><Info label="Entreprise" value={user.businessName}/><Info label="Spécialité" value={user.specialty}/><Info label="Expérience" value={user.experience}/><Info label="Zone d’intervention" value={[user.serviceCity, user.coveredAreas].filter(Boolean).join(" · ")}/><Info label="Fourchette tarifaire" value={user.priceRange}/><Info label="Statut de vérification" value={status(user.status)}/><Info label="Décision de vérification" value={user.verifiedAt ? dateTimeFormat.format(user.verifiedAt) : null}/><Info label="Note moyenne" value={history.averageRating === null ? "Aucun avis noté" : `${history.averageRating.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} / 5 (${history.reviewCount} avis)`}/><div className="admin-user-info-item admin-user-description"><dt>Description</dt><dd>{user.description || "Non renseignée"}</dd></div></dl>
      </section>}
    </div>

    <section className="admin-user-summary-grid" aria-label="Résumé de l’activité">
      <Summary icon={<ClipboardList size={17}/>} label="Demandes d’intervention" value={history.requestCount}/>
      <Summary icon={<CalendarClock size={17}/>} label="Réservations" value={history.bookingCount}/>
      <Summary icon={<Star size={17}/>} label={user.role === "CLIENT" ? "Avis publiés" : "Avis reçus"} value={history.reviewCount}/>
      <Summary icon={<MessageSquareWarning size={17}/>} label="Réclamations associées" value={history.complaintCount}/>
    </section>

    <section className="admin-user-history-grid">
      <HistoryCard title="Demandes récentes" icon={<ClipboardList size={17}/>} empty="Aucune demande associée.">
        {history.requests.map((item) => <div className="admin-history-row" key={item.id}><div><strong>{item.title}</strong><small>{item.category} · {dateTimeFormat.format(item.createdAt)}</small></div><span className="admin-mini-badge">{status(item.status)}</span></div>)}
      </HistoryCard>
      <HistoryCard title="Réservations récentes" icon={<CalendarClock size={17}/>} empty="Aucune réservation associée.">
        {history.bookings.map((item) => <div className="admin-history-row" key={item.id}><div><strong>{item.request.title}</strong><small>{dateTimeFormat.format(item.startsAt)} – {dateTimeFormat.format(item.endsAt)}</small></div><span className="admin-mini-badge">{status(item.status)}</span></div>)}
      </HistoryCard>
      <HistoryCard title={user.role === "CLIENT" ? "Avis publiés" : "Avis reçus"} icon={<Star size={17}/>} empty="Aucun avis associé.">
        {history.reviews.map((review) => <div className="admin-history-row admin-review-history" key={review.id}><div><strong>{review.rating === null ? "Commentaire" : `${review.rating} / 5`} · {user.role === "CLIENT" ? review.professional.businessName || review.professional.name : review.client.name}</strong><small>{dateTimeFormat.format(review.createdAt)}{review.published ? " · Publié" : " · Non publié"}</small><p>{review.comment}</p></div></div>)}
      </HistoryCard>
      <HistoryCard title="Réclamations associées" icon={<MapPin size={17}/>} empty="Aucune réclamation associée.">
        {history.complaints.map((complaint) => <div className="admin-history-row" key={complaint.id}><div><strong>{complaint.subject}</strong><small>{dateTimeFormat.format(complaint.createdAt)}</small></div><span className="admin-mini-badge">{status(complaint.status)}</span></div>)}
      </HistoryCard>
    </section>
  </div>;
}

function Summary({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <article className="admin-user-summary-card"><span>{icon}</span><strong>{new Intl.NumberFormat("fr-FR").format(value)}</strong><small>{label}</small></article>;
}

function HistoryCard({ title, icon, empty, children }: { title: string; icon: React.ReactNode; empty: string; children: React.ReactNode }) {
  const content = children as React.ReactNode[];
  const hasItems = Array.isArray(content) ? content.length > 0 : Boolean(content);
  return <section className="admin-card admin-history-card"><div className="admin-user-section-heading"><span className="admin-user-section-icon">{icon}</span><div><h2>{title}</h2></div></div>{hasItems ? <div className="admin-history-list">{children}</div> : <p className="admin-history-empty">{empty}</p>}</section>;
}
