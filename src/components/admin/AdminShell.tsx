"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity, Bell, BriefcaseBusiness, ChevronDown, ChevronLeft, ChevronRight,
  ClipboardList, FolderKanban, LayoutDashboard, Menu, MessageSquareWarning,
  Search, Settings, ShieldCheck, Star, Users, X, CalendarDays, CreditCard, MessagesSquare, Scale,
} from "lucide-react";
import HomeFixBrand from "@/components/HomeFixBrand";
import LogoutButton from "@/components/LogoutButton";

const navigation = [
  { label: "Vue générale", href: "/admin", icon: LayoutDashboard, available: true, group: "Pilotage" },
  { label: "Utilisateurs", href: "/admin/utilisateurs", icon: Users, available: true, group: "Gestion" },
  { label: "Prestataires", href: "/admin/professionnels", icon: BriefcaseBusiness, available: true, group: "Gestion" },
  { label: "Demandes et interventions", href: "/admin/demandes", icon: ClipboardList, available: true, group: "Gestion" },
  { label: "Réservations", href: "/admin/reservations", icon: CalendarDays, available: true, group: "Gestion" },
  { label: "Catégories", href: "/admin/categories", icon: FolderKanban, available: true, group: "Gestion" },
  { label: "Réclamations", href: "/admin/reclamations", icon: MessageSquareWarning, available: true, group: "Modération" },
  { label: "Avis et modération", href: "/admin/avis", icon: Star, available: true, group: "Modération" },
  { label: "Messagerie", href: "/admin/messagerie", icon: MessagesSquare, available: true, group: "Modération" },
  { label: "Paiements", href: "/admin/paiements", icon: CreditCard, available: true, group: "Finance" },
  { label: "Sanctions et pénalités", href: "/admin/sanctions", icon: Scale, available: true, group: "Finance" },
  { label: "Notifications", href: "/admin/notifications", icon: Bell, available: true, group: "Système" },
  { label: "Journal d’audit", href: "/admin/activites", icon: Activity, available: true, group: "Système" },
  { label: "Paramètres", href: "/admin/parametres", icon: Settings, available: true, group: "Système" },
] as const;

const titles: Record<string, string> = {
  "/admin": "Vue générale",
  "/admin/utilisateurs": "Utilisateurs",
  "/admin/professionnels": "Prestataires",
  "/admin/demandes": "Demandes",
  "/admin/categories": "Catégories",
  "/admin/reclamations": "Réclamations",
  "/admin/reservations": "Réservations",
  "/admin/avis": "Avis et modération",
  "/admin/messagerie": "Messagerie",
  "/admin/paiements": "Paiements",
  "/admin/sanctions": "Sanctions et pénalités",
  "/admin/notifications": "Notifications",
  "/admin/activites": "Journal d’audit",
  "/admin/parametres": "Paramètres",
};

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");
}

export default function AdminShell({ adminName, unreadCount, children }: { adminName: string; unreadCount: number; children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const title = pathname.startsWith("/admin/professionnels/")
    ? "Dossier professionnel"
    : pathname.startsWith("/admin/demandes/")
      ? "Détail de la demande"
    : pathname.startsWith("/admin/reclamations/")
      ? "Détail de la réclamation"
    : pathname.startsWith("/admin/utilisateurs/")
      ? "Fiche utilisateur"
    : pathname.startsWith("/admin/messagerie/")
      ? "Consultation d’une conversation"
    : titles[pathname] ?? "Administration";
  const groups = [...new Set(navigation.map((item) => item.group))];

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className={`admin-app${collapsed ? " is-collapsed" : ""}${mobileOpen ? " mobile-open" : ""}`}>
      {mobileOpen && <button className="admin-mobile-backdrop" aria-label="Fermer le menu" onClick={() => setMobileOpen(false)} />}
      <aside className="admin-sidebar" aria-label="Navigation admin">
        <div className="admin-sidebar-top">
          <HomeFixBrand inverse subtitle="ESPACE ADMINISTRATION" className="admin-workspace-brand" />
          <button className="admin-icon-button admin-mobile-close" aria-label="Fermer le menu" onClick={() => setMobileOpen(false)}><X size={19} /></button>
        </div>
        <div className="admin-navigation">
          {groups.map((group) => (
            <section className="admin-nav-group" key={group}>
              <h2 className="admin-nav-label">{group}</h2>
              <nav aria-label={group}>
                {navigation.filter((item) => item.group === group).map(({ label, href, icon: Icon, available }) => {
                  const active = available && isActive(href);
                  const content = <>
                    <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                    <span className="admin-nav-text">{label}</span>
                    {active && <span className="admin-nav-indicator" />}
                    {!available && <span className="admin-nav-soon">Bientôt</span>}
                  </>;
                  return available ? (
                    <Link key={href} href={href} className={`admin-nav-link${active ? " active" : ""}`} aria-current={active ? "page" : undefined} title={collapsed ? label : undefined} onClick={() => setMobileOpen(false)}>{content}</Link>
                  ) : (
                    <div key={href} className="admin-nav-link is-disabled" aria-disabled="true" title={`${label} : page non disponible`}>{content}</div>
                  );
                })}
              </nav>
            </section>
          ))}
        </div>
        <div className="admin-sidebar-profile">
          <span className="admin-avatar" aria-hidden="true">{initials(adminName)}</span>
          <span className="admin-profile-copy"><strong>{adminName}</strong><small>Administrateur</small></span>
          <ShieldCheck className="admin-profile-shield" size={16} aria-label="Administrateur" />
        </div>
        <button className="admin-collapse-button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Développer la sidebar" : "Réduire la sidebar"} title={collapsed ? "Développer" : "Réduire"}>
          {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}<span>Réduire le menu</span>
        </button>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div className="admin-header-leading">
            <button className="admin-icon-button admin-mobile-trigger" aria-label="Ouvrir le menu" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
            <div className="admin-breadcrumbs" aria-label="Fil d’Ariane"><span>Administration</span><ChevronRight size={14} aria-hidden="true" /><strong>{title}</strong></div>
          </div>
          <div className="admin-header-actions">
            <form className="admin-global-search" action="/admin/utilisateurs"><Search size={17} aria-hidden="true" /><input type="search" name="q" placeholder="Rechercher un utilisateur…" aria-label="Rechercher un utilisateur" maxLength={100}/><button className="sr-only" type="submit">Rechercher</button></form>
            <Link href="/admin/notifications" className="admin-icon-button admin-notification-button" aria-label={`Notifications · ${unreadCount} non lues`}><Bell size={19} />{unreadCount > 0 && <span className="aw-bell-count">{unreadCount > 99 ? "99+" : unreadCount}</span>}</Link>
            <div className="admin-account-menu">
              <button className="admin-account-trigger" aria-expanded={profileOpen} aria-haspopup="menu" onClick={() => setProfileOpen((value) => !value)}>
                <span className="admin-avatar" aria-hidden="true">{initials(adminName)}</span>
                <span className="admin-account-copy"><strong>{adminName}</strong><small>Administrateur</small></span>
                <ChevronDown size={16} aria-hidden="true" />
              </button>
              {profileOpen && <div className="admin-account-dropdown" role="menu">
                <div className="admin-dropdown-identity"><span className="admin-avatar" aria-hidden="true">{initials(adminName)}</span><span><strong>{adminName}</strong><small>Administrateur</small></span></div>
                <div className="admin-dropdown-divider" />
                <div role="menuitem" className="admin-dropdown-logout"><LogoutButton /></div>
              </div>}
            </div>
          </div>
        </header>
        <div className="admin-page-content"><div className="admin-route-stage" key={pathname}>{children}</div></div>
      </main>
    </div>
  );
}
