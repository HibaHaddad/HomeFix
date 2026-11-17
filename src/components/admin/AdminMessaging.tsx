"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Search, MessagesSquare, LockKeyhole } from "lucide-react";
import type { AdminConversationSummary } from "@/lib/admin-messaging";
import AdminAutoFiltersForm from "./AdminAutoFiltersForm";
import AdminReviewAvatar from "./AdminReviewAvatar";
import AdminConversationChat from "./AdminConversationChat";

export default function AdminMessaging({ rows, selected, q, total, page, openThread }: { rows: AdminConversationSummary[]; selected: AdminConversationSummary | null; q: string; total: number; page: number; openThread: boolean }) {
  const pathname = usePathname();
  const [threadOpen, setThreadOpen] = useState(openThread);
  const listed = selected && !rows.some(row => row.id === selected.id) ? [selected, ...rows] : rows;
  const conversationId = Number(pathname.match(/^\/admin\/messagerie\/(\d+)\/?$/)?.[1]);
  const active = listed.find(row => row.id === conversationId) ?? selected;
  const pages = Math.max(1, Math.ceil(total / 20));
  const query = (p: number) => new URLSearchParams({ ...(q ? { q } : {}), page: String(p) }).toString();
  return <div className={`am-chat cx-chat rt-chat${threadOpen ? " rt-thread-open" : ""}`}>
    <aside className="cx-conversations" aria-label="Historique des conversations">
      <header><div><MessagesSquare size={19}/><h2>Conversations</h2></div><span>{total}</span></header>
      <AdminAutoFiltersForm action="/admin/messagerie" className="am-search"><Search size={17}/><input aria-label="Rechercher une conversation" type="search" name="q" defaultValue={q} maxLength={100} placeholder="Rechercher un nom, un sujet…"/></AdminAutoFiltersForm>
      <nav className="am-conversation-list">{listed.map(row => <Link key={row.id} prefetch={false} href={`/admin/messagerie/${row.id}?${query(page)}`} aria-current={active?.id === row.id ? "page" : undefined} onNavigate={event => {
        event.preventDefault();
        setThreadOpen(true);
        if (active?.id !== row.id) window.history.pushState(null, "", `/admin/messagerie/${row.id}?${query(page)}`);
      }}>
        <AdminReviewAvatar userId={row.client.id} name={row.client.name} hasPhoto={!!row.client.profilePhotoMime}/><div><strong>{row.client.name}</strong><span>{row.professional.businessName || row.professional.name}</span><small>{row.title}</small></div><time dateTime={row.updatedAt}>{new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Africa/Tunis" }).format(new Date(row.updatedAt))}</time>
      </Link>)}{!listed.length && <div className="am-list-empty"><Search size={25}/><strong>Aucune conversation</strong><p>{q ? "Essayez un autre nom ou sujet." : "Les conversations apparaîtront ici."}</p></div>}</nav>
      {total > 0 && <footer><span>Page {page} / {pages}</span><div>{page > 1 && <Link aria-label="Page précédente" href={`/admin/messagerie?${query(page - 1)}`}><ChevronLeft size={18}/></Link>}{page < pages && <Link aria-label="Page suivante" href={`/admin/messagerie?${query(page + 1)}`}><ChevronRight size={18}/></Link>}</div></footer>}
      <div className="am-sidebar-note"><LockKeyhole size={13}/>Consultations sécurisées et journalisées</div>
    </aside>
    {active ? <AdminConversationChat key={active.id} conversation={active} back={<button className="rt-back" aria-label="Retour aux conversations" onClick={() => setThreadOpen(false)}><ArrowLeft size={20}/></button>}/> : <section className="cx-chat-main"><div className="am-lock-state"><MessagesSquare size={40}/><h2>Vos conversations</h2><p>Sélectionnez une conversation pour consulter son historique.</p></div></section>}
  </div>;
}
