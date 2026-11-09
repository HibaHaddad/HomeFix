"use client";

import { useState } from "react";
import { CircleHelp, ClipboardList, Headphones, RotateCcw, Send } from "lucide-react";
import styles from "./HomeFixHelp.module.css";

export default function HomeFixHelp({ name, email, professional = false, initialIntervention = "" }: { name: string; email: string; professional?: boolean; initialIntervention?: string }) {
  const [type, setType] = useState("help");
  const [description, setDescription] = useState("");

  return <>
    <div className={professional ? "pro-page-heading" : "cx-heading"}><div><div className={professional ? "pro-eyebrow" : "cx-eyebrow"}><span />À VOTRE ÉCOUTE</div><h1>Aide & réclamations</h1><p>Une question ou un problème ? Préparez votre demande à l’équipe HomeFix.</p></div></div>
    <section className={styles.panel} aria-labelledby="help-form-title">
      <header className={styles.header}><span><Headphones size={23} /></span><div><h2 id="help-form-title">Contacter HomeFix</h2><p>Décrivez votre situation pour nous aider à comprendre votre besoin.</p></div></header>
      <form onSubmit={(event) => event.preventDefault()} onReset={() => { setType("help"); setDescription(""); }}>
        <fieldset className={styles.type}><legend>Votre demande</legend>
          <label className={type === "help" ? styles.selected : ""}><input type="radio" name="type" value="help" checked={type === "help"} onChange={() => setType("help")} /><CircleHelp size={19} /><span><strong>Demande d’aide</strong><small>Une question ou un accompagnement</small></span></label>
          <label className={type === "complaint" ? styles.selected : ""}><input type="radio" name="type" value="complaint" checked={type === "complaint"} onChange={() => setType("complaint")} /><ClipboardList size={19} /><span><strong>Réclamation</strong><small>Un problème à signaler</small></span></label>
        </fieldset>
        <div className={styles.fields}>
          <label><span>{professional ? "Nom professionnel" : "Nom complet"}</span><input name="name" value={name} readOnly autoComplete={professional ? "organization" : "name"} /></label>
          <label><span>Adresse e-mail</span><input type="email" name="email" value={email} readOnly autoComplete="email" /></label>
          <label><span>Catégorie <b>*</b></span><select name="category" required defaultValue=""><option value="" disabled>Choisir une catégorie</option><option value="intervention">Intervention ou réservation</option><option value="payment">{professional ? "Paiement ou revenus" : "Paiement ou facture"}</option><option value="profile">{professional ? "Profil professionnel" : "Mon compte"}</option><option value="review">{professional ? "Avis client" : "Avis"}</option><option value="technical">Problème technique</option><option value="other">Autre sujet</option></select></label>
          <label><span>Intervention concernée <small>(facultatif)</small></span><input name="intervention" maxLength={160} defaultValue={initialIntervention} placeholder="Nom ou référence de l’intervention" /></label>
          <label className={styles.wide}><span>Sujet <b>*</b></span><input name="subject" required minLength={3} maxLength={160} placeholder={type === "complaint" ? "Résumez le problème rencontré" : "Comment pouvons-nous vous aider ?"} /></label>
          <label className={styles.wide}><span>{type === "complaint" ? "Détails de la réclamation" : "Votre message"} <b>*</b></span><textarea name="description" required minLength={10} maxLength={3000} rows={5} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Précisez les faits, la date et toute information utile pour comprendre votre situation." /><small className={styles.counter}>{description.length} / 3 000 caractères</small></label>
        </div>
        <footer className={styles.footer}><span>Les champs marqués d’un * sont obligatoires.</span><div><button type="reset"><RotateCcw size={14} />Effacer</button><button type="submit" disabled><Send size={14} />Envoyer la demande</button></div></footer>
      </form>
    </section>
  </>;
}
