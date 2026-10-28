"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, ClipboardList, MessageSquare, FileText, CalendarDays, Wrench, CreditCard, Star, House, Heart, Sparkles, Bell, UserRound, LifeBuoy, Search, Menu, X, ArrowUpRight } from "lucide-react";
const groups = [
  { label: "MON ESPACE", items: [["", "Tableau de bord", LayoutDashboard], ["demandes", "Mes demandes", ClipboardList], ["messagerie", "Messagerie", MessageSquare], ["devis", "Mes devis", FileText], ["reservations", "Réservations", CalendarDays], ["interventions", "Interventions", Wrench]] },
  { label: "MON QUOTIDIEN", items: [["paiements", "Paiements & factures", CreditCard], ["avis", "Mes avis", Star], ["logement", "Mon logement", House], ["favoris", "Mes favoris", Heart], ["assistant", "Assistant IA", Sparkles]] },
  { label: "MON COMPTE", items: [["notifications", "Notifications", Bell], ["profil", "Mon profil", UserRound], ["reclamations", "Aide & réclamations", LifeBuoy]] },
] as const;
export default function ClientNavigation() {
  const path = usePathname(); const [open, setOpen] = useState(false);
  return <><button className="cx-menu-toggle" aria-label={open ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={open} aria-controls="client-sidebar" onClick={() => setOpen(!open)}>{open ? <X size={20}/> : <Menu size={20}/>}</button>{open && <button className="cx-overlay" aria-label="Fermer le menu" onClick={() => setOpen(false)}/>}
    <aside className={`cx-sidebar ${open ? "is-open" : ""}`} id="client-sidebar"><Link href="/" className="cx-logo"><span><House size={23}/></span>homefix<small>TN</small></Link><span className="cx-space-label">VOTRE MAISON, SIMPLEMENT.</span>
      <Link onClick={() => setOpen(false)} href="/dashboard/professionnels" className={`cx-find ${path.includes("/professionnels") ? "is-active" : ""}`}><Search size={17}/>Trouver un professionnel<ArrowUpRight size={14}/></Link>
      <nav aria-label="Navigation client">{groups.map((g) => <div className="cx-nav-group" key={g.label}><p>{g.label}</p>{g.items.map(([slug, label, Icon]) => { const href = `/dashboard${slug ? `/${slug}` : ""}`; return <Link onClick={() => setOpen(false)} href={href} key={href} aria-current={path === href ? "page" : undefined} className={path === href ? "is-active" : ""}><Icon size={17}/><span>{label}</span>{slug === "assistant" && <small>IA</small>}</Link>; })}</div>)}</nav>
      <div className="cx-sidebar-note"><span><House size={18}/></span><strong>Un chez-vous bien entouré.</strong><p>Vos projets, vos pros, votre tranquillité.</p><Link href="/dashboard/demandes">Parlons de votre projet <ArrowUpRight size={13}/></Link></div>
    </aside></>;
}
