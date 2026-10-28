"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Icon from "@/components/professional/ProfessionalIcon";
import ProfessionalCard from "./ProfessionalCard";
import DirectorySkeleton from "./DirectorySkeleton";
import type { DirectoryResponse } from "@/app/lib/professional-directory";
import { availabilityLabels, sortLabels, tunisianGovernorates } from "@/lib/directory-filters";

const filterKeys = ["specialty", "location", "minExperience", "maxExperience", "minRating", "minPrice", "maxPrice", "availability", "verified"];
const commonServices = ["Plomberie", "Électricité", "Climatisation", "Peinture", "Ménage"];
export default function ProfessionalDirectory() {
  const params = useSearchParams();
  const pathname = usePathname();
  const query = params.toString();
  const committedSearch = params.get("q") || "";
  const [search, setSearch] = useState(params.get("q") || "");
  const [data, setData] = useState<DirectoryResponse | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const currentQuery = useRef(query);
  useEffect(() => { currentQuery.current = query; }, [query]);

  function change(key: string, value: string) {
    const next = new URLSearchParams(currentQuery.current);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== "page") next.delete("page");
    currentQuery.current = next.toString();
    window.history.replaceState(null, "", `${pathname}${next.size ? `?${next}` : ""}`);
  }
  function reset() { setSearch(""); currentQuery.current = ""; window.history.replaceState(null, "", pathname); }
  useEffect(() => { setSearch(committedSearch); }, [committedSearch]);
  useEffect(() => {
    if (search === (new URLSearchParams(currentQuery.current).get("q") || "")) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(currentQuery.current);
      if (search.trim()) next.set("q", search.trim()); else next.delete("q");
      next.delete("page");
      currentQuery.current = next.toString();
      window.history.replaceState(null, "", `${pathname}${next.size ? `?${next}` : ""}`);
    }, 350);
    return () => clearTimeout(timer);
  }, [search, pathname]);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true); setError("");
    fetch(`/api/client/professionnels?${query}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.error || "La recherche a échoué."); return result as DirectoryResponse; })
      .then((result) => {
        if (controller.signal.aborted) return;
        setData(result); setBusy(false);
        const requested = Number(new URLSearchParams(query).get("page") || 1);
        if (result.page !== requested) {
          const next = new URLSearchParams(query);
          if (result.page === 1) next.delete("page"); else next.set("page", String(result.page));
          window.history.replaceState(null, "", `${pathname}${next.size ? `?${next}` : ""}`);
        }
      })
      .catch((error) => { if (!controller.signal.aborted) { setError(error instanceof Error ? error.message : "Connexion impossible."); setBusy(false); } });
    return () => controller.abort();
  }, [query, pathname, retry]);

  const active = filterKeys.filter((key) => params.has(key) && !!params.get(key));
  function filters() {
    return <>
      <div className="filter-heading"><h2><Icon name="settings" size={17}/> Affiner la recherche</h2><button type="button" onClick={reset}>Réinitialiser</button></div>
      <label className="directory-filter"><span>Spécialité</span><select value={params.get("specialty") || ""} onChange={(e) => change("specialty", e.target.value)}><option value="">Tous les métiers</option>{[...new Set([...commonServices, ...(data?.specialties || []), ...(params.get("specialty") ? [params.get("specialty")!] : [])])].map((s) => <option key={s}>{s}</option>)}</select></label>
      <label className="directory-filter"><span>Localisation · Gouvernorat</span><select value={params.get("location") || ""} onChange={(e) => change("location", e.target.value)}><option value="">Tous les gouvernorats</option>{tunisianGovernorates.map((governorate) => <option key={governorate} value={governorate}>{governorate}</option>)}</select></label>
      <fieldset className="directory-filter"><legend>Années d’expérience</legend><div className="filter-range"><input aria-label="Expérience minimale" type="number" min="0" max="80" placeholder="Min." value={params.get("minExperience") || ""} onChange={(e) => change("minExperience", e.target.value)}/><span>—</span><input aria-label="Expérience maximale" type="number" min="0" max="80" placeholder="Max." value={params.get("maxExperience") || ""} onChange={(e) => change("maxExperience", e.target.value)}/></div></fieldset>
      <label className="directory-filter"><span>Note minimale</span><select value={params.get("minRating") || ""} onChange={(e) => change("minRating", e.target.value)}><option value="">Toutes les notes</option>{[4.5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★ et plus</option>)}</select></label>
      <fieldset className="directory-filter"><legend>Budget indicatif <small>TND</small></legend><div className="filter-range"><input type="number" min="0" max="100000" aria-label="Prix minimum en TND" placeholder="Min." value={params.get("minPrice") || ""} onChange={(e) => change("minPrice", e.target.value)}/><span>—</span><input type="number" min="0" max="100000" aria-label="Prix maximum en TND" placeholder="Max." value={params.get("maxPrice") || ""} onChange={(e) => change("maxPrice", e.target.value)}/></div><small>Le montant final se discute avec le professionnel.</small></fieldset>
      <label className="directory-filter"><span>Disponibilité</span><select value={params.get("availability") || ""} onChange={(e) => change("availability", e.target.value)}><option value="">Toutes les disponibilités</option>{Object.entries(availabilityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label className="directory-verified-filter"><input type="checkbox" checked={params.get("verified") === "true"} onChange={(e) => change("verified", e.target.checked ? "true" : "")}/><Icon name="shield" size={17}/><span>Profils vérifiés uniquement</span></label>
      <p className="directory-filter-note">Les filtres numériques et de disponibilité s’appliquent aux informations renseignées. Les profils sans avis restent visibles sans filtre de note.</p>
    </>;
  }
  const returnTo = `/dashboard/professionnels${query ? `?${query}` : ""}`;
  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;
  return <>
    <div className="client-breadcrumb">Mon espace <span>/</span> <strong>Trouver un professionnel</strong></div>
    <section className="directory-hero"><div className="directory-hero-copy"><span className="eyebrow"><span className="eyebrow-dot"/> VOTRE MAISON, ENTRE DE BONNES MAINS</span><h1>Le bon professionnel.<br/><em>Tout près de chez vous.</em></h1><p>Un dépannage, une installation, un nouveau projet ?<br/>Trouvez le savoir-faire qu’il vous faut, partout en Tunisie.</p></div><div className="directory-hero-art" aria-hidden="true"><div className="hero-art-orbit"/><span className="hero-art-house"><Icon name="home" size={68}/></span><span className="hero-art-tool"><Icon name="wrench" size={26}/></span><span className="hero-art-shield"><Icon name="shield" size={25}/></span><span className="hero-art-label"><i/> Des profils approuvés par HomeFix</span></div></section>
    <section className="directory-search-panel" aria-label="Recherche de professionnels"><form className="directory-search" onSubmit={(e) => { e.preventDefault(); change("q", search.trim()); }}><Icon name="user" size={21}/><label className="sr-only" htmlFor="professional-search">Nom, métier ou spécialité</label><input id="professional-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Un nom, un métier, une spécialité…"/><button type="submit">Rechercher <Icon name="arrow" size={17}/></button></form><div className="directory-quick"><span>Pour vous inspirer</span>{commonServices.map((s) => <button type="button" key={s} className={params.get("specialty") === s ? "selected" : ""} onClick={() => change("specialty", params.get("specialty") === s ? "" : s)}>{s}</button>)}</div></section>
    <div className="directory-layout"><aside className="directory-sidebar">{filters()}<div className="directory-trust"><Icon name="shield" size={24}/><strong>Choisissez en confiance.</strong><p>Des professionnels approuvés, des informations transparentes et un devis discuté ensemble.</p></div></aside>
      <section className="directory-results" aria-label="Résultats de recherche" aria-busy={busy}>
        <div className="directory-result-bar"><div><h2>Les professionnels pour vous</h2><p role="status" aria-live="polite">{busy ? "Recherche en cours…" : error ? "Recherche indisponible" : `${data?.total ?? 0} professionnel${data?.total === 1 ? "" : "s"} trouvé${data?.total === 1 ? "" : "s"}`}</p></div><label className="directory-sort"><span>Trier par</span><select aria-label="Trier les professionnels" value={params.get("sort") || "recent"} onChange={(e) => change("sort", e.target.value)}>{Object.entries(sortLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
        <button type="button" className="directory-mobile-filter" onClick={() => dialog.current?.showModal()}><Icon name="settings" size={17}/>Filtres {active.length > 0 && <span>{active.length}</span>}</button>
        {active.length > 0 && <div className="directory-active-filters">{active.map((key) => <button key={key} type="button" onClick={() => change(key, "")} aria-label={`Retirer le filtre ${key}`}>{({ minExperience: "Exp. min.", maxExperience: "Exp. max.", minRating: "Note min.", minPrice: "Prix min.", maxPrice: "Prix max." } as Record<string, string>)[key]} {key === "verified" ? "Vérifiés" : key === "availability" ? availabilityLabels[params.get(key)!] || params.get(key) : params.get(key)} <span>×</span></button>)}<button type="button" onClick={reset}>Tout effacer</button></div>}
        {busy ? <DirectorySkeleton/> : error ? <div className="directory-empty" role="alert"><Icon name="inbox" size={35}/><h3>Une petite interruption.</h3><p>{error}</p><button className="button button-dark" onClick={() => setRetry((r) => r + 1)}>Réessayer</button><button className="directory-text-button" onClick={reset}>Réinitialiser les filtres</button></div> : data?.professionals.length ? <><div className="directory-cards">{data.professionals.map((p) => <ProfessionalCard key={p.id} professional={p} returnTo={returnTo}/>)}</div>{totalPages > 1 && <nav className="directory-pagination" aria-label="Pagination"><button disabled={data.page === 1} onClick={() => change("page", String(data.page - 1))}><Icon name="chevron-left" size={16}/>Précédent</button><span>Page <strong>{data.page}</strong> sur {totalPages}</span><button disabled={data.page === totalPages} onClick={() => change("page", String(data.page + 1))}>Suivant<Icon name="chevron-right" size={16}/></button></nav>}</> : <div className="directory-empty"><span className="directory-empty-icon"><Icon name="user" size={32}/></span><h3>Le bon pro se fait encore chercher.</h3><p>{active.length || params.get("q") ? "Essayez une autre spécialité ou élargissez vos critères pour découvrir plus de profils." : "Les professionnels approuvés et visibles apparaîtront ici dès qu’ils seront disponibles."}</p><button className="button button-dark" onClick={reset}>Réinitialiser la recherche <Icon name="arrow" size={16}/></button></div>}
        <p className="directory-bottom-note"><Icon name="shield" size={15}/>Vos coordonnées restent privées. Échangez avec un professionnel à votre rythme.</p>
      </section>
    </div>
    <dialog ref={dialog} className="directory-filter-dialog" onClick={(e) => { if (e.target === e.currentTarget) dialog.current?.close(); }}><div className="directory-dialog-inner"><button className="directory-dialog-close" type="button" onClick={() => dialog.current?.close()} aria-label="Fermer les filtres">×</button>{filters()}<button className="directory-apply" onClick={() => dialog.current?.close()}>Voir les résultats</button></div></dialog>
  </>;
}
