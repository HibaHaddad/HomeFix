"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type IconName = "arrow" | "menu" | "close" | "check" | "pin" | "star" | "shield" | "message" | "calendar" | "spark" | "clock" | "wrench" | "bolt" | "snow" | "key" | "sofa" | "brush" | "sparkles" | "camera" | "send" | "chevron";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>, menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>, close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    check: <path d="m5 12 4 4L19 6" />, pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    star: <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.4l6.1-.9L12 3Z" />,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>, message: <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>, spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" /><path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14Z" /></>,
    clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>, wrench: <><path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4L14 13l-3-3 3.7-3.7Z" /></>,
    bolt: <path d="m13 2-3 9h7l-6 11 1-9H5l8-11Z" />, snow: <><path d="M12 2v20M4 7l16 10M4 17 20 7" /><path d="m12 2 2 2m-2-2-2 2M4 7l3-.4M4 7l1-3m15 13-1 3m1-3-3 .4M4 17l3 .4m-3-.4 1 3m15-13-1-3m1 3-3-.4M12 22l2-2m-2 2-2-2" /></>,
    key: <><circle cx="8" cy="15" r="5" /><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3" /></>, sofa: <><path d="M3 10V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4" /><path d="M2 14v-2a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2M4 14v4m16-4v4M4 18h16" /></>,
    brush: <><path d="m14 6 4 4M3 21l9.2-2.3L21 9l-6-6-9.7 9.7L3 21Z" /></>, sparkles: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14Z" /></>, camera: <><path d="M14 5h-4l-2 2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2-2Z" /><circle cx="12" cy="13" r="3" /></>, send: <><path d="m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13" /></>, chevron: <path d="m9 18 6-6-6-6" />,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

const services: { title: string; icon: IconName; color: string; price: string }[] = [
  { title: "Plomberie", icon: "wrench", color: "mint", price: "Dès 35 DT" }, { title: "Électricité", icon: "bolt", color: "peach", price: "Dès 40 DT" },
  { title: "Climatisation", icon: "snow", color: "blue", price: "Dès 50 DT" }, { title: "Serrurerie", icon: "key", color: "lavender", price: "Dès 30 DT" },
  { title: "Électroménager", icon: "spark", color: "yellow", price: "Dès 45 DT" }, { title: "Peinture", icon: "brush", color: "pink", price: "Sur devis" },
  { title: "Ménage", icon: "sparkles", color: "mint", price: "Dès 25 DT" }, { title: "Et bien plus", icon: "sofa", color: "peach", price: "Découvrir" },
];

const tabs = [
  { id: "profiles", label: "Profils vérifiés", title: "Le bon professionnel, en toute confiance.", copy: "Parcourez des profils détaillés, vérifiés et notés. Consultez les spécialités, les disponibilités et les avis avant de faire votre choix." },
  { id: "chat", label: "Chat & localisation", title: "Tout se précise dans la conversation.", copy: "Échangez photos et détails, partagez votre position exacte seulement avec les participants autorisés à votre chat." },
  { id: "quote", label: "Devis & accord", title: "Un prix discuté, un accord clair.", copy: "Comparez les propositions et échangez simplement sur le prix. Chaque montant est confirmé avec vous avant l’intervention." },
  { id: "tracking", label: "Suivi & rappels", title: "Gardez le fil, du début à la fin.", copy: "Suivez les étapes de votre demande et retrouvez vos rendez-vous, interventions et rappels d’entretien au même endroit." },
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>(".reveal");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -35px 0px" });

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);
  const tab = tabs[activeTab];
  return (
    <main id="top">
      <header className="site-header"><nav className="nav-wrap" aria-label="Navigation principale">
        <Link className="brand" href="/" aria-label="HomeFix TN, accueil"><span className="brand-mark"><Icon name="wrench" size={20} /></span><span>homefix<span className="brand-tn">.tn</span></span></Link>
        <button className="mobile-toggle" aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? "close" : "menu"} /></button>
        <div className={`nav-links ${menuOpen ? "is-open" : ""}`}>
          <a href="#services" onClick={() => setMenuOpen(false)}>Services</a><a href="#how" onClick={() => setMenuOpen(false)}>Comment ça marche</a><a href="#trust" onClick={() => setMenuOpen(false)}>Nos engagements</a>
          <div className="nav-actions"><Link className="login-link" href="/login">Connexion</Link><Link className="button button-dark button-small" href="/register">Trouver un pro <Icon name="arrow" size={16} /></Link></div>
        </div>
      </nav></header>

      <section className="hero section-shell">
        <div className="hero-copy reveal"><div className="eyebrow"><span className="eyebrow-dot" /> Les bons pros, tout près de vous</div>
          <h1>Un souci à la maison&nbsp;?<br /><span>On s’en occupe.</span></h1>
          <p className="hero-lede">Plomberie, électricité, climatisation… Trouvez un professionnel de confiance près de chez vous, simplement.</p>
          <div className="hero-actions"><Link href="/register" className="button button-dark">Trouver mon professionnel <Icon name="arrow" size={18} /></Link><a href="#how" className="button button-outline">Comment ça marche <span className="play-icon">▶</span></a></div>
          <div className="hero-proof"><div className="avatar-stack"><span>🌿</span><span>👨🏽‍🔧</span><span>👩🏻‍🔧</span></div><div><div className="proof-stars">★★★★★ <span>Des pros évalués par leurs clients</span></div><p>Votre maison entre de bonnes mains</p></div></div>
        </div>
        <div className="hero-visual reveal" aria-label="Illustration d’un intérieur accueillant avec interface HomeFix">
          <div className="hero-photo"><img src="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1400&q=85" alt="Salon lumineux et chaleureux" /><div className="photo-caption"><span className="caption-icon"><Icon name="pin" size={17} /></span><span><strong>Un service près de vous</strong><small>Disponible dans votre quartier</small></span></div></div>
          <div className="float-card pro-card"><div className="pro-avatar">👨🏽‍🔧<span className="online-dot" /></div><div className="pro-info"><strong>Yassine B.</strong><span><Icon name="check" size={13} /> Profil vérifié</span></div><div className="rating"><Icon name="star" size={14} /> 4,9</div></div>
          <div className="float-card appointment-card"><span className="appointment-icon"><Icon name="calendar" size={18} /></span><span><small>Prochain créneau</small><strong>Demain · 10 h 30</strong></span><Icon name="chevron" size={16} /></div>
          <div className="float-card quote-card"><span className="quote-check"><Icon name="check" size={15} /></span><span><small>Proposition reçue</small><strong>À partir de <b>45 DT</b></strong></span></div>
          <div className="hero-sparkle">✳</div>
        </div>
        <div className="hero-bottom"><span>Une solution pour chaque petit tracas</span><span className="hero-bottom-rule" /><span>Partout en Tunisie</span></div>
      </section>

      <section className="services-section" id="services"><div className="section-shell"><div className="section-heading reveal"><div><div className="eyebrow">Les services à portée de main</div><h2>La maison a besoin d’un coup de main&nbsp;?</h2></div><a className="text-link" href="#how">Tous les services <Icon name="arrow" size={17} /></a></div>
        <div className="services-grid">{services.map((service, i) => <a href="/register" className={`service-card reveal delay-${i % 4}`} key={service.title}><span className={`service-icon ${service.color}`}><Icon name={service.icon} size={23} /></span><strong>{service.title}</strong><span className="service-meta">{service.price}<Icon name="arrow" size={14} /></span></a>)}</div>
        <p className="price-note">Prix indicatifs, susceptibles de varier selon la nature de l’intervention. Le professionnel vous confirme son devis avant tout engagement.</p>
      </div></section>

      <section className="how-section section-shell" id="how"><div className="section-heading centered reveal"><div className="eyebrow">Simple comme bonjour</div><h2>De votre souci à la solution.</h2><p>Quatre étapes pour retrouver l’esprit tranquille.</p></div>
        <div className="steps-grid">{[
          ["01", "Décrivez le problème", "Expliquez ce qui se passe et ajoutez une photo si elle peut aider.", "message"], ["02", "Trouvez le bon pro", "Comparez les profils, les avis et les disponibilités près de chez vous.", "shield"], ["03", "Discutez & convenez", "Échangez dans le chat et mettez-vous d’accord sur le devis.", "send"], ["04", "Suivez l’intervention", "Choisissez un créneau et gardez le suivi de votre demande.", "calendar"],
        ].map(([num, title, copy, icon], i) => <article className="step-card reveal" key={num}><div className="step-top"><span className="step-number">{num}</span><span className="step-icon"><Icon name={icon as IconName} size={21} /></span></div><h3>{title}</h3><p>{copy}</p>{i < 3 && <span className="step-connector">→</span>}</article>)}</div>
      </section>

      <section className="showcase-section" id="features"><div className="section-shell showcase-layout"><div className="showcase-copy reveal"><div className="eyebrow">Un suivi vraiment simple</div><h2>Chaque détail compte.<br /><span>Tout est au même endroit.</span></h2><p>De la première photo au rendez-vous confirmé, HomeFix vous accompagne à chaque étape.</p>
          <div className="feature-tabs" role="tablist" aria-label="Fonctionnalités HomeFix">{tabs.map((item, i) => <button key={item.id} role="tab" aria-selected={activeTab === i} className={`feature-tab ${activeTab === i ? "active" : ""}`} onClick={() => setActiveTab(i)}><span className="tab-dot" />{item.label}<Icon name="chevron" size={17} /></button>)}</div>
          <div className="tab-description" role="tabpanel"><h3>{tab.title}</h3><p>{tab.copy}</p></div><Link href="/register" className="text-link">Découvrir HomeFix <Icon name="arrow" size={17} /></Link>
        </div><div className="dashboard-stage reveal"><div className="dashboard-card"><div className="dash-top"><span className="dash-brand"><span className="brand-mark tiny"><Icon name="wrench" size={13} /></span> homefix.tn</span><span className="dash-menu">•••</span></div><div className="dash-greeting"><div><small>ESPACE CLIENT</small><h3>Bonjour, Amira <span>☀️</span></h3></div><span className="dash-avatar">A</span></div><div className="request-card"><div className="request-head"><span className="request-tag"><i /> En cours</span><span className="request-date">Demande · 12 juin</span></div><h4>Fuite sous l’évier</h4><p>Plomberie <span>·</span> La Marsa</p><div className="request-progress"><span /><span /><span /><span /></div><div className="progress-labels"><span>Demande envoyée</span><b>Pro en route</b></div></div><div className="dash-pro"><div className="dash-pro-pic">👨🏽‍🔧</div><div className="dash-pro-text"><strong>Yassine Ben Ali <span className="verified-mini"><Icon name="check" size={10} /></span></strong><small>Plombier · <span>★ 4,9</span></small></div><button aria-label="Ouvrir la conversation"><Icon name="message" size={17} /></button></div><div className="chat-preview"><span className="chat-thumb"><Icon name="camera" size={16} /></span><span><small>Yassine · à l’instant</small><strong>Bien reçu, je regarde ça 👍</strong></span><span className="chat-unread">1</span></div><div className="privacy-note"><Icon name="shield" size={14} /> Votre adresse exacte reste privée</div></div><div className="dashboard-orb orb-one" /><div className="dashboard-orb orb-two" /><div className="side-note"><span><Icon name="clock" size={16} /></span><span>Rendez-vous confirmé<strong>Demain à 10 h 30</strong></span></div></div></div></section>

      <section className="ai-section section-shell"><div className="ai-card reveal"><div className="ai-copy"><div className="eyebrow"><span className="ai-spark"><Icon name="sparkles" size={14} /></span>Un petit coup de pouce</div><h2>Pas sûr de ce qu’il vous faut&nbsp;?</h2><p>Décrivez ce que vous observez. Notre assistant vous aide à mieux formuler votre demande et à trouver la bonne catégorie.</p><a className="button button-dark" href="/register">Essayer l’assistant <Icon name="arrow" size={17} /></a></div><div className="ai-chat"><div className="ai-chat-head"><span className="ai-avatar"><Icon name="sparkles" size={17} /></span><span><strong>Assistant HomeFix</strong><small>À votre écoute</small></span><span className="ai-online" /></div><div className="ai-bubble ai-user">J’ai de l’eau qui coule sous l’évier, surtout quand j’ouvre le robinet.</div><div className="ai-bubble ai-answer"><span className="ai-mini"><Icon name="sparkles" size={12} /></span><p>Il pourrait s’agir d’un joint ou d’un raccord à vérifier. Je vous suggère la catégorie <b>Plomberie</b>.</p><div className="ai-suggestion"><span className="service-icon mint"><Icon name="wrench" size={16} /></span><span><small>Catégorie suggérée</small><strong>Plomberie</strong></span><Icon name="check" size={16} /></div><small className="ai-disclaimer">Cette suggestion est indicative. Le professionnel confirmera le diagnostic.</small></div><div className="ai-input">Décrivez votre souci… <span><Icon name="send" size={15} /></span></div></div></div></section>

      <section className="trust-section" id="trust"><div className="section-shell"><div className="section-heading centered reveal"><div className="eyebrow">La confiance, simplement</div><h2>Vous gardez la main.<br /><span>À chaque étape.</span></h2><p>Des outils pensés pour vous aider à décider en toute sérénité.</p></div><div className="trust-grid">{[
        ["shield", "Des profils vérifiés", "Consultez les informations, spécialités et avis de chaque professionnel."], ["spark", "Des prix transparents", "Les prix affichés sont indicatifs. Le devis final est discuté avec vous."], ["star", "Des avis utiles", "Appuyez-vous sur les retours des clients pour choisir votre professionnel."], ["pin", "Votre adresse protégée", "Votre position exacte reste privée et n’est partageable qu’avec les participants autorisés à votre chat."],
      ].map(([icon, title, copy], i) => <article key={title} className="trust-card reveal"><span className={`trust-icon trust-${i}`}><Icon name={icon as IconName} size={22} /></span><h3>{title}</h3><p>{copy}</p></article>)}</div></div></section>

      <section className="cta-section section-shell"><div className="cta-card reveal"><div className="cta-decoration deco-a">✳</div><div className="cta-decoration deco-b">✳</div><div className="cta-copy"><div className="eyebrow">HomeFix TN · Tout près de vous</div><h2>Prêt à souffler<br />un peu&nbsp;?</h2><p>Votre prochain coup de main est à quelques clics.</p><div className="cta-actions"><Link href="/register" className="button button-white">Trouver un professionnel <Icon name="arrow" size={17} /></Link><Link href="/register" className="cta-pro-link">Vous êtes professionnel ? <span>Rejoignez HomeFix <Icon name="arrow" size={15} /></span></Link></div></div><div className="cta-illustration"><div className="cta-home">⌂</div><div className="cta-sun" /><div className="cta-plant">✳</div></div></div></section>

      <footer className="footer"><div className="section-shell"><div className="footer-main"><div className="footer-brand"><Link className="brand" href="/"><span className="brand-mark"><Icon name="wrench" size={20} /></span><span>homefix<span className="brand-tn">.tn</span></span></Link><p>Les bons pros pour une maison<br />qui va mieux. Partout en Tunisie.</p></div><div className="footer-col"><strong>Découvrir</strong><a href="#services">Nos services</a><a href="#how">Comment ça marche</a><a href="#trust">Nos engagements</a></div><div className="footer-col"><strong>Rejoindre HomeFix</strong><Link href="/register">Trouver un professionnel</Link><Link href="/register">Devenir partenaire</Link><Link href="/login">Connexion</Link></div><div className="footer-note"><span className="footer-flag">🇹🇳</span><span>Imaginé pour les maisons<br />et les familles de Tunisie.</span></div></div><div className="footer-bottom"><span>© 2025 HomeFix TN. Tous droits réservés.</span><span>Fait avec soin en Tunisie <b>✳</b></span><a href="#top" aria-label="Retour en haut">Retour en haut ↑</a></div></div></footer>
    </main>
  );
}
