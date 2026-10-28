"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { storyIds, useHouseStory } from "@/components/landing/useHouseStory";
import type { HouseSceneState } from "@/components/landing/scene-state";
import "./landing.css";

const HouseWorld = dynamic(() => import("@/components/landing/HouseWorld"), {
  ssr: false,
  loading: () => <div className="hf-world hf-world-loading" aria-hidden="true"><span>Une maison pleine de possibilités.</span></div>,
});
const chapters = ["Bienvenue chez vous", "Une maison, tous les métiers", "Plomberie", "Électricité", "Climatisation", "Comment ça marche", "L’esprit tranquille"];
const services = [
  ["Plomberie", "Dès 35 DT"], ["Électricité", "Dès 40 DT"], ["Climatisation", "Dès 50 DT"], ["Serrurerie", "Dès 30 DT"],
  ["Électroménager", "Dès 45 DT"], ["Peinture", "Sur devis"], ["Ménage", "Dès 25 DT"], ["Et bien plus", "Découvrir"],
];
const steps = [
  ["01", "Trouvez votre professionnel", "Décrivez votre souci avec une photo et comparez les profils vérifiés."],
  ["02", "Demandez votre devis", "Échangez dans le chat et convenez d’un prix avant toute intervention."],
  ["03", "Réservez votre créneau", "Choisissez ensemble le moment qui vous convient. Tout simplement."],
  ["04", "Suivez l’intervention", "Retrouvez vos rendez-vous, vos échanges et vos rappels au même endroit."],
];
const interventions = [
  { id: "plomberie", room: "La salle de bain", service: "Plomberie", title: "Une fuite ?", accent: "Pas de panique.", copy: "Un joint fatigué, un raccord capricieux, un robinet qui n’en fait qu’à sa tête. Trouvez le professionnel qui remet tout dans le bon sens.", price: "35", action: "Un coup de main en plomberie", note: "Le souci est entre de bonnes mains." },
  { id: "electricite", room: "La pièce à vivre", service: "Électricité", title: "Et la lumière", accent: "revient.", copy: "Une prise à remplacer, une installation à vérifier, une panne à comprendre. Faites appel à un professionnel, et retrouvez l’esprit tranquille.", price: "40", action: "Trouver mon électricien", note: "Le savoir-faire qui change tout." },
  { id: "climatisation", room: "Le salon", service: "Climatisation", title: "Soufflez.", accent: "Pour de bon.", copy: "Un air plus frais, une maison plus douce. Entretien, dépannage ou réparation : trouvez un technicien à la hauteur de votre confort.", price: "50", action: "Trouver mon technicien", note: "Le confort reprend sa place." },
];
function Arrow({ down = false }: { down?: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className={down ? "hf-arrow is-down" : "hf-arrow"}><path d="M5 19 19 5M5 5h14v14" stroke="currentColor" strokeWidth="1.5" /></svg>;
}
function Brand() {
  return <Link href="/" className="hf-brand" aria-label="HomeFix, accueil"><span className="hf-brand-mark"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4L14 13l-3-3 3.7-3.7Z" /></svg></span><span>homefix</span></Link>;
}
function Action({ children = "Trouver mon professionnel" }: { children?: React.ReactNode }) {
  return <Link href="/register" className="hf-button"><span>{children}</span><span className="hf-button-icon"><Arrow /></span></Link>;
}
function ChapterLabel({ number, children }: { number: string; children: React.ReactNode }) { return <div className="hf-kicker"><span>{number}</span>{children}</div>; }

export default function Home() {
  const page = useRef<HTMLElement>(null);
  const journey = useRef<HTMLDivElement>(null);
  const scene = useRef<HouseSceneState>({ progress: 0, reduced: false, paused: false, pointer: [0, 0] });
  const [active, setActive] = useState(0);
  const [menu, setMenu] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { setReduced(media.matches); scene.current.reduced = media.matches; scene.current.invalidate?.(); };
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useHouseStory(page, journey, scene, reduced, setActive);

  return <main ref={page} className={`hf-experience ${reduced ? "hf-reduced" : ""}`} id="top" onPointerMove={event => { if (event.pointerType === "mouse") scene.current.pointer = [event.clientX / window.innerWidth - 0.5, 0.5 - event.clientY / window.innerHeight]; }}>
    <a className="hf-skip" href="#services">Accéder aux services</a>
    <header className="hf-header"><Brand />
      <nav aria-label="Navigation principale" className={menu ? "hf-nav is-open" : "hf-nav"} id="hf-navigation"><a href="#services" onClick={() => setMenu(false)}>La maison</a><a href="#how" onClick={() => setMenu(false)}>Comment ça marche</a><a href="#trust" onClick={() => setMenu(false)}>Nos engagements</a></nav>
      <div className="hf-header-actions"><Link className="hf-login" href="/login">Connexion</Link><Link href="/register" className="hf-nav-cta">Trouver un pro <Arrow /></Link><button className="hf-menu-toggle" aria-label={menu ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={menu} aria-controls="hf-navigation" onClick={() => setMenu(!menu)}>{menu ? "✕" : <><span /><span /></>}</button></div><div className="hf-reading-progress" aria-hidden="true" />
    </header>
    <div className="hf-journey" ref={journey}>
      <div className="hf-stage">
      <HouseWorld state={scene} reduced={reduced} paused={paused} />
      <div className="hf-panels">
      <section tabIndex={-1} className="hf-chapter hf-hero" aria-labelledby="hf-hero-title"><div className="hf-chapter-copy hf-hero-copy"><ChapterLabel number="✳">Votre maison mérite mieux.</ChapterLabel><h1 id="hf-hero-title">Un souci <br /><span className="hf-home-line">à la maison<span className="hf-question">&nbsp;?</span></span><em>On s’en occupe.</em></h1><Action /><div className="hf-hero-proof"><span className="hf-proof-seal">✓</span><span>Des profils vérifiés.<br /><b>De vraies personnes, tout près de vous.</b></span></div></div></section>
      <section tabIndex={-1} className="hf-chapter hf-discovery" id="services" aria-labelledby="hf-discovery-title"><div className="hf-chapter-copy"><ChapterLabel number="01">Entrez, on vous fait visiter.</ChapterLabel><h2 id="hf-discovery-title">Une maison.<br /><em>Mille solutions.</em></h2><p>Du robinet qui goutte au climatiseur qui fait des siennes : chaque pièce a son expert.</p><div className="hf-service-directory">{services.map(([name, price], i) => <Link href="/register" key={name}><span className="hf-service-number">{String(i + 1).padStart(2, "0")}</span><span>{name}</span><small>{price}</small><Arrow /></Link>)}</div><p className="hf-price-note">Prix indicatifs. Le professionnel confirme son devis avant tout engagement.</p></div></section>
      {interventions.map((item, i) => <section tabIndex={-1} className="hf-chapter hf-service-chapter" id={item.id} key={item.id} aria-labelledby={`hf-title-${item.id}`}><div className="hf-chapter-copy"><ChapterLabel number={String(i + 2).padStart(2, "0")}>{item.room} · {item.service}</ChapterLabel><h2 id={`hf-title-${item.id}`}>{item.title}<br /><em>{item.accent}</em></h2><p>{item.copy}</p><div className="hf-service-detail"><span>{item.service}</span><b>Dès {item.price} <small>DT</small></b></div><Action>{item.action}</Action><span className="hf-service-footnote">Un devis discuté ensemble. Une intervention en confiance.</span></div></section>)}
      <section tabIndex={-1} className="hf-chapter hf-how" id="how" aria-labelledby="hf-how-title"><div className="hf-chapter-copy"><ChapterLabel number="05">Vous gardez la main.</ChapterLabel><h2 id="hf-how-title">Tout s’assemble.<br /><em>Simplement.</em></h2><div className="hf-steps">{steps.map(([number, title, copy], i) => <details name="hf-process" key={number} open={i === 0}><summary><span>{number}</span><strong>{title}</strong><span className="hf-step-plus" aria-hidden="true">+</span></summary><p>{copy}</p></details>)}</div><Link href="/register" className="hf-text-link">Découvrir HomeFix <Arrow /></Link></div></section>
      <section tabIndex={-1} className="hf-chapter hf-finale" id="trust" aria-labelledby="hf-finale-title"><div className="hf-chapter-copy"><ChapterLabel number="06">Home sweet HomeFix.</ChapterLabel><h2 id="hf-finale-title">La maison va mieux.<br /><em>Vous aussi.</em></h2><p>Votre prochain coup de main est à quelques clics.<br />Et si on commençait par vous simplifier la vie ?</p><Action /><div className="hf-promises"><span>✓ Profils vérifiés</span><span>✓ Prix discutés ensemble</span><span>✓ Avis utiles</span><span>✓ Adresse exacte protégée</span></div><Link href="/register" className="hf-partner">Vous êtes professionnel ? <b>Rejoignez HomeFix <Arrow /></b></Link></div></section>
      </div>
      <div className="hf-story-toolbar">
        <div className="hf-chapter-indicator"><span>{String(active + 1).padStart(2, "0")} / 07</span><span>{chapters[active]}</span></div>
        <nav className="hf-story-nav" aria-label="Parcourir les chapitres">{storyIds.map((id, i) => <a href={`#${id}`} key={id} aria-label={chapters[i]} aria-current={active === i ? "step" : undefined}><span>{String(i + 1).padStart(2, "0")}</span></a>)}</nav>
        <button className="hf-pause" onClick={() => setPaused(!paused)} aria-pressed={paused} aria-label={paused ? "Reprendre les animations" : "Mettre en pause les animations"}><span aria-hidden="true">{paused ? "\u25b7" : "\u2161"}</span>{paused ? "Reprendre" : "Pause"}</button>
      </div>
      </div>
    </div>
    <footer className="footer">
      <div className="section-shell">
        <div className="footer-main">
          <div className="footer-brand"><Brand /><p>Les bons pros pour une maison<br />qui va mieux. Partout en Tunisie.</p></div>
          <div className="footer-col"><strong>Découvrir</strong><a href="#services">Nos services</a><a href="#how">Comment ça marche</a><a href="#trust">Nos engagements</a></div>
          <div className="footer-col"><strong>Rejoindre HomeFix</strong><Link href="/register">Trouver un professionnel</Link><Link href="/register">Devenir partenaire</Link><Link href="/login">Connexion</Link></div>
          <div className="footer-note"><span className="footer-flag">🇹🇳</span><span>Imaginé pour les maisons<br />et les familles de Tunisie.</span></div>
        </div>
        <div className="footer-bottom"><span>© 2026 HomeFix. Tous droits réservés.</span><span>Fait avec soin en Tunisie <b>✳</b></span><a href="#top" aria-label="Retour en haut">Retour en haut ↑</a></div>
      </div>
    </footer>
  </main>;
}
