"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ProfessionalIcon from "@/components/professional/ProfessionalIcon";

const navigation = [
  ["tableau-de-bord", "Tableau de bord", "home"], ["demandes", "Demandes de service", "inbox"],
  ["reservations", "Réservations", "calendar"],
  ["interventions", "Interventions", "wrench"], ["messagerie", "Messagerie", "message"],
  ["profil", "Profil professionnel", "user"],
  ["revenus", "Revenus", "wallet"], ["avis", "Avis clients", "star"],
  ["notifications", "Notifications", "bell"], ["parametres", "Paramètres", "settings"],
] as const;

export default function ProfessionalNavigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const links = mobile ? navigation.filter(([slug]) => ["tableau-de-bord", "demandes", "reservations", "profil"].includes(slug)) : navigation;
  return <>{!mobile && <span className="pro-nav-caption">VOTRE ACTIVITÉ</span>}{links.map(([slug, label, icon], index) => <span className={mobile ? "pro-mobile-nav-item" : "pro-nav-item"} key={slug}>{!mobile && index === 5 && <span className="pro-nav-caption pro-nav-caption-spaced">GESTION DU COMPTE</span>}<Link href={`/professionnel/${slug}`} className={`${mobile ? "pro-mobile-link" : "pro-nav-link"}${pathname === `/professionnel/${slug}` ? " is-active" : ""}`} aria-label={label} title={label} aria-current={pathname === `/professionnel/${slug}` ? "page" : undefined}><span className={mobile ? "pro-mobile-icon" : "pro-nav-icon"}><ProfessionalIcon name={icon} size={17}/></span>{mobile ? label === "Tableau de bord" ? "Accueil" : label === "Réservations" ? "Agenda" : label === "Profil professionnel" ? "Profil" : "Demandes" : label}</Link></span>)}</>;
}
