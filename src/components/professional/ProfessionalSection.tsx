import Link from "next/link";
import ProfessionalIcon from "@/components/professional/ProfessionalIcon";
import ProfessionalPhotoUploader from "@/components/professional/ProfessionalPhotoUploader";
import ProfessionalProfileEditor from "@/components/professional/ProfessionalProfileEditor";
import ProfessionalCalendar from "@/components/professional/ProfessionalCalendar";

type Professional = { name: string; email: string; phone: string | null; address: string | null; city: string | null; role: string; status: string; businessName: string | null; specialty: string | null; description: string | null; experience: string | null; serviceCity: string | null; coveredAreas: string | null; priceRange: string | null; createdAt: Date };
const content: Record<string, { title: string; eyebrow: string; intro: string; icon: string }> = {
  "tableau-de-bord": { title: "Votre activité, en un coup d’œil", eyebrow: "TABLEAU DE BORD", intro: "Retrouvez ici les informations de votre espace professionnel.", icon: "⌂" },
  demandes: { title: "Demandes de service", eyebrow: "VOTRE ACTIVITÉ", intro: "Consultez les nouvelles demandes qui correspondent à vos services.", icon: "◇" },
  reservations: { title: "Réservations", eyebrow: "VOTRE ACTIVITÉ", intro: "Consultez votre agenda et vos prochains rendez-vous.", icon: "▦" },
  interventions: { title: "Interventions", eyebrow: "VOTRE ACTIVITÉ", intro: "Suivez vos missions et leurs étapes.", icon: "⌁" },
  messagerie: { title: "Messagerie", eyebrow: "VOTRE ACTIVITÉ", intro: "Échangez directement avec vos clients et discutez du prix de l’intervention dans le chat.", icon: "✉" },
  profil: { title: "Profil professionnel", eyebrow: "GESTION DU COMPTE", intro: "Vos informations professionnelles enregistrées sur HomeFix.", icon: "◉" },
  revenus: { title: "Revenus", eyebrow: "GESTION DU COMPTE", intro: "Retrouvez le suivi de vos paiements et transactions.", icon: "¤" },
  avis: { title: "Avis clients", eyebrow: "GESTION DU COMPTE", intro: "Les évaluations et commentaires laissés par vos clients.", icon: "☆" },
  notifications: { title: "Notifications", eyebrow: "GESTION DU COMPTE", intro: "Les actualités de votre activité professionnelle.", icon: "♧" },
  parametres: { title: "Paramètres", eyebrow: "GESTION DU COMPTE", intro: "Gérez les préférences et la sécurité de votre compte.", icon: "⚙" },
};

function EmptyState({ title, detail, icon = "inbox" }: { title: string; detail: string; icon?: "inbox" | "calendar" | "chart" }) {
  return <div className="pro-empty"><span className="pro-empty-icon"><ProfessionalIcon name={icon} size={20}/></span><h3>{title}</h3><p>{detail}</p></div>;
}

export default function ProfessionalSection({ section, user, hasProfilePhoto }: { section: string; user: Professional; hasProfilePhoto: boolean }) {
  const item = content[section];
  const heading = <div className="pro-page-heading"><div><div className="pro-eyebrow"><span />{item.eyebrow}</div><h1>{item.title}</h1><p>{item.intro}</p></div><span className="pro-heading-mark"><ProfessionalIcon name={section === "tableau-de-bord" ? "home" : section === "demandes" ? "inbox" : section === "reservations" ? "calendar" : section === "interventions" ? "wrench" : section === "messagerie" ? "message" : section === "services" ? "sparkles" : section === "profil" ? "user" : section === "revenus" ? "wallet" : section === "avis" ? "star" : section === "notifications" ? "bell" : "settings"} size={21}/></span></div>;
  if (section === "reservations") return <>
    {heading}
    <ProfessionalCalendar />
    <footer className="pro-footer"><span>Connecté en tant que <strong>{user.name}</strong></span><Link href="/">Retour à l’accueil HomeFix ↗</Link></footer>
  </>;
  if (section === "profil") return <>
    {heading}
    {section === "profil" && <ProfessionalPhotoUploader name={user.name} hasPhoto={hasProfilePhoto} />}
    <ProfessionalProfileEditor profile={user} />
    <footer className="pro-footer"><span>Connecté en tant que <strong>{user.name}</strong></span><Link href="/">Retour à l’accueil HomeFix ↗</Link></footer>
  </>;
  return <>
    {heading}
    {section === "tableau-de-bord" ? <>
      {user.status === "PENDING_VERIFICATION" && <div className="pro-status-banner"><span>◷</span><div><strong>Votre profil est en cours de vérification</strong><p>Il restera en attente tant que l’équipe HomeFix n’aura pas terminé son examen. Aucune vérification automatique n’est effectuée.</p></div></div>}
      <div className="pro-stat-grid">{[["Demandes reçues", "—", "Les demandes ne sont pas encore disponibles", "inbox"], ["Rendez-vous à venir", "—", "Les réservations ne sont pas encore disponibles", "calendar"], ["Revenus", "—", "Les paiements ne sont pas encore disponibles", "wallet"], ["Note moyenne", "—", "Les avis ne sont pas encore disponibles", "star"]].map(([label, value, note, icon]) => <article className="pro-stat-card" key={label}><span className="pro-stat-top"><span>{label}</span><i><ProfessionalIcon name={icon as "inbox" | "calendar" | "wallet" | "star"} size={17}/></i></span><strong>{value}</strong><small>{note}</small></article>)}</div>
      <section className="pro-panel pro-chart-panel"><div className="pro-panel-heading"><div><span>VUE D’ENSEMBLE</span><h2>Activité et revenus</h2></div><span className="pro-chart-badge"><i/>En attente de données</span></div><div className="pro-chart-empty" role="img" aria-label="Graphique indisponible : les revenus et l’activité ne sont pas encore enregistrés par la plateforme."><div className="pro-chart-grid"/><div className="pro-chart-empty-note"><span><ProfessionalIcon name="chart" size={18}/></span><strong>Votre activité apparaîtra ici</strong><p>Aucune donnée de réservation ou de paiement n’est encore disponible.</p></div></div><div className="pro-chart-legend"><span><i className="legend-requests"/>Demandes</span><span><i className="legend-revenue"/>Revenus</span><small>Graphique disponible lorsque ces données seront reliées.</small></div></section>
      <div className="pro-columns"><section className="pro-panel"><div className="pro-panel-heading"><div><span>AGENDA</span><h2>Prochains rendez-vous</h2></div><Link href="/professionnel/reservations">Voir l’agenda <ProfessionalIcon name="arrow" size={14}/></Link></div><EmptyState icon="calendar" title="Aucun rendez-vous à afficher" detail="Les réservations apparaîtront ici lorsqu’elles seront prises en charge par la plateforme." /></section><section className="pro-panel"><div className="pro-panel-heading"><div><span>À TRAITER</span><h2>Nouvelles demandes</h2></div><Link href="/professionnel/demandes">Voir les demandes <ProfessionalIcon name="arrow" size={14}/></Link></div><EmptyState title="Aucune demande disponible" detail="Les demandes clients ne sont pas encore reliées au compte professionnel." /></section></div>
    </> : section === "profil" ? <><ProfessionalPhotoUploader name={user.name} hasPhoto={hasProfilePhoto}/><section className="pro-panel pro-profile-panel"><div className="pro-panel-heading"><div><span>INFORMATIONS ENREGISTRÉES</span><h2>Votre profil HomeFix</h2></div><span className="pro-readonly-tag">Lecture seule</span></div><dl className="pro-details">{[["Nom professionnel", user.businessName], ["Nom du titulaire", user.name], ["Adresse e-mail", user.email], ["Téléphone", user.phone], ["Spécialité", user.specialty], ["Expérience", user.experience], ["Ville d’intervention", user.serviceCity], ["Zones couvertes", user.coveredAreas], ["Fourchette de prix", user.priceRange], ["Présentation", user.description]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "Non renseigné"}</dd></div>)}</dl><p className="pro-info-note">La photo est modifiable depuis cette page. Les autres informations du profil nécessitent encore des routes de modification dédiées.</p></section></> : section === "services" ? <section className="pro-panel pro-profile-panel"><div className="pro-panel-heading"><div><span>INFORMATIONS ENREGISTRÉES</span><h2>Votre offre de services</h2></div><span className="pro-readonly-tag">Lecture seule</span></div><dl className="pro-details">{[["Spécialité", user.specialty], ["Fourchette de prix", user.priceRange], ["Présentation", user.description]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "Non renseigné"}</dd></div>)}</dl><p className="pro-info-note">La gestion complète des services nécessite des routes et des champs dédiés côté serveur.</p></section> : section === "parametres" ? <section className="pro-panel"><div className="pro-panel-heading"><div><span>SÉCURITÉ DU COMPTE</span><h2>Connexion et mot de passe</h2></div></div><div className="pro-settings-row"><span><strong>Adresse e-mail du compte</strong><small>{user.email}</small></span><span className="pro-readonly-tag">Gérée par le compte</span></div><p className="pro-info-note">Le changement de mot de passe et les préférences de notification ne sont pas encore proposés par l’API.</p></section> : <section className="pro-panel"><div className="pro-panel-heading"><div><span>{item.eyebrow}</span><h2>{item.title}</h2></div></div><EmptyState title="Aucune donnée à afficher pour le moment" detail="Le projet ne contient pas encore de modèle ni d’API pour enregistrer ces informations. Cette page n’affiche donc aucune donnée simulée." /><div className="pro-info-note">Pour activer cette fonctionnalité, il faut ajouter les modèles PostgreSQL correspondants, des routes serveur contrôlées par rôle et les opérations de gestion associées.</div></section>}
    <footer className="pro-footer"><span>Connecté en tant que <strong>{user.name}</strong></span><Link href="/">Retour à l’accueil HomeFix ↗</Link></footer>
  </>;
}
