"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Bell, Check, CheckCheck, LoaderCircle } from "lucide-react";
import type { NotificationRecord } from "@/lib/notification-types";
import { dateLabel } from "@/lib/client-domain";
import { useNotifications } from "./NotificationProvider";
import NotificationIcon, { notificationPresentation } from "./NotificationIcon";

type Reminder = { id: number; title: string; equipmentName: string; dueAt: string };
export default function NotificationsCenter({ reminders = [] }: { reminders?: Reminder[] }) {
  const { unread, revision, updateCount, markRead } = useNotifications();
  const [items, setItems] = useState<NotificationRecord[]>([]); const [cursor, setCursor] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true); const [more, setMore] = useState(false); const [error, setError] = useState(""); const [busy, setBusy] = useState<number | "all" | null>(null);
  const requestVersion = useRef(0);
  useEffect(() => {
    const controller = new AbortController(), version = ++requestVersion.current;
    setLoading(true);
    fetch(`/api/notifications?unread=${filter === "unread" ? 1 : 0}`, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      if (controller.signal.aborted || version !== requestVersion.current) return;
      setItems(data.notifications); setCursor(data.nextCursor); updateCount(data.unreadCount); setError("");
    }).catch((e) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Notifications indisponibles."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision, filter, updateCount]);
  async function read(id?: number) {
    if (busy !== null) return; setBusy(id || "all"); setError("");
    try { await markRead(id); setItems((old) => old.map((n) => !id || n.id === id ? { ...n, readAt: n.readAt || new Date().toISOString() } : n)); }
    catch (e) { setError(e instanceof Error ? e.message : "Lecture non enregistrée."); }
    finally { setBusy(null); }
  }
  return <section className="nx-center" aria-label="Centre de notifications"><header className="nx-center-heading"><div><span className="nx-eyebrow">VOTRE FIL D’ACTUALITÉ</span><h2>Gardons le fil.<span>{unread > 0 ? `${unread} non lue${unread > 1 ? "s" : ""}` : "Tout est à jour"}</span></h2></div><button type="button" className="nx-mark-all" disabled={!unread || busy !== null} onClick={() => void read()}><CheckCheck size={16}/>{busy === "all" ? "Enregistrement…" : "Tout marquer comme lu"}</button></header>
    <div className="nx-tabs" role="group" aria-label="Filtrer les notifications"><button aria-pressed={filter === "all"} className={filter === "all" ? "is-active" : ""} onClick={() => setFilter("all")}>Toutes</button><button aria-pressed={filter === "unread"} className={filter === "unread" ? "is-active" : ""} onClick={() => setFilter("unread")}>Non lues{unread > 0 && <span>{unread}</span>}</button><span className="nx-color-legend"><i/>Non lue<b/>Lue</span></div>
    {error && <p className="nx-error" role="alert">{error}</p>}
    {loading && !items.length ? <div className="nx-loading" role="status" aria-label="Chargement des notifications"><span/><span/><span/></div> : !items.length ? <div className="nx-empty"><span><Bell size={28} strokeWidth={1.5}/></span><h3>{filter === "unread" ? "Vous avez tout lu." : "Votre fil est à jour."}</h3><p>Les nouvelles de vos conversations et interventions apparaîtront ici.</p></div> : <div className="nx-list" aria-busy={loading}>{items.map((notification) => <article className={`nx-card ${notification.readAt ? "is-read" : "is-unread"}`} key={notification.id}>
      <NotificationIcon type={notification.type}/><div className="nx-card-body"><div className="nx-card-meta"><span className="nx-kind">{notificationPresentation(notification.type).label}</span><span className="nx-read-status">{notification.readAt ? <><Check size={11}/>Lue</> : <><i/>Non lue</>}</span></div><Link className="nx-card-link" href={notification.href} onClick={() => { if (!notification.readAt) void markRead(notification.id).catch(() => {}); }}>{notification.title}<ArrowUpRight size={13}/></Link><time dateTime={notification.createdAt}>{dateLabel(notification.createdAt)}</time></div>
      {!notification.readAt && <button className="nx-mark-one" disabled={busy !== null} onClick={() => void read(notification.id)} title="Marquer comme lue" aria-label={`Marquer comme lue : ${notification.title}`}>{busy === notification.id ? <LoaderCircle size={16} className="cx-spin"/> : <Check size={17}/>}</button>}
    </article>)}</div>}
    {cursor && <button className="nx-more" disabled={more || loading} onClick={async () => {
      const version = requestVersion.current; setMore(true);
      try { const response = await fetch(`/api/notifications?before=${cursor}&unread=${filter === "unread" ? 1 : 0}`, { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error); if (version !== requestVersion.current) return; setItems((old) => Array.from(new Map([...old, ...data.notifications].map((n: NotificationRecord) => [n.id, n])).values())); setCursor(data.nextCursor); updateCount(data.unreadCount); }
      catch { setError("Chargement interrompu. Réessayez."); } finally { setMore(false); }
    }}>{more ? "Chargement…" : "Voir les notifications précédentes"}</button>}
    {reminders.length > 0 && <div className="nx-reminders"><h3>Rappels d’entretien</h3>{reminders.map((reminder) => <Link className="nx-reminder" href="/dashboard/logement" key={reminder.id}><NotificationIcon type="REMINDER"/><div><strong>{reminder.title}</strong><p>{reminder.equipmentName} · {dateLabel(reminder.dueAt)}</p></div><ArrowUpRight size={15}/></Link>)}</div>}
  </section>;
}
