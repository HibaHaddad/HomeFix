"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpRight, Check, CheckCheck, Copy, Droplets, LoaderCircle, MapPin, MessageSquare, PanelLeft, Pencil, Plus, ShieldCheck, Sparkles, Star, Trash2, Wind, Wrench, X, Zap } from "lucide-react";
import type { AssistantConversationList, AssistantConversationSummary, AssistantProfessional, AssistantThread } from "@/lib/assistant";
import { availabilityLabels } from "@/lib/directory-filters";
import { dateLabel } from "@/lib/client-domain";
import ContactButton from "./ContactButton";
import { priceLabel } from "./ProfessionalCard";
import styles from "./AssistantChat.module.css";

const prompts = [
  { icon: Droplets, label: "Une fuite d’eau", text: "J’ai une fuite d’eau sous mon évier. Comment comprendre d’où elle vient ?" },
  { icon: Wind, label: "Une clim en panne", text: "Mon climatiseur ne refroidit plus. Quelles sont les causes possibles ?" },
  { icon: Zap, label: "Un souci électrique", text: "Mon disjoncteur saute régulièrement. Que dois-je faire en toute sécurité ?" },
];
function Recommendation({ p }: { p: AssistantProfessional }) {
  return <article className={styles.proCard}>
    <div className={styles.proTop}><span className={styles.avatar} aria-hidden="true">{p.name.split(/\s+/).slice(0, 2).map((s) => s[0]).join("")}{p.hasPhoto && <img src={`/api/client/professionnels/${p.id}/photo`} alt="" loading="lazy" onError={(e) => { e.currentTarget.hidden = true; }}/>}</span><div><h3>{p.businessName || p.name}</h3>{p.businessName && <small>{p.name}</small>}<span>{p.specialty}</span></div><ShieldCheck size={18} aria-label="Professionnel approuvé"/></div>
    <div className={styles.proFacts}><span><MapPin size={13}/>{p.serviceCity || p.coveredAreas || "Zone à confirmer"}</span><span><Star size={13}/>{p.rating === null ? "Pas encore de note" : `${p.rating.toFixed(1)} / 5 · ${p.reviewCount} avis`}</span><span><Wrench size={13}/>{p.experienceYears === null ? p.experience || "Expérience non renseignée" : `${p.experienceYears} ans d’expérience`}</span></div>
    {p.match && <div className={styles.matchNotes}>{p.reasons.slice(1).map((reason) => <p key={reason} className={!p.match!.locationConfirmed || p.match!.budget === "OVER" ? styles.matchWarning : ""}>{reason}</p>)}</div>}
    <div className={styles.price}><div><small>Tarif indicatif</small><strong>{priceLabel(p)}</strong></div><span>{p.availability ? availabilityLabels[p.availability] || "À confirmer" : "Disponibilité à confirmer"}</span></div>
    <p className={styles.slot}>{p.nextSlot ? `Prochain créneau publié : ${dateLabel(p.nextSlot)}` : "Aucun créneau libre publié dans les 30 prochains jours."}<small>Prix final et rendez-vous à confirmer avec le professionnel.</small></p>
    <div className={styles.proActions}><Link href={`/dashboard/professionnels/${p.id}?retour=${encodeURIComponent("/dashboard/assistant")}`}>Voir profil <ArrowUpRight size={14}/></Link><ContactButton professionalId={p.id}/></div>
  </article>;
}
type ChatResponse = AssistantThread & AssistantConversationList;
const emptyThread = (enabled: boolean): AssistantThread => ({ id: null, messages: [], enabled });
const historyDate = (date: string) => new Intl.DateTimeFormat("fr-TN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Tunis" }).format(new Date(date));

export default function AssistantChat({ compact = false, active = true }: { compact?: boolean; active?: boolean }) {
  const [thread, setThread] = useState<AssistantThread>(emptyThread(false));
  const [conversations, setConversations] = useState<AssistantConversationSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [listBusy, setListBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const [showJump, setShowJump] = useState(false);
  const [editing, setEditing] = useState<{ kind: "rename" | "delete"; item: AssistantConversationSummary } | null>(null);
  const [title, setTitle] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const messageContent = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const mobileHistory = useRef<HTMLDialogElement>(null);
  const editDialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const loadVersion = useRef(0);
  const pinned = useRef(true);
  const restorePosition = useRef<number | "bottom" | null>("bottom");
  const scrollPositions = useRef(new Map<string, number>());
  const drafts = useRef(new Map<string, string>());
  const initialized = useRef(false);
  const inputId = compact ? "assistant-widget-message" : "assistant-message";
  const editTitleId = compact ? "assistant-widget-edit-title" : "assistant-edit-title";

  function receiveList(data: AssistantConversationList) {
    setConversations(data.conversations);
    setNextCursor(data.nextCursor);
  }
  async function request(path: string, options?: RequestInit) {
    const response = await fetch(path, { cache: "no-store", ...options });
    const data = await response.json();
    if (response.status === 429 || (response.status === 503 && response.headers.has("Retry-After"))) {
      setCooldown(Math.min(86400, Math.max(1, Number(response.headers.get("Retry-After")) || 60)));
    }
    if (!response.ok) throw new Error(data.error || "La demande n’a pas pu aboutir.");
    return data;
  }
  function rememberCurrent() {
    drafts.current.set(thread.id || "empty", draft);
    if (thread.id && viewport.current) scrollPositions.current.set(thread.id, viewport.current.scrollTop);
  }
  async function load(id?: string) {
    if (submitting.current) return;
    rememberCurrent();
    const version = ++loadVersion.current;
    setLoading(true); setError("");
    try {
      const data: ChatResponse = await request(
        id ? `/api/client/assistant?conversationId=${encodeURIComponent(id)}` : "/api/client/assistant",
        compact && !id ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create" }) } : undefined,
      );
      if (version !== loadVersion.current) return;
      restorePosition.current = data.id ? scrollPositions.current.get(data.id) ?? "bottom" : "bottom";
      setThread(data); receiveList(data);
      setDraft(drafts.current.get(data.id || "empty") || "");
      setCopied(null);
      mobileHistory.current?.close();
    } catch (e) {
      if (version === loadVersion.current) setError(e instanceof Error ? e.message : "Historique indisponible.");
    } finally { if (version === loadVersion.current) setLoading(false); }
  }
  useEffect(() => {
    if (!active) return;
    if (!compact || !initialized.current) { initialized.current = true; void load(); }
    else if (compact && !submitting.current) {
      if (thread.id || loading) void load(thread.id || undefined);
      else void request("/api/client/assistant?list=1").then(receiveList).catch(() => {});
    }
    return () => { loadVersion.current++; };
  }, [active]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown((v) => Math.max(0, v - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Keep the shell within the visible viewport, including the mobile keyboard.
  useEffect(() => {
    if (compact) return;
    const shell = root.current?.closest<HTMLElement>(".cx-main");
    if (!shell) return;
    const update = () => {
      shell.style.setProperty("--assistant-viewport", `${window.visualViewport?.height ?? window.innerHeight}px`);
      if (window.innerWidth > 900) mobileHistory.current?.close();
    };
    update();
    window.visualViewport?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    return () => {
      shell.style.removeProperty("--assistant-viewport");
      window.visualViewport?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
    };
  }, [compact]);
  useLayoutEffect(() => {
    const area = viewport.current;
    if (!area || loading) return;
    if (restorePosition.current !== null) {
      area.scrollTop = restorePosition.current === "bottom" ? area.scrollHeight : restorePosition.current;
      restorePosition.current = null;
      pinned.current = area.scrollHeight - area.scrollTop - area.clientHeight < 80;
    } else if (pinned.current) area.scrollTop = area.scrollHeight;
    setShowJump(area.scrollHeight - area.scrollTop - area.clientHeight >= 80);
  }, [thread.id, thread.messages.length, pending, loading, active]);
  useEffect(() => {
    const content = messageContent.current;
    if (!content) return;
    const observer = new ResizeObserver(() => {
      const area = viewport.current;
      if (area && pinned.current) area.scrollTop = area.scrollHeight;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (editing && !editDialog.current?.open) editDialog.current?.showModal();
  }, [editing]);

  function jumpToLatest() {
    pinned.current = true;
    viewport.current?.scrollTo({ top: viewport.current.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    setShowJump(false);
  }
  async function send() {
    const message = draft.trim();
    if (!message || loading || submitting.current || cooldown || actionBusy) return;
    submitting.current = true;
    pinned.current = true;
    setBusy(true); setPending(message); setError("");
    try {
      const data: ChatResponse = await request("/api/client/assistant", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, conversationId: thread.id }),
      });
      drafts.current.delete(thread.id || "empty");
      setThread(data); receiveList(data); setDraft("");
    } catch (e) { setError(e instanceof Error ? e.message : "Connexion interrompue. Réessayez."); }
    finally {
      setBusy(false); setPending(""); submitting.current = false;
      input.current?.focus({ preventScroll: true });
    }
  }
  async function newConversation() {
    if (submitting.current || loading || actionBusy) return;
    rememberCurrent();
    loadVersion.current++;
    restorePosition.current = "bottom"; pinned.current = true;
    setThread(emptyThread(thread.enabled)); setDraft(""); setCopied(null); setError("");
    mobileHistory.current?.close();
    input.current?.focus({ preventScroll: true });
  }
  async function loadMore() {
    if (!nextCursor || listBusy) return;
    setListBusy(true);
    try {
      const data: AssistantConversationList = await request(`/api/client/assistant?list=1&cursor=${encodeURIComponent(nextCursor)}`);
      setConversations((previous) => [...previous, ...data.conversations.filter((item) => !previous.some((p) => p.id === item.id))]);
      setNextCursor(data.nextCursor);
    } catch (e) { setError(e instanceof Error ? e.message : "Historique indisponible."); }
    finally { setListBusy(false); }
  }
  async function editConversation() {
    if (!editing || actionBusy) return;
    setActionBusy(true); setActionError("");
    try {
      const data = await request("/api/client/assistant", {
        method: editing.kind === "rename" ? "PATCH" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: editing.item.id, ...(editing.kind === "rename" ? { title } : {}) }),
      });
      receiveList(data);
      if (editing.kind === "delete") {
        drafts.current.delete(editing.item.id); scrollPositions.current.delete(editing.item.id);
        if (thread.id === editing.item.id) {
          restorePosition.current = "bottom";
          setThread(emptyThread(thread.enabled)); setDraft(""); setCopied(null);
        }
      } else if (thread.id === editing.item.id) setThread((current) => ({ ...current, title: data.title }));
      editDialog.current?.close(); setEditing(null);
    } catch (e) { setActionError(e instanceof Error ? e.message : "Modification impossible."); }
    finally { setActionBusy(false); }
  }
  async function copyDescription(text: string, key: string) {
    try { await navigator.clipboard.writeText(text); setCopied(key); }
    catch { setError("Sélectionnez la description pour la copier."); }
  }
  const controlsDisabled = busy || loading || actionBusy;
  const TitleTag = compact ? "h2" : "h1";
  function historyPanel(mobile = false) {
    return <>
      <div className={styles.historyHeading}><span><MessageSquare size={16}/> Conversations</span>{mobile && <button type="button" className={styles.iconButton} aria-label="Fermer les conversations" onClick={() => mobileHistory.current?.close()}><X size={18}/></button>}</div>
      <button type="button" className={styles.newChat} disabled={controlsDisabled} onClick={() => void newConversation()}><Plus size={16}/> Nouvelle conversation</button>
      <span className={styles.historyCaption}>VOTRE HISTORIQUE</span>
      <nav className={styles.historyList} aria-label="Anciennes conversations">
        {loading && !conversations.length ? <p className={styles.historyEmpty}>Chargement…</p> : !conversations.length ? <p className={styles.historyEmpty}>Vos conversations apparaîtront ici.</p> : conversations.map((item) => <div key={item.id} className={`${styles.historyItem} ${thread.id === item.id ? styles.selected : ""}`}>
          <button type="button" className={styles.threadButton} disabled={busy || actionBusy} aria-current={thread.id === item.id ? "true" : undefined} onClick={() => void load(item.id)} title={item.title}><span>{item.title}</span><time dateTime={item.updatedAt}>{historyDate(item.updatedAt)}</time></button>
          <div className={styles.threadActions}><button type="button" disabled={controlsDisabled} aria-label={`Renommer « ${item.title} »`} onClick={() => { setActionError(""); setTitle(item.title); setEditing({ kind: "rename", item }); }}><Pencil size={13}/></button><button type="button" disabled={controlsDisabled} aria-label={`Supprimer « ${item.title} »`} onClick={() => { setActionError(""); setEditing({ kind: "delete", item }); }}><Trash2 size={13}/></button></div>
        </div>)}
        {nextCursor && <button type="button" className={styles.moreHistory} disabled={listBusy || busy} onClick={() => void loadMore()}>{listBusy ? "Chargement…" : "Conversations plus anciennes"}</button>}
      </nav>
      <div className={styles.historyFooter}><ShieldCheck size={14}/><p>Vos échanges restent privés.<br/>Conservés pendant 30 jours d’inactivité.</p></div>
    </>;
  }

  return <div ref={root} className={`${styles.workspace} ${compact ? styles.compact : styles.fullPage}`} data-assistant-workspace>
    <aside className={styles.sidebar}>{historyPanel()}</aside>
    <dialog ref={mobileHistory} className={styles.mobileHistory} aria-label="Conversations" onClick={(e) => { if (e.target === e.currentTarget) mobileHistory.current?.close(); }}><div className={styles.mobileHistoryInner}>{historyPanel(true)}</div></dialog>
    <section className={styles.chat} aria-label="Conversation avec l’assistant HomeFix">
      <header className={styles.header}>
        <button type="button" className={styles.mobileToggle} aria-label="Ouvrir les conversations" aria-haspopup="dialog" onClick={() => mobileHistory.current?.showModal()}><PanelLeft size={19}/></button>
        <span className={styles.mark}><Sparkles size={19}/></span>
        <div className={styles.headerTitle}><TitleTag>Assistant IA <span>HomeFix TN</span></TitleTag><p>{thread.title || "Votre allié maison"}</p></div>
        <span className={styles.online}><i/> À votre écoute</span>
      </header>
      <div ref={viewport} className={styles.messages} role="log" aria-label="Historique des échanges" aria-live="polite" aria-busy={busy || loading} onScroll={() => {
        const area = viewport.current;
        if (!area) return;
        pinned.current = area.scrollHeight - area.scrollTop - area.clientHeight < 80;
        setShowJump(!pinned.current);
      }}>
        <div ref={messageContent} className={styles.messageContent}>
          {loading ? <div className={styles.loading}><LoaderCircle size={20} className={styles.spin}/> Chargement de la conversation…</div> : <>
            {!thread.messages.length && !pending && <div className={styles.welcome}>
              <span className={styles.orb}><Sparkles size={27}/></span><h2>Comment va votre maison ?</h2><p>Décrivez votre problème. Comprenons-le ensemble et trouvons le bon professionnel dans votre ville.</p>
              <div className={styles.prompts}>{prompts.map(({ icon: Icon, label, text }) => <button key={label} type="button" disabled={controlsDisabled} onClick={() => { setDraft(text); input.current?.focus({ preventScroll: true }); }}><Icon size={17}/><span>{label}</span><ArrowUpRight size={14}/></button>)}</div>
              <p className={styles.safetyNote}><ShieldCheck size={14}/> Gaz, fumée ou danger électrique : éloignez-vous et contactez les secours depuis un endroit sûr.</p>
            </div>}
            {thread.messages.map((m, i) => {
              const key = `${m.createdAt}-${i}`;
              return <article key={key} className={`${styles.message} ${m.role === "user" ? styles.user : styles.assistant}`}>
                <span className={styles.speaker}>{m.role === "user" ? "Vous" : <><Sparkles size={13}/> HomeFix Assistant</>}</span><div className={styles.bubble}>{m.text}</div>
                {m.analysis && <>
                  <div className={styles.tags}><span>{m.analysis.category}</span><span className={m.analysis.urgency === "URGENT" ? styles.urgent : ""}>{m.analysis.urgency === "URGENT" ? "Urgent · sécurité prioritaire" : m.analysis.urgency === "SOON" ? "À prévoir rapidement" : "Sans urgence identifiée"}</span></div>
                  <details className={styles.analysis}><summary>Description améliorée</summary><p>{m.analysis.description}</p><button type="button" onClick={() => void copyDescription(m.analysis!.description, key)}>{copied === key ? <Check size={13}/> : <Copy size={13}/>} {copied === key ? "Copiée" : "Copier la description"}</button></details>
                </>}
                {!!m.professionals?.length && <><p className={styles.resultsLabel}><CheckCheck size={15}/> Professionnels approuvés · données actualisées</p><div className={styles.results}>{m.professionals.map((p) => <Recommendation key={p.id} p={p}/>)}</div></>}
                {m.searched && !m.professionals?.length && <p className={styles.noResults}>Aucun profil de cette recherche n’est actuellement visible. <Link href="/dashboard/professionnels">Consulter l’annuaire</Link></p>}
              </article>;
            })}
            {pending && <><article className={`${styles.message} ${styles.user}`}><span className={styles.speaker}>Vous</span><div className={styles.bubble}>{pending}</div></article><div className={styles.thinking}><LoaderCircle size={15} className={styles.spin}/><span>Je regarde cela avec vous…</span></div></>}
          </>}
        </div>
      </div>
      <div className={styles.composerWrap}>
        {showJump && <button type="button" className={styles.jump} onClick={jumpToLatest}><ArrowDown size={15}/> Derniers messages</button>}
        {error && <div className={styles.error} role="alert">{error}<button type="button" onClick={() => void load(thread.id || undefined)} disabled={controlsDisabled}>Recharger</button></div>}
        {!loading && !thread.enabled && <p className={styles.notice}>L’assistant attend sa configuration. <Link href="/dashboard/professionnels">Consulter les professionnels</Link></p>}
        <form className={styles.composer} onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <label className={styles.srOnly} htmlFor={inputId}>Votre message à l’assistant</label>
          <textarea ref={input} id={inputId} rows={2} maxLength={3000} value={draft} disabled={controlsDisabled} onChange={(e) => setDraft(e.target.value)} placeholder="Posez votre question à HomeFix…" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}/>
          <div className={styles.composerBottom}><small>{cooldown ? `Nouvel envoi dans ${cooldown} s` : "Entrée pour envoyer · Maj + Entrée pour une nouvelle ligne"}</small><span>{draft.length}/3000</span><button type="submit" aria-label="Envoyer le message" disabled={controlsDisabled || !draft.trim() || !!cooldown}>{busy ? <LoaderCircle size={18} className={styles.spin}/> : <ArrowUp size={19}/>}</button></div>
        </form>
        <p className={styles.privacy}>HomeFix IA peut se tromper. Messages transmis à Google Gemini : évitez les données personnelles.</p>
      </div>
    </section>
    <dialog ref={editDialog} className={styles.editDialog} onCancel={(e) => { if (actionBusy) e.preventDefault(); }} onClose={() => setEditing(null)} aria-labelledby={editTitleId}>
      <form onSubmit={(e) => { e.preventDefault(); void editConversation(); }}>
        <h2 id={editTitleId}>{editing?.kind === "rename" ? "Renommer la conversation" : "Supprimer la conversation ?"}</h2>
        {editing?.kind === "rename" ? <label>Nouveau titre<input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={100} disabled={actionBusy}/></label> : <p>« {editing?.item.title} » et ses messages seront supprimés définitivement. Vos autres conversations seront conservées.</p>}
        {actionError && <p className={styles.error} role="alert">{actionError}</p>}
        <div className={styles.dialogActions}><button type="button" disabled={actionBusy} onClick={() => editDialog.current?.close()}>Annuler</button><button type="submit" disabled={actionBusy || (editing?.kind === "rename" && !title.trim())} className={editing?.kind === "delete" ? styles.dangerButton : ""}>{actionBusy ? "En cours…" : editing?.kind === "rename" ? "Enregistrer" : "Supprimer"}</button></div>
      </form>
    </dialog>
  </div>;
}
