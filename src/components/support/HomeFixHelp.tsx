"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, CircleHelp, ClipboardList, Headphones, LoaderCircle, Paperclip, RotateCcw, Send } from "lucide-react";
import styles from "./HomeFixHelp.module.css";
import { supportTopics, SUPPORT_FILE_LIMIT, SUPPORT_TOTAL_LIMIT, type SupportIntervention, type ClientSupportPage } from "@/lib/support-complaints";
import ClientComplaintHistory from "./ClientComplaintHistory";

export default function HomeFixHelp({ name, email, professional = false, initialIntervention = "", clientEnabled = false, initialRequestId, interventions = [], history }: { name: string; email: string; professional?: boolean; initialIntervention?: string; clientEnabled?: boolean; initialRequestId?: number; interventions?: SupportIntervention[]; history?: ClientSupportPage }) {
  const router = useRouter();
  const sending = useRef(false);
  const [type, setType] = useState(clientEnabled ? "complaint" : "help");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(initialRequestId ? "intervention" : "");
  const [requestId, setRequestId] = useState(initialRequestId ? String(initialRequestId) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const selected = interventions.find(item => String(item.id) === requestId);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clientEnabled || sending.current) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const files = values.getAll("files").filter((file): file is File => file instanceof File && file.size > 0);
    setError(""); setSuccess("");
    if (files.length > 3 || files.some(file => file.size > SUPPORT_FILE_LIMIT) || files.reduce((sum, file) => sum + file.size, 0) > SUPPORT_TOTAL_LIMIT) { setError("Joignez au maximum 3 fichiers de 5 Mo chacun, pour un total de 10 Mo."); return; }
    const body = new FormData();
    body.set("type", type); body.set("category", category); body.set("requestId", requestId); body.set("subject", String(values.get("subject") ?? "")); body.set("message", description);
    for (const file of files) body.append("files", file);
    sending.current = true; setBusy(true);
    try {
      const response = await fetch("/api/client/reclamations", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "L’envoi a échoué. Réessayez.");
      form.reset();
      setSuccess("Votre demande a bien été envoyée à l’équipe HomeFix. Vous pouvez suivre son traitement ci-dessous.");
      router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Connexion impossible. Votre message est conservé pour réessayer."); }
    finally { sending.current = false; setBusy(false); }
  }

  return <>
    <div className={professional ? "pro-page-heading" : "cx-heading"}><div><div className={professional ? "pro-eyebrow" : "cx-eyebrow"}><span />À VOTRE ÉCOUTE</div><h1>Aide & réclamations</h1><p>{clientEnabled ? "Une question ou un problème ? Adressez votre demande à l’équipe HomeFix." : "Une question ou un problème ? Préparez votre demande à l’équipe HomeFix."}</p></div></div>
    <section className={styles.panel} aria-labelledby="help-form-title">
      <header className={styles.header}><span><Headphones size={23} /></span><div><h2 id="help-form-title">Contacter HomeFix</h2><p>Décrivez votre situation pour nous aider à comprendre votre besoin.</p></div></header>
      <form method="post" action={clientEnabled ? "/api/client/reclamations" : undefined} encType="multipart/form-data" onSubmit={submit} onReset={() => { setType(clientEnabled ? "complaint" : "help"); setDescription(""); setCategory(initialRequestId ? "intervention" : ""); setRequestId(initialRequestId ? String(initialRequestId) : ""); setError(""); setSuccess(""); }} aria-busy={busy}>
        <fieldset disabled={busy} className={styles.formFields}>
        <fieldset className={styles.type}><legend>Votre demande</legend>
          <label className={type === "help" ? styles.selected : ""}><input type="radio" name="type" value="help" checked={type === "help"} onChange={() => setType("help")} /><CircleHelp size={19} /><span><strong>Demande d’aide</strong><small>Une question ou un accompagnement</small></span></label>
          <label className={type === "complaint" ? styles.selected : ""}><input type="radio" name="type" value="complaint" checked={type === "complaint"} onChange={() => setType("complaint")} /><ClipboardList size={19} /><span><strong>Réclamation</strong><small>Un problème à signaler</small></span></label>
        </fieldset>
        <div className={styles.fields}>
          <label><span>{professional ? "Nom professionnel" : "Nom complet"}</span><input name={clientEnabled ? undefined : "name"} value={name} readOnly autoComplete={professional ? "organization" : "name"} /></label>
          <label><span>Adresse e-mail</span><input type="email" name={clientEnabled ? undefined : "email"} value={email} readOnly autoComplete="email" /></label>
          <label><span>Catégorie <b>*</b></span><select name="category" required value={category} onChange={event => setCategory(event.target.value)}><option value="" disabled>Choisir une catégorie</option>{Object.entries(supportTopics).map(([value, label]) => <option key={value} value={value}>{professional && value === "payment" ? "Paiement ou revenus" : professional && value === "profile" ? "Profil professionnel" : professional && value === "review" ? "Avis client" : label}</option>)}</select></label>
          <label><span>Intervention concernée {clientEnabled && type === "complaint" && category === "intervention" ? <b>*</b> : <small>(facultatif)</small>}</span>{clientEnabled ? <><select name="requestId" value={requestId} onChange={event => setRequestId(event.target.value)} required={type === "complaint" && category === "intervention"}><option value="">{interventions.length ? "Choisir une intervention" : "Aucune intervention enregistrée"}</option>{interventions.map(item => <option key={item.id} value={item.id}>{item.title} · {item.professional}</option>)}</select>{selected && <small className={styles.selectionNote}>Professionnel concerné : {selected.professional}</small>}</> : <input name="intervention" maxLength={160} defaultValue={initialIntervention} placeholder="Nom ou référence de l’intervention"/>}</label>
          <label className={styles.wide}><span>Sujet <b>*</b></span><input name="subject" required minLength={clientEnabled ? 5 : 3} maxLength={clientEnabled ? 150 : 160} placeholder={type === "complaint" ? "Résumez le problème rencontré" : "Comment pouvons-nous vous aider ?"} /></label>
          <label className={styles.wide}><span>{type === "complaint" ? "Détails de la réclamation" : "Votre message"} <b>*</b></span><textarea name={clientEnabled ? "message" : "description"} required minLength={clientEnabled ? 20 : 10} maxLength={3000} rows={5} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Précisez les faits, la date et toute information utile pour comprendre votre situation." /><small className={styles.counter}>{description.length} / 3 000 caractères</small></label>
          {clientEnabled && <label className={styles.wide}><span><Paperclip size={13}/> Pièces jointes <small>(facultatif)</small></span><input type="file" name="files" multiple accept=".pdf,.jpg,.jpeg,.png"/><small className={styles.selectionNote}>PDF, JPG ou PNG · 3 fichiers maximum · 5 Mo par fichier, 10 Mo au total.</small></label>}
        </div>
        <footer className={styles.footer}><span>Les champs marqués d’un * sont obligatoires.</span><div><button type="reset"><RotateCcw size={14} />Effacer</button><button type="submit" disabled={busy || !clientEnabled}>{busy ? <LoaderCircle size={14} className={styles.spinner}/> : <Send size={14}/>} {busy ? "Envoi en cours…" : "Envoyer la demande"}</button></div></footer>
        </fieldset>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {success && <p className={styles.success} role="status"><CheckCheck size={18}/>{success}</p>}
      </form>
    </section>
    {clientEnabled && history && <ClientComplaintHistory key={JSON.stringify(history.items.map(item => [item.id, item.updatedAt]))} initialPage={history}/>}
  </>;
}
