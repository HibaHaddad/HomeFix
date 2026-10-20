import Link from "next/link";
import AuthForm from "@/components/AuthForm";

function HomeFixMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4L14 13l-3-3 3.7-3.7Z" />
    </svg>
  );
}

function HomeIllustration() {
  return (
    <div className="login-visual" aria-label="Un intérieur chaleureux, entre de bonnes mains" role="img">
      <div className="login-visual-orb login-visual-orb-one" />
      <div className="login-visual-orb login-visual-orb-two" />
      <div className="login-window"><span /><span /><span /></div>
      <div className="login-room">
        <div className="login-room-wall">
          <div className="login-art"><span /></div>
          <div className="login-plant"><i /><i /><i /><b /></div>
        </div>
        <div className="login-sofa"><span /><i /><b /></div>
        <div className="login-table"><span /></div>
        <div className="login-rug" />
      </div>
      <div className="login-float-card login-trust-card"><span className="login-trust-icon"><HomeFixMark /></span><span><strong>Votre maison, bien entourée</strong><small>Des professionnels de confiance</small></span><span className="login-trust-check">✓</span></div>
      <div className="login-float-card login-rating-card"><span className="login-rating-stars">★★★★★</span><strong>4,9 <small>sur 5</small></strong></div>
      <span className="login-sparkle login-sparkle-one">✳</span><span className="login-sparkle login-sparkle-two">✳</span>
      <p className="login-visual-caption">Le confort de votre maison, à portée de main.</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="login-page">
      <div className="login-shell">
        <section className="login-panel" aria-labelledby="login-title">
          <Link href="/" className="login-brand" aria-label="HomeFix TN, accueil">
            <span className="login-brand-mark"><HomeFixMark /></span>
            <span>homefix<span className="login-brand-tn">.tn</span></span>
          </Link>

          <div className="login-content">
            <div className="login-eyebrow"><span /> Votre espace HomeFix</div>
            <h1 id="login-title">Ravi de vous<br /><span>revoir !</span></h1>
            <p className="login-intro">Connectez-vous pour retrouver vos demandes, vos rendez-vous et vos professionnels préférés.</p>
            <AuthForm mode="login" />
            <p className="login-signup">Vous n’avez pas encore de compte ? <Link href="/register">Créer un compte <span aria-hidden="true">↗</span></Link></p>
          </div>

          <p className="login-footer"><span aria-hidden="true">✳</span> Fait avec soin en Tunisie</p>
        </section>

        <aside className="login-aside" aria-label="Bienvenue chez HomeFix TN">
          <div className="login-aside-top"><span>HOMEFIX TN</span><span><i /> À vos côtés, partout en Tunisie</span></div>
          <HomeIllustration />
          <div className="login-aside-copy"><span className="login-aside-kicker">Votre maison entre de bonnes mains</span><h2>Le bon coup de main,<br /><span>au bon moment.</span></h2><p>Un réseau de pros de confiance pour prendre soin de votre chez-vous, tout simplement.</p></div>
          <div className="login-aside-bottom"><span>Un service pensé pour vous</span><span className="login-aside-line" /><span>Depuis chez vous, en confiance</span></div>
        </aside>
      </div>
    </main>
  );
}
