"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronDown, Droplets, Flame, Hammer, KeyRound, Leaf, Pencil, Plug, Plus, Power, Save, Search, Shapes, Snowflake, Sparkles, Trash2, Users, Wrench, X, Zap, Paintbrush } from "lucide-react";
import type { getAdminCategoryInventory } from "@/app/lib/admin-categories";
import { categoryIconNames, normalizeCategoryName, type CategoryIconName } from "@/lib/service-categories";

type Category = Awaited<ReturnType<typeof getAdminCategoryInventory>>[number];
type Modal = { mode: "create" } | { mode: "edit" | "delete"; category: Category };
const icons = { wrench: Wrench, droplets: Droplets, zap: Zap, snowflake: Snowflake, flame: Flame, key: KeyRound, hammer: Hammer, paintbrush: Paintbrush, sparkles: Sparkles, plug: Plug, leaf: Leaf, shapes: Shapes };
const iconLabels: Record<CategoryIconName, string> = { wrench: "Outils", droplets: "Eau", zap: "Électricité", snowflake: "Froid", flame: "Chaleur", key: "Clé", hammer: "Travaux", paintbrush: "Peinture", sparkles: "Entretien", plug: "Appareils", leaf: "Nature", shapes: "Autre" };
const number = new Intl.NumberFormat("fr-FR");
function CategoryIcon({ name, size = 22 }: { name: string; size?: number }) {
  const Icon = icons[name as CategoryIconName] ?? Wrench;
  return <Icon size={size} strokeWidth={1.7} aria-hidden="true"/>;
}

export default function AdminCategories({ inventory }: { inventory: Category[] }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [modal, setModal] = useState<Modal | null>(null);
  const [icon, setIcon] = useState("wrench");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const selected = modal && modal.mode !== "create" ? modal.category : null;
  const used = selected ? selected.professionals + selected.interventions + selected.equipment > 0 : false;
  const visible = inventory.filter(category => (status === "ALL" || category.isActive === (status === "ACTIVE")) && normalizeCategoryName(`${category.name} ${category.description}`).includes(normalizeCategoryName(query)));

  useEffect(() => {
    if (modal && !dialog.current?.open) dialog.current?.showModal();
    else if (!modal) dialog.current?.close();
  }, [modal]);

  function open(next: Modal) {
    setError(""); setFeedback(""); setIcon(next.mode === "create" ? "wrench" : next.category.icon); setModal(next);
  }

  async function mutate(method: string, id?: number, value?: unknown) {
    if (busy) return;
    setBusy(true); setError(""); setFeedback("");
    try {
      const response = await fetch(`/api/admin/categories${id ? `/${id}` : ""}`, {
        method, headers: { "Content-Type": "application/json" }, ...(value === undefined ? {} : { body: JSON.stringify(value) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Action impossible.");
      setFeedback(result.deactivated ? "Cette catégorie est utilisée : elle a été désactivée et ses données sont conservées." : method === "DELETE" ? "Catégorie supprimée." : "Catégorie enregistrée. Le catalogue de la plateforme est à jour.");
      setModal(null); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Connexion impossible."); }
    finally { setBusy(false); }
  }

  return <div className="admin-content admin-categories-page">
    <header className="admin-page-heading"><div><div className="admin-eyebrow"><span/>CATALOGUE DE SERVICES</div><h1>Catégories et spécialités</h1><p>Organisez les métiers proposés sur HomeFix et suivez les professionnels de chaque catégorie.</p></div><button className="admin-button admin-button-primary" onClick={() => open({ mode: "create" })}><Plus size={17}/>Ajouter une catégorie</button></header>
    <section className="admin-category-stat-grid" aria-label="Statistiques des catégories">
      {[{ label: "Catégories", value: inventory.length, note: "Tous les métiers du catalogue" }, { label: "Actives", value: inventory.filter(category => category.isActive).length, note: "Proposées sur la plateforme" }, { label: "Professionnels", value: inventory.reduce((sum, category) => sum + category.professionals, 0), note: "Inscrits dans ces catégories" }, { label: "Interventions", value: inventory.reduce((sum, category) => sum + category.interventions, 0), note: "Associations et historique conservés" }].map(stat => <article className="admin-category-stat" key={stat.label}><span>{stat.label}</span><strong>{number.format(stat.value)}</strong><small>{stat.note}</small></article>)}
    </section>
    <div className="admin-category-toolbar"><label className="admin-search admin-category-search"><Search size={17} aria-hidden="true"/><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher une catégorie…" aria-label="Rechercher une catégorie" maxLength={120}/></label><label className="admin-category-status-filter"><span>Statut</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="ALL">Tous les statuts</option><option value="ACTIVE">Actives</option><option value="INACTIVE">Désactivées</option></select><ChevronDown size={14} aria-hidden="true"/></label><span className="admin-category-result-count" role="status">{visible.length} catégorie{visible.length > 1 ? "s" : ""}</span></div>
    {feedback && <p className="aw-note" role="status">{feedback}</p>}
    {error && !modal && <p className="admin-action-error" role="alert">{error}</p>}
    {visible.length === 0 ? <div className="aw-card admin-category-empty"><Shapes size={28}/><h2>Aucune catégorie trouvée</h2><p>{query || status !== "ALL" ? "Ajustez votre recherche ou le statut sélectionné." : "Ajoutez votre première catégorie pour enrichir le catalogue."}</p></div> : <div className="admin-category-cards">{visible.map(category => <article className={`admin-card admin-category-managed-card${category.isActive ? "" : " is-inactive"}`} key={category.id}>
      <header><span className={`admin-category-icon color-${category.id % 5}`}><CategoryIcon name={category.icon}/></span><span className={`admin-category-status ${category.isActive ? "is-active" : ""}`}>{category.isActive ? <><Check size={11}/>Active</> : "Désactivée"}</span></header>
      <h2>{category.name}</h2><p className="admin-category-description">{category.description || "Une expertise au service des maisons de Tunisie."}</p>
      <dl className="admin-category-counts"><div><dt>Inscrits</dt><dd>{number.format(category.professionals)}</dd></div><div><dt>Approuvés</dt><dd>{number.format(category.approved)}</dd></div><div><dt>Interventions</dt><dd>{number.format(category.interventions)}</dd></div></dl>
      <Link className="admin-category-people" href={`/admin/professionnels?specialty=${encodeURIComponent(category.name)}`}><Users size={15}/>Voir les professionnels<ArrowRight size={14}/></Link>
      <footer><button onClick={() => open({ mode: "edit", category })} disabled={busy} className="admin-category-edit"><Pencil size={14}/>Modifier</button><div><button onClick={() => void mutate("PATCH", category.id, { isActive: !category.isActive })} disabled={busy} aria-label={`${category.isActive ? "Désactiver" : "Activer"} ${category.name}`} title={category.isActive ? "Désactiver" : "Activer"}><Power size={16}/></button><button onClick={() => open({ mode: "delete", category })} disabled={busy} className="is-danger" aria-label={`Supprimer ${category.name}`} title="Supprimer"><Trash2 size={15}/></button></div></footer>
    </article>)}</div>}
    <dialog ref={dialog} className="aw-dialog admin-category-dialog" aria-labelledby="category-dialog-title" onCancel={event => { if (busy) event.preventDefault(); else setModal(null); }}>
      {modal && <><header><h2 id="category-dialog-title">{modal.mode === "create" ? "Ajouter une catégorie" : modal.mode === "edit" ? "Modifier la catégorie" : used ? "Désactiver cette catégorie ?" : "Supprimer cette catégorie ?"}</h2><button className="admin-icon-button" aria-label="Fermer" disabled={busy} onClick={() => setModal(null)}><X size={18}/></button></header>
      {modal.mode === "delete" ? <><p><strong>{selected?.name}</strong>{used ? " est utilisée par des profils, des interventions ou des équipements. Elle sera désactivée pour préserver ces associations." : " sera retirée du catalogue. Cette suppression est définitive."}</p><footer><button className="admin-button admin-button-light" disabled={busy} onClick={() => setModal(null)}>Annuler</button><button className="admin-button admin-button-primary" disabled={busy} onClick={() => void mutate("DELETE", selected!.id)}>{busy ? "Traitement…" : used ? "Désactiver la catégorie" : "Confirmer la suppression"}</button></footer></> : <form key={`${modal.mode}-${selected?.id ?? "new"}`} onSubmit={event => {
        event.preventDefault(); const form = new FormData(event.currentTarget);
        void mutate(modal.mode === "create" ? "POST" : "PUT", selected?.id, { name: String(form.get("name") ?? ""), description: String(form.get("description") ?? ""), icon, isActive: form.get("isActive") === "on" });
      }}><fieldset disabled={busy}><label className="aw-field"><span>Nom de la catégorie</span><input name="name" defaultValue={selected?.name ?? ""} required minLength={2} maxLength={80} placeholder="Ex. Jardinage" autoFocus/></label><label className="aw-field"><span>Description</span><textarea name="description" defaultValue={selected?.description ?? ""} maxLength={1000} rows={3} placeholder="Décrivez les services de cette catégorie…"/></label><fieldset className="admin-category-icon-picker"><legend>Icône</legend><div>{categoryIconNames.map(name => <button type="button" key={name} aria-label={iconLabels[name]} title={iconLabels[name]} aria-pressed={icon === name} onClick={() => setIcon(name)}><CategoryIcon name={name} size={21}/></button>)}</div></fieldset><label className="admin-category-active-choice"><input type="checkbox" name="isActive" defaultChecked={selected?.isActive ?? true}/><span>Catégorie active<small>Disponible à l’inscription et dans les recherches.</small></span></label></fieldset><footer><button type="button" className="admin-button admin-button-light" disabled={busy} onClick={() => setModal(null)}>Annuler</button><button type="submit" className="admin-button admin-button-primary" disabled={busy}><Save size={15}/>{busy ? "Enregistrement…" : "Enregistrer"}</button></footer></form>}
      {error && <p role="alert" className="admin-action-error">{error}</p>}</>}
    </dialog>
  </div>;
}
