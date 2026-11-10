import Link from "next/link";
import { ArrowUpRight, House, ShieldCheck, Wrench, UsersRound } from "lucide-react";

export default function AdminOverviewHero({ pending, complaints, reports }: { pending: number; complaints: number; reports: number }) {
  return <section className="admin-overview-hero" aria-labelledby="admin-overview-title">
    <div className="admin-overview-copy">
      <span className="admin-hero-eyebrow"><span/>L’ESPACE QUI RELIE TOUT</span>
      <h1 id="admin-overview-title">HomeFix,<br/><em>en un regard.</em></h1>
      <p>Des professionnels de confiance, des clients accompagnés.<br/> Gardez une longueur d’avance sur les détails qui comptent.</p>
      <div className="admin-hero-links">
        <Link href="/admin/professionnels?status=PENDING_VERIFICATION">Examiner les dossiers<ArrowUpRight size={17}/></Link>
        <Link href="/admin/activites">Journal d’activité<ArrowUpRight size={15}/></Link>
      </div>
    </div>
    <div className="admin-hero-art" aria-hidden="true">
      <div className="admin-hero-orbit orbit-outer"/><div className="admin-hero-orbit orbit-inner"/>
      <div className="admin-hero-house"><House size={64} strokeWidth={1.15}/><span>HomeFix<span>TN</span></span></div>
      <span className="admin-hero-stamp stamp-tools"><Wrench size={24} strokeWidth={1.5}/></span>
      <span className="admin-hero-stamp stamp-trust"><ShieldCheck size={28} strokeWidth={1.5}/></span>
      <span className="admin-hero-stamp stamp-people"><UsersRound size={20} strokeWidth={1.5}/></span>
      <div className="admin-hero-art-caption"><ShieldCheck size={16}/><span>La confiance, au cœur de chaque service.</span></div>
    </div>
    <nav className="admin-hero-priorities" aria-label="Vos priorités">
      <span className="admin-priorities-label">À votre attention</span>
      <Link href="/admin/professionnels?status=PENDING_VERIFICATION"><strong>{pending}</strong><span>dossier{pending > 1 ? "s" : ""} à valider</span><ArrowUpRight size={14}/></Link>
      <Link href="/admin/reclamations"><strong>{complaints}</strong><span>réclamation{complaints > 1 ? "s" : ""} à traiter</span><ArrowUpRight size={14}/></Link>
      <Link href="/admin/avis?status=REPORTED"><strong>{reports}</strong><span>signalement{reports > 1 ? "s" : ""} à examiner</span><ArrowUpRight size={14}/></Link>
    </nav>
  </section>;
}
