"use client";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useNotifications } from "./NotificationProvider";
export default function NotificationBell({ professional = false }: { professional?: boolean }) {
  const { unread } = useNotifications();
  return <Link className={`nx-bell ${professional ? "pro-notification-button" : "cx-notification-link"}`} href={`${professional ? "/professionnel" : "/dashboard"}/notifications`} aria-label={`Notifications, ${unread} non lue${unread > 1 ? "s" : ""}`}><Bell size={19} strokeWidth={1.7}/>{unread > 0 && <span className="nx-bell-count" aria-hidden="true" key={unread}>{unread > 99 ? "99+" : unread}</span>}</Link>;
}
