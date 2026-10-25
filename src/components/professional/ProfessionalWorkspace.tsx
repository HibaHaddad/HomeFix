"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import ProfessionalIcon from "@/components/professional/ProfessionalIcon";
import ProfessionalNavigation from "@/components/professional/ProfessionalNavigation";

type WorkspaceUser = { name: string; businessName: string | null; specialty: string | null; hasProfilePhoto: boolean };

export default function ProfessionalWorkspace({ user, children }: { user: WorkspaceUser; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return <div className={`pro-app${collapsed ? " is-collapsed" : ""}`}>
    <aside className="pro-sidebar">
      <div className="pro-brand-row">
        <Link className="pro-brand" href="/"><span className="pro-brand-icon"><ProfessionalIcon name="wrench" size={19}/></span><span>HomeFix<small>ESPACE PROFESSIONNEL</small></span></Link>
        <button className="pro-sidebar-toggle" type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Ouvrir la barre latérale" : "Réduire la barre latérale"} aria-expanded={!collapsed} title={collapsed ? "Ouvrir la barre latérale" : "Réduire la barre latérale"}><ProfessionalIcon name={collapsed ? "chevron-right" : "chevron-left"} size={16}/></button>
      </div>
      <nav className="pro-nav" aria-label="Navigation professionnelle"><ProfessionalNavigation /></nav>
      <div className="pro-sidebar-bottom"><div className="pro-help"><span>Besoin d’aide ?</span><small>Notre équipe est là pour vous accompagner.</small><a href="mailto:contact@homefix.tn">Contacter HomeFix ↗</a></div><div className="pro-logout-wrap"><LogoutButton /></div></div>
    </aside>
    <div className="pro-main">
      <header className="pro-header"><div className="pro-breadcrumb"><span className="pro-breadcrumb-home"><ProfessionalIcon name="home" size={14}/></span> HomeFix <i>/</i> <strong>Espace professionnel</strong></div><div className="pro-header-actions"><Link className="pro-notification-button" href="/professionnel/notifications" aria-label="Notifications"><ProfessionalIcon name="bell" size={19}/><i /></Link><div className="pro-user"><span className="pro-avatar">{user.hasProfilePhoto ? <img src="/api/professionnel/photo" alt="" /> : user.name.slice(0, 1).toUpperCase()}</span><span><strong>{user.businessName || user.name}</strong><small>{user.specialty || "Professionnel"}</small></span></div></div></header>
      <main className="pro-content">{children}</main>
      <nav className="pro-mobile-nav" aria-label="Navigation rapide"><ProfessionalNavigation mobile /></nav>
    </div>
  </div>;
}
