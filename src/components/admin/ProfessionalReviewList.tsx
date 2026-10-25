"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import AdminIcon from "@/components/admin/AdminIcon";

export type ReviewRow = { id: number; name: string; businessName: string; specialty: string; serviceCity: string; createdAt: string; status: string };
const statusText: Record<string, string> = { PENDING_VERIFICATION: "En attente", APPROVED: "Approuvé", REJECTED: "Refusé" };

export default function ProfessionalReviewList({ professionals }: { professionals: ReviewRow[] }) {
  const [search, setSearch] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [status, setStatus] = useState("");
  const specialties = useMemo(() => [...new Set(professionals.map(({ specialty: value }) => value).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")), [professionals]);
  const filtered = useMemo(() => professionals.filter((person) => {
    const query = search.trim().toLocaleLowerCase("fr");
    return (!query || `${person.name} ${person.businessName}`.toLocaleLowerCase("fr").includes(query)) && (!specialty || person.specialty === specialty) && (!status || person.status === status);
  }), [professionals, search, specialty, status]);

  return <div className="admin-content">
    <div className="admin-page-heading"><div><div className="admin-eyebrow"><span/>ESPACE ADMINISTRATEUR</div><h1>Validation des professionnels</h1><p>Examinez les dossiers et prenez une décision sur chaque inscription.</p></div><span className="admin-total-pill">{professionals.length} dossier{professionals.length > 1 ? "s" : ""}</span></div>
    <section className="admin-card">
      <div className="admin-toolbar"><label className="admin-search"><span aria-hidden="true"><AdminIcon name="search" size={17}/></span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un nom…" aria-label="Rechercher par nom" /></label><label className="admin-filter"><span>Spécialité</span><select value={specialty} onChange={(event) => setSpecialty(event.target.value)}><option value="">Toutes les spécialités</option>{specialties.map((value) => <option value={value} key={value}>{value}</option>)}</select></label><label className="admin-filter"><span>Statut</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Tous les statuts</option><option value="PENDING_VERIFICATION">En attente</option><option value="APPROVED">Approuvé</option><option value="REJECTED">Refusé</option></select></label></div>
      {professionals.length === 0 ? <div className="admin-empty"><span><AdminIcon name="file" size={21}/></span><h2>Aucune inscription professionnelle</h2><p>Les nouveaux dossiers apparaîtront ici après leur inscription.</p></div> : filtered.length === 0 ? <div className="admin-empty"><span><AdminIcon name="search" size={21}/></span><h2>Aucun dossier correspondant</h2><p>Modifiez la recherche ou les filtres pour afficher des résultats.</p></div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Professionnel</th><th>Spécialité</th><th>Ville</th><th>Date d’inscription</th><th>Statut</th><th><span className="sr-only">Dossier</span></th></tr></thead><tbody>{filtered.map((person) => <tr key={person.id}><td><span className="admin-person"><span className="admin-person-avatar">{(person.businessName || person.name).slice(0, 1).toUpperCase()}</span><span><strong>{person.businessName || person.name}</strong><small>{person.name}</small></span></span></td><td>{person.specialty || "—"}</td><td>{person.serviceCity || "—"}</td><td>{new Date(person.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</td><td><span className={`admin-status status-${person.status.toLowerCase()}`}><i/>{statusText[person.status] || "À vérifier"}</span></td><td><Link className="admin-view-link" href={`/admin/professionnels/${person.id}`}>Voir le dossier <span><AdminIcon name="external" size={13}/></span></Link></td></tr>)}</tbody></table></div>}
      {professionals.length > 0 && <div className="admin-table-footer">{filtered.length} résultat{filtered.length !== 1 ? "s" : ""}</div>}
    </section>
  </div>;
}
