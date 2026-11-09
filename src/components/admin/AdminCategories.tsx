"use client";

import { useMemo, useState } from "react";
import { BriefcaseBusiness, Boxes, Search, Shapes } from "lucide-react";
import type { getAdminCategoryInventory } from "@/app/lib/admin-categories";

type Inventory = Awaited<ReturnType<typeof getAdminCategoryInventory>>;
type Section = { title: string; source: string; items: { name: string; count: number }[]; icon: typeof Shapes };
const numberFormat = new Intl.NumberFormat("fr-FR");

function CategoryTable({ section, query }: { section: Section; query: string }) {
  const items = section.items.filter(({ name }) => name.toLocaleLowerCase("fr-FR").includes(query.toLocaleLowerCase("fr-FR")));

  return <section className="admin-card admin-category-card">
    <header className="admin-category-section-heading"><span><section.icon size={18}/></span><div><h2>{section.title}</h2><p>Source : {section.source}</p></div><strong>{numberFormat.format(items.length)} valeur{items.length !== 1 ? "s" : ""}</strong></header>
    {items.length ? <div className="admin-category-table-wrap"><table className="admin-table admin-category-table"><thead><tr><th>Nom exact</th><th>Utilisations</th><th>Source</th></tr></thead><tbody>{items.map(({ name, count }) => <tr key={name}><td><strong>{name}</strong></td><td>{numberFormat.format(count)}</td><td><span className="admin-category-source">{section.source}</span></td></tr>)}</tbody></table></div> : <div className="admin-category-empty"><Shapes size={20}/><strong>{query ? "Aucun résultat dans cette section" : "Aucune valeur enregistrée"}</strong><span>{query ? "Essayez un autre terme de recherche." : "Les valeurs apparaîtront ici lorsqu’elles seront présentes dans la base."}</span></div>}
  </section>;
}

export default function AdminCategories({ inventory }: { inventory: Inventory }) {
  const [query, setQuery] = useState("");
  const sections = useMemo<Section[]>(() => [
    { title: "Catégories des demandes de service", source: "ServiceRequest.category", items: inventory.requestCategories, icon: Shapes },
    { title: "Catégories des équipements", source: "Equipment.category", items: inventory.equipmentCategories, icon: Boxes },
    { title: "Spécialités des professionnels", source: "User.specialty", items: inventory.professionalSpecialties, icon: BriefcaseBusiness },
  ], [inventory]);

  return <div className="admin-content admin-categories-page">
    <div className="admin-page-heading"><div><div className="admin-eyebrow"><span/>INVENTAIRE EN LECTURE SEULE</div><h1>Catégories et spécialités</h1><p>Valeurs exactes enregistrées dans les demandes, équipements et profils professionnels.</p></div><span className="admin-total-pill">Lecture seule</span></div>

    <section className="admin-category-stat-grid" aria-label="Statistiques des catégories">
      <article className="admin-category-stat"><span>Valeurs distinctes</span><strong>{numberFormat.format(inventory.stats.distinctValues)}</strong><small>Noms exacts distincts toutes sources confondues</small></article>
      <article className="admin-category-stat"><span>Demandes classées</span><strong>{numberFormat.format(inventory.stats.classifiedRequests)}</strong><small>Demandes de service, hors conversations</small></article>
      <article className="admin-category-stat"><span>Équipements classés</span><strong>{numberFormat.format(inventory.stats.classifiedEquipment)}</strong><small>Équipements avec une catégorie renseignée</small></article>
      <article className="admin-category-stat"><span>Spécialités renseignées</span><strong>{numberFormat.format(inventory.stats.professionalsWithSpecialty)}</strong><small>Professionnels avec une valeur non vide</small></article>
    </section>

    <label className="admin-search admin-category-search"><Search size={16} aria-hidden="true"/><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={120} placeholder="Rechercher un nom exact…" aria-label="Rechercher une catégorie ou une spécialité"/></label>
    <div className="admin-category-section-list">{sections.map((section) => <CategoryTable key={section.source} section={section} query={query.trim()}/>)}</div>
    <p className="admin-category-readonly-note">Les valeurs sont affichées séparément par source. Les noms proches ou identiques ne sont ni fusionnés ni modifiés.</p>
  </div>;
}
