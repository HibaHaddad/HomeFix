"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity, ArrowRight, BriefcaseBusiness, Check, CheckCircle2, ClipboardList,
  Clock3, CreditCard, Eye, Flag, FolderKanban, LayoutDashboard, Link2,
  MessageSquareWarning, PieChart, RotateCcw, Save, SlidersHorizontal, Star, UserRound, Users,
} from "lucide-react";
import {
  dashboardKpis, dashboardWidgets, defaultDashboardPreferences,
  type DashboardPreferences, type DashboardKpiId, type DashboardWidgetId,
} from "@/lib/admin-dashboard-preferences";

const icons = {
  users: Users, client: UserRound, professional: BriefcaseBusiness, clock: Clock3,
  check: CheckCircle2, requests: ClipboardList, complaint: MessageSquareWarning,
  star: Star, money: CreditCard, flag: Flag, category: FolderKanban, chart: PieChart,
  activity: Activity, links: Link2,
};

function WidgetPreview({ kind }: { kind: (typeof dashboardWidgets)[number]["preview"] }) {
  return <div className={`adp-mini adp-mini-${kind}`} aria-hidden="true">
    {kind === "line" ? <svg viewBox="0 0 160 50" fill="none"><path d="M0 42H160M0 25H160M0 8H160" stroke="currentColor" opacity=".12"/><path d="M2 41 25 32 48 36 70 19 92 23 115 10 137 15 158 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      : kind === "donut" ? <><span className="adp-mini-ring"/><span className="adp-mini-legend"><i/><i/><i/></span></>
      : <><i/><i/><i/></>}
  </div>;
}

export default function AdminDashboardPreferences({ initialPreferences }: { initialPreferences: DashboardPreferences }) {
  const [selected, setSelected] = useState(initialPreferences);
  const [saved, setSaved] = useState(initialPreferences);
  const [busy, setBusy] = useState<"save" | "reset" | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState(false);
  const router = useRouter();
  const dirty = JSON.stringify(selected) !== JSON.stringify(saved);
  const selectedKpis = dashboardKpis.filter(item => selected.kpis.includes(item.id));
  const selectedWidgets = dashboardWidgets.filter(item => selected.widgets.includes(item.id));

  function toggleKpi(id: DashboardKpiId) {
    setSelected(current => ({ ...current, kpis: dashboardKpis.filter(item => item.id === id ? !current.kpis.includes(id) : current.kpis.includes(item.id)).map(item => item.id) }));
    setFeedback("");
  }

  function toggleWidget(id: DashboardWidgetId) {
    setSelected(current => ({ ...current, widgets: dashboardWidgets.filter(item => item.id === id ? !current.widgets.includes(id) : current.widgets.includes(item.id)).map(item => item.id) }));
    setFeedback("");
  }

  async function persist(mode: "save" | "reset") {
    if (busy) return;
    const preferences = mode === "reset" ? defaultDashboardPreferences() : selected;
    setBusy(mode); setFeedback(""); setError(false);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "DASHBOARD_PREFERENCES", value: preferences }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Enregistrement impossible.");
      setSelected(preferences); setSaved(preferences);
      setFeedback(mode === "reset" ? "La sélection par défaut a été rétablie et enregistrée." : "Vos préférences ont été enregistrées. Votre dashboard est à jour.");
      router.refresh();
    } catch (error) {
      setError(true);
      setFeedback(error instanceof Error ? error.message : "Connexion impossible. Réessayez.");
    } finally { setBusy(null); }
  }

  return <section className="aw-card adp-settings" id="personnaliser-dashboard" aria-labelledby="adp-title">
    <header className="adp-heading">
      <span className="adp-emblem" aria-hidden="true"><SlidersHorizontal size={23}/></span>
      <div><span className="admin-section-kicker">VOTRE ESPACE, VOS PRIORITÉS</span><h2 id="adp-title">Personnaliser mon dashboard</h2></div>
    </header>
    <form onSubmit={event => { event.preventDefault(); void persist("save"); }}>
      <div className="adp-layout">
        <div className="adp-options">
          <fieldset disabled={busy !== null} className="adp-fieldset">
            <legend><LayoutDashboard size={17} aria-hidden="true"/>Indicateurs clés <span>{selectedKpis.length}/{dashboardKpis.length}</span></legend>
            
            <div className="adp-kpi-options">
              {dashboardKpis.map(item => {
                const Icon = icons[item.icon];
                return <label className={`adp-choice${selected.kpis.includes(item.id) ? " is-selected" : ""}`} key={item.id}>
                  <input type="checkbox" name="kpis" value={item.id} checked={selected.kpis.includes(item.id)} onChange={() => toggleKpi(item.id)}/>
                  <Icon size={17} className="adp-choice-icon" aria-hidden="true"/>
                  <span className="adp-choice-copy"><strong>{item.label}</strong>{item.essential && <small>Essentiel</small>}</span>
                </label>;
              })}
            </div>
          </fieldset>
          <fieldset disabled={busy !== null} className="adp-fieldset">
            <legend><PieChart size={17} aria-hidden="true"/>Widgets du dashboard <span>{selectedWidgets.length}/{dashboardWidgets.length}</span></legend>
            <p className="adp-hint">Choisissez vos graphiques, votre suivi d’activité et vos raccourcis.</p>
            <div className="adp-widget-options">
              {dashboardWidgets.map(item => {
                const Icon = icons[item.icon];
                return <label className={`adp-choice adp-widget-choice${selected.widgets.includes(item.id) ? " is-selected" : ""}`} key={item.id}>
                  <div className="adp-widget-top"><Icon size={17} className="adp-choice-icon" aria-hidden="true"/><input type="checkbox" name="widgets" value={item.id} checked={selected.widgets.includes(item.id)} onChange={() => toggleWidget(item.id)}/></div>
                  <WidgetPreview kind={item.preview}/>
                  <span className="adp-choice-copy"><strong>{item.label}</strong><small>{item.description}</small></span>
                </label>;
              })}
            </div>
          </fieldset>
        </div>
        <aside className="adp-preview" aria-labelledby="adp-preview-title">
          <div className="adp-preview-heading"><Eye size={17} aria-hidden="true"/><h3 id="adp-preview-title">Aperçu de la disposition</h3></div>
          <p>La grille s’adapte à votre sélection. Les valeurs réelles restent sur votre dashboard.</p>
          <div className="adp-preview-canvas">
            <div className="adp-preview-banner"><LayoutDashboard size={18} aria-hidden="true"/><span>Mon dashboard HomeFix</span></div>
            {selectedKpis.length > 0 && <div className="adp-preview-kpis">{selectedKpis.map(item => {
              const Icon = icons[item.icon];
              return <div key={item.id}><Icon size={14} aria-hidden="true"/><span>{item.label}</span><strong aria-hidden="true">—</strong></div>;
            })}</div>}
            {selectedWidgets.length > 0 && <div className="adp-preview-widgets">{selectedWidgets.map(item => <div key={item.id}><span>{item.label}</span><WidgetPreview kind={item.preview}/></div>)}</div>}
            {selectedKpis.length === 0 && selectedWidgets.length === 0 && <p className="adp-preview-empty">Sélectionnez un indicateur ou un widget pour composer votre dashboard.</p>}
          </div>
          <span className="adp-preview-status"><Check size={14} aria-hidden="true"/>Conservé après actualisation et reconnexion</span>
          <Link href="/admin" className="admin-row-link">Voir mon dashboard <ArrowRight size={14}/></Link>
        </aside>
      </div>
      <footer className="adp-footer">
        <div className="adp-buttons"><button type="submit" className="admin-button admin-button-primary" disabled={busy !== null || !dirty}><Save size={16} aria-hidden="true"/>{busy === "save" ? "Enregistrement…" : "Enregistrer mes préférences"}</button><button type="button" className="admin-button admin-button-light" disabled={busy !== null} onClick={() => void persist("reset")}><RotateCcw size={15} aria-hidden="true"/>{busy === "reset" ? "Réinitialisation…" : "Réinitialiser par défaut"}</button></div>
        <span className="adp-save-state">{busy ? "Enregistrement en cours…" : dirty ? "Modifications non enregistrées" : "Sélection à jour"}</span>
      </footer>
      {feedback && <p className={error ? "admin-action-error" : "aw-note"} role={error ? "alert" : "status"}>{feedback}</p>}
    </form>
  </section>;
}
