import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import "../auth-theme.css";

function BrandMark() {
  return <span className="register-brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4L14 13l-3-3 3.7-3.7Z" /></svg></span>;
}

export default function RegisterPage() {
  return (
    <main className="register-page">
      <div className="register-shell">
        <header className="register-header">
          <Link href="/" className="register-brand" aria-label="HomeFix, accueil"><BrandMark /><span>homefix</span></Link>
          <p>Déjà membre ? <Link href="/login">Se connecter <span aria-hidden="true">↗</span></Link></p>
        </header>
        <div className="register-content-grid">
          <div className="register-main-column">
            <div className="register-intro">
              <div className="register-eyebrow"><span /> Bienvenue chez HomeFix</div>
              <h1>Un coup de main<br /><span>commence ici.</span></h1>
              <p>Créez votre compte et retrouvez les bons services pour votre maison, en toute confiance.</p>
            </div>
            <section className="register-card" aria-labelledby="register-heading">
              <div className="register-card-heading"><div><h2 id="register-heading">Créer votre compte</h2><p>Quelques étapes simples pour commencer.</p></div><span className="register-card-sparkle" aria-hidden="true">✳</span></div>
              <AuthForm mode="register" />
            </section>
          </div>
          <aside className="register-aside" aria-label="Les avantages HomeFix">
            <div className="register-aside-label"><span /> HOMEFIX TN</div>
            <div className="register-home-illustration" aria-hidden="true"><span className="register-home-sun" /><span className="register-home-roof" /><span className="register-home-body"><i /><b /><em /></span><span className="register-home-plant"><i /><i /><b /></span><span className="register-home-sparkle">✳</span></div>
            <div className="register-aside-copy"><span>Tout près de vous</span><h2>Le bon pro.<br />La maison sereine.</h2><p>Les services du quotidien et des professionnels de confiance, réunis au même endroit.</p></div>
            <div className="register-aside-bottom">Pensé pour les maisons de Tunisie <b>✳</b></div>
          </aside>
        </div>
        <footer className="register-footer"><span><b aria-hidden="true">✳</b> Fait avec soin en Tunisie</span><span>Vos informations restent protégées</span></footer>
      </div>
    </main>
  );
}
