"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, LoaderCircle } from "lucide-react";
import Icon from "@/components/professional/ProfessionalIcon";
import type { DirectoryProfessional } from "@/app/lib/professional-directory";
import { availabilityLabels } from "@/lib/directory-filters";
import ContactButton from "./ContactButton";
import { workspaceAction } from "./WorkspaceForm";

export function ProfessionalAvatar({ id, name, hasPhoto }: { id: number; name: string; hasPhoto: boolean }) {
  return <span className="directory-avatar">{hasPhoto ? <img src={`/api/client/professionnels/${id}/photo`} alt={`Photo de ${name}`} loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }}/>: null}<span>{name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</span></span>;
}
export function priceLabel(p: Pick<DirectoryProfessional, "priceMin" | "priceMax" | "priceRange">) {
  if (p.priceMin !== null) return p.priceMax !== null && p.priceMax !== p.priceMin ? `${p.priceMin}–${p.priceMax} TND` : `Dès ${p.priceMin} TND`;
  return p.priceRange || "Sur devis";
}
export default function ProfessionalCard({ professional: p, returnTo, favorite = false, onFavoriteChange }: { professional: DirectoryProfessional; returnTo: string; favorite?: boolean; onFavoriteChange?: (favorite: boolean) => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function toggleFavorite() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await workspaceAction(favorite ? "favorite.remove" : "favorite.add", { professionalId: p.id });
      onFavoriteChange?.(!favorite);
      router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Impossible de modifier les favoris."); }
    finally { setBusy(false); }
  }
  const href = `/dashboard/professionnels/${p.id}?retour=${encodeURIComponent(returnTo)}`;
  return <article className="directory-card">
    <div className="directory-card-top"><ProfessionalAvatar id={p.id} name={p.name} hasPhoto={p.hasPhoto}/><span className={`availability-dot ${p.availability === "AVAILABLE" ? "available" : ""}`}>{p.availability ? availabilityLabels[p.availability] : "Disponibilité à confirmer"}</span></div>
    <div className="directory-card-name"><h2><Link href={href}>{p.businessName || p.name}</Link></h2>{p.verified && <span className="verified-icon" title="Profil vérifié par HomeFix" aria-label="Profil vérifié"><Icon name="shield" size={17}/></span>}<button type="button" className={`directory-favorite${favorite ? " is-favorite" : ""}`} disabled={busy} aria-pressed={favorite} aria-label={`${favorite ? "Retirer" : "Ajouter"} ${p.businessName || p.name} ${favorite ? "des" : "aux"} favoris`} title={favorite ? "Retirer des favoris" : "Ajouter aux favoris"} onClick={() => void toggleFavorite()}>{busy ? <LoaderCircle size={18} className="cx-spin"/> : <Heart size={18} fill={favorite ? "currentColor" : "none"}/>}</button></div>
    {error && <p className="client-feedback error" role="alert">{error}</p>}
    {p.businessName && <p className="directory-person-name">{p.name}</p>}
    <span className="directory-specialty">{p.specialty || "Services à domicile"}</span>
    <p className="directory-description">{p.description || "Découvrez ce professionnel et échangez avec lui sur votre projet."}</p>
    <div className="directory-meta"><span><Icon name="home" size={14}/>{p.serviceCity || "Zone non renseignée"}</span><span><Icon name="wrench" size={14}/>{p.experienceYears !== null ? `${p.experienceYears} an${p.experienceYears > 1 ? "s" : ""} d’expérience` : p.experience || "Expérience non renseignée"}</span></div>
    <div className="directory-card-rating"><span><Icon name="star" size={15}/>{p.rating !== null ? <><strong>{p.rating.toFixed(1)}</strong><small>({p.reviewCount} avis)</small></> : <small>{p.reviewCount ? `${p.reviewCount} avis écrit${p.reviewCount > 1 ? "s" : ""}` : "Pas encore d’avis"}</small>}</span>{p.verified && <small className="verified-text">Profil vérifié</small>}</div>
    <div className="directory-card-price"><span>Tarif indicatif<strong>{priceLabel(p)}</strong></span><Link className="directory-profile-link" href={href}>Voir le profil <Icon name="arrow" size={15}/></Link></div>
    <div className="directory-card-actions"><ContactButton professionalId={p.id}/><Link className="directory-primary" href={`${href}&action=devis#contact`}>Demander une intervention <Icon name="arrow" size={14}/></Link></div>
  </article>;
}
