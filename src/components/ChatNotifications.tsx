"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { chatCommand, getChatSocket } from "@/lib/chat-socket";
import type { ChatMessage } from "@/lib/chat-types";
import type { WorkspaceNotification } from "@/lib/notification-types";
import NotificationIcon from "@/components/notifications/NotificationIcon";
import { useNotifications } from "@/components/notifications/NotificationProvider";
type Notice = { kind: "message" | "intervention"; id: number; count: number; href: string; title: string; type: string };
export default function ChatNotifications({ userId, professional = false }: { userId: number; professional?: boolean }) {
  const router = useRouter(); const [notice, setNotice] = useState<Notice | null>(null);
  const { markRead } = useNotifications();
  const pathname = usePathname(); const path = useRef(pathname);
  const [refreshPending, startRefresh] = useTransition();
  const refreshState = useRef<{ pending: boolean; dirty: boolean; timer?: ReturnType<typeof setTimeout>; flush?: () => void }>({ pending: false, dirty: false });
  useEffect(() => {
    path.current = pathname;
    refreshState.current.dirty = false;
    clearTimeout(refreshState.current.timer);
  }, [pathname]);
  useEffect(() => {
    const state = refreshState.current; state.pending = refreshPending;
    if (!refreshPending && state.dirty && state.flush) { clearTimeout(state.timer); state.timer = setTimeout(state.flush, 350); }
  }, [refreshPending]);
  useEffect(() => {
    const socket = getChatSocket(); const seen = new Set<number>();
    let disposed = false;
    let connectedBefore = false;
    const state = refreshState.current;
    const scheduleRefresh = () => {
      // These pages update their own data over HTTP, without replacing RSC.
      if (["/dashboard/interventions", "/professionnel/reservations", "/dashboard/notifications", "/professionnel/notifications"].includes(path.current) || path.current.startsWith("/dashboard/paiements/")) return;
      state.dirty = true; clearTimeout(state.timer); state.timer = setTimeout(flush, 350);
    };
    const flush = () => {
      if (disposed || !state.dirty || state.pending) return;
      state.dirty = false; state.pending = true;
      startRefresh(() => router.refresh());
    };
    state.flush = flush;
    const synchronize = async () => {
      try {
        while (!disposed && socket.connected) {
          const pending = await chatCommand<{ id: number; requestId: number }[]>("chat:pending", {});
          if (!pending.length) break;
          const grouped = new Map<number, number[]>();
          for (const m of pending) grouped.set(m.requestId, [...(grouped.get(m.requestId) || []), m.id]);
          for (const [requestId, ids] of grouped) await chatCommand("chat:delivered", { requestId, ids });
          if (pending.length < 200) break;
        }
      } catch { /* Reconnection runs synchronization again. */ }
    };
    const receive = (message: ChatMessage) => {
      if (message.senderId === userId || seen.has(message.id)) return;
      seen.add(message.id); if (seen.size > 1000) seen.delete(seen.values().next().value!);
      void chatCommand("chat:delivered", { requestId: message.requestId, ids: [message.id] }).catch(() => {});
      setNotice((old) => ({ kind: "message", id: message.requestId, count: (old?.kind === "message" ? old.count : 0) + 1, title: "Nouveau message", type: message.attachments.length ? "ATTACHMENT" : "MESSAGE", href: `${professional ? "/professionnel" : "/dashboard"}/messagerie?demande=${message.requestId}` }));
      // Coalesce a workflow's message burst into one completed route refresh.
      scheduleRefresh();
    };
    const receiveNotification = (notification: WorkspaceNotification) => {
      const key = -notification.id;
      if (seen.has(key)) return;
      seen.add(key);
      setNotice({ kind: "intervention", id: notification.id, count: 1, title: notification.title, href: notification.href, type: notification.type });
      if (!path.current.endsWith("/messagerie")) scheduleRefresh();
    };
    const connect = () => { void synchronize(); if (connectedBefore) scheduleRefresh(); connectedBefore = true; };
    socket.on("connect", connect); socket.on("chat:message", receive); socket.on("notification:new", receiveNotification); socket.connect();
    if (socket.connected) connect();
    return () => { disposed = true; clearTimeout(state.timer); state.dirty = false; state.flush = undefined; socket.off("connect", connect); socket.off("chat:message", receive); socket.off("notification:new", receiveNotification); socket.disconnect(); };
  }, [userId, professional, router, startRefresh]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(null), 7000); return () => clearTimeout(timer); }, [notice]);
  return notice ? <aside className="rt-notification" role="status"><NotificationIcon type={notice.type} className="nx-toast-icon"/><Link href={notice.href} onClick={() => { if (notice.kind === "intervention") void markRead(notice.id).catch(() => {}); setNotice(null); }}>{notice.kind === "message" && notice.count > 1 ? `${notice.count} nouveaux messages` : notice.title}<small>{notice.type === "REVIEW_RECEIVED" ? "Voir les avis clients →" : notice.type === "PAYMENT_RECEIVED" && !professional ? "Voir le reçu →" : notice.kind === "intervention" ? "Voir le suivi de l’intervention →" : "Ouvrir la conversation →"}</small></Link><button aria-label="Fermer la notification" onClick={() => setNotice(null)}>×</button></aside> : null;
}
