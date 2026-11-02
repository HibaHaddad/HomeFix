"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { BadgeCheck, CalendarCheck2, Check, CircleCheck, Clock3, FileText, Send, Truck, Wrench, X } from "lucide-react";
import { getInterventionProgress, interventionSteps } from "@/lib/intervention-progress";

type TrackingRequest = Parameters<typeof getInterventionProgress>[0];
const icons = [Send, FileText, BadgeCheck, CalendarCheck2, Truck, Wrench, CircleCheck];

export default function InterventionJourney({ request, professionalName }: { request: TrackingRequest; professionalName: string }) {
  const progress = getInterventionProgress(request);
  const route = useRef<HTMLDivElement>(null); const avatar = useRef<HTMLDivElement>(null); const initialized = useRef(false);
  const move = useRef<(animate: boolean) => void>(() => {});
  const currentIndex = useRef(progress.index); currentIndex.current = progress.index;
  useLayoutEffect(() => {
    const container = route.current, actor = avatar.current;
    if (!container || !actor) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    function position(animate: boolean) {
      if (!container || !actor) return;
      const node = container.querySelector<HTMLElement>(`[data-step="${currentIndex.current}"] .ij-node`);
      if (!node) return;
      const bounds = container.getBoundingClientRect();
      const vertical = bounds.width < 600;
      container.dataset.layout = vertical ? "vertical" : "horizontal";
      // Read after setting layout, which may switch the route to a vertical list.
      const next = node.getBoundingClientRect();
      const x = vertical ? next.left - bounds.left - 66 : next.left - bounds.left + next.width / 2 - 27;
      const y = vertical ? next.top - bounds.top + next.height / 2 - 32 : next.top - bounds.top - 63;
      if (animate && initialized.current && !preference.matches) gsap.to(actor, { x, y, autoAlpha: 1, duration: .85, ease: "power3.inOut", overwrite: true });
      else gsap.set(actor, { x, y, autoAlpha: 1 });
      initialized.current = true;
    }
    move.current = position;
    position(false);
    const observer = new ResizeObserver(() => position(false)); observer.observe(container);
    const updatePreference = () => { gsap.killTweensOf(actor); position(false); };
    preference.addEventListener("change", updatePreference);
    return () => { observer.disconnect(); preference.removeEventListener("change", updatePreference); gsap.killTweensOf(actor); };
  }, []);
  useLayoutEffect(() => { move.current(true); }, [progress.index]);

  return <section className={`ij-journey${progress.stopped ? " is-stopped" : ""}${progress.finished ? " is-finished" : ""}`} aria-label="Parcours de l’intervention">
    <div className="ij-status-line"><span className="ij-section-label">LE PARCOURS DE VOTRE INTERVENTION</span><span className={`ij-current-label ${progress.stopped || ""}`} role="status">{progress.stopped ? <X size={13}/> : progress.finished ? <Check size={13}/> : <span className="ij-live-dot"/>}{progress.label}</span></div>
    <div className="ij-route" ref={route} style={{ "--ij-progress": `${progress.index / 6 * 100}%` } as React.CSSProperties}>
      <div className="ij-line" aria-hidden="true"><span/></div>
      <div ref={avatar} className={`ij-avatar${!progress.stopped && request.status === "EN_ROUTE" ? " is-travelling" : ""}`} role="img" aria-label={`${professionalName} · ${progress.label}`}>
        <ProfessionalAvatar/>
        <span className="ij-avatar-pin">{progress.stopped ? <X size={10}/> : progress.finished ? <Check size={10}/> : <Wrench size={10}/>}</span>
      </div>
      <ol className="ij-steps">{interventionSteps.map((label, index) => {
        const Icon = icons[index]; const done = index < progress.index || progress.finished;
        const current = index === progress.index;
        return <li key={label} data-step={index} data-state={done ? "done" : current ? "current" : "upcoming"} className="ij-step" aria-current={current ? "step" : undefined}>
          <span className="ij-node">{done ? <Check size={16}/> : <Icon size={16}/>}</span><span className="ij-step-copy"><strong>{label}</strong><small>{current && progress.stopped ? "Parcours arrêté" : done ? "Validée" : current ? "Étape actuelle" : "À venir"}</small></span>
        </li>;
      })}</ol>
    </div>
    <div className="ij-route-footer">{progress.stopped ? <><Clock3 size={13}/><span>Suivi arrêté à l’étape « {interventionSteps[progress.index]} ».</span></> : progress.finished ? <><CircleCheck size={14}/><span>Parcours terminé · intervention réalisée</span></> : <><span className="ij-step-count">{progress.index + 1}<span> / {interventionSteps.length}</span></span><span>étapes du parcours</span></>}</div>
  </section>;
}

function ProfessionalAvatar() {
  return <svg className="ij-character" viewBox="0 0 64 76" fill="none" aria-hidden="true"><ellipse cx="32" cy="72" rx="20" ry="3" fill="#234a3218"/><g className="ij-character-body"><path d="M19 50h12v17h-9l-3-17Z" fill="#234d3b"/><path d="M33 50h12l-3 17h-9V50Z" fill="#2e634a"/><path d="M21 65h11v5H19a2 2 0 0 1 2-5Z" fill="#183b30"/><path d="M34 65h8a4 4 0 0 1 4 4v1H34v-5Z" fill="#183b30"/><path d="M21 32h22l7 22H14l7-22Z" fill="#7ba36a"/><path d="M25 32v23m14-23v23" stroke="#d9e8c8" strokeWidth="4"/><rect x="14" y="44" width="36" height="12" rx="4" fill="#366d50"/><path d="m17 34-7 13m36-13 7 12" stroke="#7ba36a" strokeWidth="9" strokeLinecap="round"/><path d="m10 47 3 3m40-4-2 4" stroke="#e3aa80" strokeWidth="7" strokeLinecap="round"/><rect x="44" y="48" width="15" height="13" rx="3" fill="#c49345"/><path d="M48 48v-3h7v3" stroke="#9c7136" strokeWidth="2"/><path d="M24 21h16v8a8 8 0 0 1-16 0v-8Z" fill="#edbb93"/><path d="M26 20h12v4H26z" fill="#dba57e"/><path d="M18 20a14 14 0 0 1 28 0v4H18v-4Z" fill="#e4b75e"/><path d="M30 7h4v14h-4z" fill="#f5d68f"/><rect x="16" y="20" width="32" height="5" rx="2.5" fill="#c79740"/><circle cx="28" cy="28" r="1.2" fill="#34523c"/><circle cx="36" cy="28" r="1.2" fill="#34523c"/><path d="M29 32c2 2 4 2 6 0" stroke="#ae7856" strokeWidth="1.5" strokeLinecap="round"/><path d="m29 44 2 2 5-5" stroke="#e6efdd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></g></svg>;
}
