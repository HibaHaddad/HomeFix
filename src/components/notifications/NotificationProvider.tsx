"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getChatSocket } from "@/lib/chat-socket";
import type { NotificationReadEvent } from "@/lib/notification-types";

type NotificationData = { unread: number; revision: number; updateCount: (count: number) => void; markRead: (id?: number) => Promise<void> };
const Context = createContext<NotificationData | null>(null);
export function useNotifications() {
  const context = useContext(Context);
  if (!context) throw new Error("NotificationProvider manquant.");
  return context;
}
export default function NotificationProvider({ initialUnread, children }: { initialUnread: number; children: ReactNode }) {
  const [unread, setUnread] = useState(initialUnread); const [revision, setRevision] = useState(0);
  const updateCount = useCallback((count: number) => setUnread(count), []);
  const markRead = useCallback(async (id?: number) => {
    const response = await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(id ? { id } : { all: true }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || "Lecture non enregistrée.");
    setUnread(data.unreadCount); setRevision((value) => value + 1);
  }, []);
  useEffect(() => {
    const socket = getChatSocket(), controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>, connectedBefore = false, running = false, queued = false;
    const load = async () => {
      if (controller.signal.aborted) return;
      if (running) { queued = true; return; } running = true;
      try {
        const response = await fetch("/api/notifications?countOnly=1", { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (response.ok && !controller.signal.aborted) { setUnread(data.unreadCount); setRevision((value) => value + 1); }
      } catch { /* Keep the last known count; reconnect/focus retries. */ }
      finally { running = false; if (queued && !controller.signal.aborted) { queued = false; refresh(); } }
    };
    const refresh = () => { clearTimeout(timer); timer = setTimeout(() => void load(), 200); };
    const read = (event: NotificationReadEvent) => { setUnread(event.unreadCount); refresh(); };
    const connect = () => { if (connectedBefore) refresh(); connectedBefore = true; };
    socket.on("notification:new", refresh); socket.on("chat:message", refresh); socket.on("notifications:read", read); socket.on("connect", connect);
    if (socket.connected) connect();
    window.addEventListener("focus", refresh);
    return () => { controller.abort(); clearTimeout(timer); socket.off("notification:new", refresh); socket.off("chat:message", refresh); socket.off("notifications:read", read); socket.off("connect", connect); window.removeEventListener("focus", refresh); };
  }, []);
  return <Context.Provider value={{ unread, revision, updateCount, markRead }}>{children}</Context.Provider>;
}
