"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, CheckCheck, Eye, EyeOff, MoreHorizontal } from "lucide-react";
import AdminAction from "./AdminAction";

export default function AdminReviewActions({ reviewId, published, hidden, hasReports, requestId }: { reviewId: number; published: boolean; hidden: boolean; hasReports: boolean; requestId: number | null }) {
  const menuId = useId();
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  useEffect(() => {
    function closeOnScroll() {
      const popover = menu.current;
      if (popover?.matches(":popover-open") && !popover.querySelector("dialog[open]")) popover.hidePopover();
    }
    window.addEventListener("scroll", closeOnScroll, true);
    window.addEventListener("resize", closeOnScroll);
    return () => { window.removeEventListener("scroll", closeOnScroll, true); window.removeEventListener("resize", closeOnScroll); };
  }, []);
  return <div className="ar-actions">
    <button type="button" className="ar-menu-trigger" popoverTarget={menuId} aria-expanded={open} aria-label="Actions de modération" onClick={event => {
      const rect = event.currentTarget.getBoundingClientRect();
      const height = 61 + (hasReports ? 45 : 0) + (requestId ? 45 : 0);
      setPosition({ top: window.innerHeight - rect.bottom > height + 12 ? rect.bottom + 7 : Math.max(8, rect.top - height - 7), left: Math.max(8, Math.min(window.innerWidth - 242, rect.right - 230)) });
    }}><MoreHorizontal size={18}/></button>
    <div ref={menu} id={menuId} popover="auto" role="group" aria-label="Actions de modération" className="ar-action-popover" style={position} onToggle={event => setOpen((event.nativeEvent as ToggleEvent).newState === "open")}>
      <div className={`ar-menu-action${published ? " ar-menu-danger" : ""}`}>
        {published ? <EyeOff size={16}/> : <Eye size={16}/>}
        <AdminAction label={published ? "Masquer l’avis" : hidden ? "Republier l’avis" : "Publier l’avis"} endpoint={`/api/admin/avis/${reviewId}/moderation`} danger={published} payload={{ action: published ? "HIDE" : "PUBLISH" }} fields={[{ name: "reason", label: "Motif de la décision", type: "textarea" }]}/>
      </div>
      {hasReports && <div className="ar-menu-action"><CheckCheck size={16}/><AdminAction label="Classer les signalements" endpoint={`/api/admin/avis/${reviewId}/moderation`} payload={{ action: "DISMISS_REPORTS" }} fields={[{ name: "reason", label: "Motif du classement", type: "textarea" }]}/></div>}
      {requestId && <Link className="ar-menu-link" href={`/admin/demandes/${requestId}`}><ArrowUpRight size={16}/>Voir l’intervention</Link>}
    </div>
  </div>;
}
