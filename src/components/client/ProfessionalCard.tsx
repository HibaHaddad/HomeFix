"use client";

import Link from "next/link";
import Icon from "@/components/professional/ProfessionalIcon";
import type { DirectoryProfessional } from "@/app/lib/professional-directory";
import { availabilityLabels } from "@/lib/directory-filters";

export function ProfessionalAvatar({ id, name, hasPhoto }: { id: number; name: string; hasPhoto: boolean }) {
  return <span className="directory-avatar">{hasPhoto ? <img src={`/api/client/professionnels/${id}/photo`} alt={`Photo de ${name}`} loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }}/>: null}<span>{name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</span></span>;
}
export function priceLabel(p: Pick<DirectoryProfessional, "priceMin" | "priceMax" | "priceRange">) {
  if (p.priceMin !== null) return p.priceMax !== null && p.priceMax !== p.priceMin ? `${p.priceMin}–${p.priceMax} TND` : `Dès ${p.priceMin} TND`;
  return p.priceRange || "Sur devis";
}
export default function ProfessionalCard({ professional: p, returnTo }: { professional: DirectoryProfessional; returnTo: string }) {
  const href = `/dashboard/professionnels/${p.id}?retour=${encodeURIComponent(returnTo)}`;
  return <article className="directory-card">
    <div className="directory-card-top"><ProfessionalAvatar id={p.id} name={p.name} hasPhoto={p.hasPhoto}/><span className={`availability-dot ${p.availability === "AVAILABLE" ? "available" : ""}`}>{p.availability ? availabilityLabels[p.availability] : "Disponibilité à confirmer"}</span></div>
    <div className="directory-card-name"><h2><Link href={href}>{p.businessName || p.name}</Link></h2>{p.verified && <span className="verified-icon" title="Profil vérifié par HomeFix" aria-label="Profil vérifié"><Icon name="shield" size={17}/></span>}</div>
    {p.businessName && <p className="directory-person-name">{p.name}</p>}
    <span className="directory-specialty">{p.specialty || "Services à domicile"}</span>
    <p className="directory-description">{p.description || "Découvrez ce professionnel et échangez avec lui sur votre projet."}</p>
    <div className="directory-meta"><span><Icon name="home" size={14}/>{p.serviceCity || "Zone non renseignée"}</span><span><Icon name="wrench" size={14}/>{p.experienceYears !== null ? `${p.experienceYears} an${p.experienceYears > 1 ? "s" : ""} d’expérience` : p.experience || "Expérience non renseignée"}</span></div>
    <div className="directory-card-rating"><span><Icon name="star" size={15}/>{p.rating !== null ? <><strong>{p.rating.toFixed(1)}</strong><small>({p.reviewCount} avis)</small></> : <small>Pas encore d’avis</small>}</span>{p.verified && <small className="verified-text">Profil vérifié</small>}</div>
    <div className="directory-card-price"><span>Tarif indicatif<strong>{priceLabel(p)}</strong></span><Link className="directory-profile-link" href={href}>Voir le profil <Icon name="arrow" size={15}/></Link></div>
    <div className="directory-card-actions"><Link href={`${href}&action=message#contact`}><Icon name="message" size={15}/>Contacter</Link><Link className="directory-primary" href={`${href}&action=devis#contact`}>Demander un devis <Icon name="arrow" size={14}/></Link></div>
  </article>;
}
