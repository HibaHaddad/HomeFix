"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Maximize2, Sparkles, X } from "lucide-react";
import AssistantChat from "./AssistantChat";
import styles from "./FloatingAssistant.module.css";

export default function FloatingAssistant() {
  const pathname = usePathname();
  const onAssistantPage = pathname.replace(/\/+$/, "") === "/dashboard/assistant";
  const [open, setOpen] = useState(false);
  const visible = open && !onAssistantPage;
  const [mounted, setMounted] = useState(false);
  const [chatSession, setChatSession] = useState(0);
  const launcher = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const widget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;
    const update = () => {
      const view = window.visualViewport;
      widget.current?.style.setProperty("--widget-viewport", `${view?.height ?? window.innerHeight}px`);
      widget.current?.style.setProperty("--widget-keyboard", `${view ? Math.max(0, window.innerHeight - view.height - view.offsetTop) : 0}px`);
    };
    update();
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      widget.current?.style.removeProperty("--widget-keyboard");
    };
  }, [visible]);

  function close() {
    setOpen(false);
    launcher.current?.focus({ preventScroll: true });
  }
  function toggle() {
    if (open) { close(); return; }
    setChatSession((session) => session + 1);
    setMounted(true); setOpen(true);
    requestAnimationFrame(() => closeButton.current?.focus({ preventScroll: true }));
  }
  return <div ref={widget} className={styles.widget} hidden={onAssistantPage}>
    {mounted && <section id="homefix-floating-assistant" className={styles.panel} hidden={!visible} role="dialog" aria-modal="false" aria-label="Chat avec l’assistant HomeFix" onKeyDown={(event) => { if (event.key === "Escape" && !event.defaultPrevented && !(event.target as HTMLElement).closest("dialog")) { event.preventDefault(); close(); } }}>
      <div className={styles.controls}><Link href="/dashboard/assistant" aria-label="Ouvrir l’assistant en grand" title="Ouvrir en grand" onClick={close}><Maximize2 size={16}/></Link><button ref={closeButton} type="button" aria-label="Réduire le chat assistant" title="Réduire" onClick={close}><X size={18}/></button></div>
      <AssistantChat key={chatSession} compact active={visible}/>
    </section>}
    <button ref={launcher} type="button" className={`${styles.launcher} ${open ? styles.isOpen : ""}`} onClick={toggle} aria-label={open ? "Réduire l’assistant IA" : "Ouvrir l’assistant IA HomeFix"} aria-expanded={open} aria-controls={mounted ? "homefix-floating-assistant" : undefined} aria-haspopup="dialog" title="Assistant IA HomeFix"><Sparkles size={25} strokeWidth={1.7}/><span>IA</span></button>
  </div>;
}
