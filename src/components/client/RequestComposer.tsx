"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Camera, ClipboardList, Sparkles, Check, LoaderCircle } from "lucide-react";
import { categories } from "@/lib/client-domain";
import type { WorkspaceData } from "@/app/lib/client-workspace";
import { workspaceAction } from "./WorkspaceForm";
export default function RequestComposer({ equipment, address, aiEnabled }: { equipment: WorkspaceData["equipment"]; address: string; aiEnabled: boolean }) {
  const router = useRouter(); const [message, setMessage] = useState(""); const [category, setCategory] = useState("Plomberie"); const [busy, setBusy] = useState(false); const [aiBusy, setAiBusy] = useState(false); const [feedback, setFeedback] = useState(""); const [createdId, setCreatedId] = useState<number | null>(null); const [files, setFiles] = useState<File[]>([]); const [uploaded, setUploaded] = useState<string[]>([]);
  return <section className="cx-panel cx-composer" id="nouvelle"><div className="cx-panel-title"><span className="cx-icon-tile"><ClipboardList size={20}/></span><div><h2>Décrivez votre besoin</h2><p>Les bonnes informations pour une intervention réussie.</p></div><span className="cx-step">ÉTAPE 01 / VOTRE PROJET</span></div>
    <form className="cx-form" onSubmit={async (e) => {
      e.preventDefault(); if (busy) return; setBusy(true); setFeedback("");
      try {
        let requestId = createdId;
        if (!requestId) { const data = Object.fromEntries(new FormData(e.currentTarget).entries()); const result = await workspaceAction("request.create", { ...data, message, category }); requestId = result.id!; setCreatedId(requestId); }
        const completed = [...uploaded];
        for (const file of files) {
          const signature = `${file.name}:${file.size}:${file.lastModified}`; if (completed.includes(signature)) continue;
          const form = new FormData(); form.set("requestId", String(requestId)); form.set("file", file);
          const response = await fetch("/api/client/fichiers", { method: "POST", body: form }); const result = await response.json();
          if (!response.ok) throw new Error(`Demande #${requestId} enregistrée. ${result.error} Vous pouvez réessayer l’envoi des fichiers.`);
          completed.push(signature); setUploaded([...completed]);
        }
        setFeedback(`Demande #${requestId} enregistrée${files.length ? " avec ses pièces jointes" : ""}. Choisissez maintenant un professionnel pour la transmettre.`); router.refresh();
      } catch (e) { setFeedback(e instanceof Error ? e.message : "Enregistrement impossible."); } finally { setBusy(false); }
    }}>
      <fieldset disabled={busy || createdId !== null}><label>Titre du problème<input name="title" required minLength={5} maxLength={120} placeholder="Ex. Une fuite sous l’évier de la cuisine"/></label>
      <div className="cx-fields"><label>Catégorie<select value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((c) => <option key={c}>{c}</option>)}</select></label><label>Niveau d’urgence<select name="urgency"><option value="NORMAL">Normale · à planifier</option><option value="SOON">Sous 48 heures</option><option value="URGENT">Urgente · dès que possible</option></select></label></div>
      <label>Description détaillée<textarea required minLength={20} maxLength={3000} rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Que se passe-t-il ? Depuis quand ? Qu’avez-vous déjà constaté ?"/></label>
      <div className="cx-description-help"><span>{message.length} / 3 000 caractères</span>{aiEnabled && <button type="button" className="cx-text-btn" disabled={aiBusy || message.trim().length < 20} onClick={async () => { setAiBusy(true); setFeedback(""); try { const response = await fetch("/api/client/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: message }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setMessage(result.description); setCategory(result.category); setFeedback("Suggestion IA appliquée. Relisez-la avant l’envoi."); } catch (e) { setFeedback(e instanceof Error ? e.message : "Assistant indisponible."); } finally { setAiBusy(false); } }}><Sparkles size={14}/> {aiBusy ? "Amélioration…" : "Améliorer avec l’IA"}</button>}</div>
      <label>Adresse de l’intervention<input name="address" required minLength={5} maxLength={500} defaultValue={address} placeholder="Rue, numéro, quartier et ville"/></label>
      <div className="cx-fields"><label>Disponibilités souhaitées<input name="preferredDates" maxLength={500} placeholder="Ex. En semaine après 16 h"/></label><label>Équipement concerné<select name="equipmentId"><option value="">Aucun équipement sélectionné</option>{equipment.map((eq) => <option value={eq.id} key={eq.id}>{eq.name}</option>)}</select></label></div></fieldset>
      <label className="cx-dropzone"><Camera size={25}/><strong>Ajoutez des photos ou une vidéo</strong><span>JPEG, PNG, WebP, MP4 ou PDF · 8 Mo par fichier · 5 fichiers par envoi</span><input aria-label="Pièces jointes" type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf" disabled={busy} onChange={(e) => { const chosen = Array.from(e.target.files || []); if (chosen.length > 5 || chosen.some((f) => f.size > 8 * 1024 * 1024)) { setFeedback("Sélectionnez jusqu’à 5 fichiers de 8 Mo maximum."); e.target.value = ""; return; } setFiles(chosen); }}/></label>
      {files.length > 0 && <ul className="cx-file-list">{files.map((file) => <li key={`${file.name}-${file.lastModified}`}>{file.name} <small>{(file.size / 1024 / 1024).toFixed(1)} Mo</small></li>)}</ul>}
      <div className="cx-form-bottom"><p>Votre adresse et vos fichiers sont accessibles au professionnel que vous sélectionnerez.</p><button className="cx-btn" disabled={busy || aiBusy} type="submit">{busy ? <LoaderCircle className="cx-spin" size={16}/> : <Check size={16}/>} {createdId ? "Réessayer / vérifier les fichiers" : "Créer ma demande"}</button></div>
      {feedback && <p className="cx-feedback" role="status">{feedback}</p>}{createdId && <div className="cx-actions"><Link className="cx-btn" href="/dashboard/professionnels">Choisir un professionnel</Link><button type="button" className="cx-btn secondary" onClick={() => { setCreatedId(null); setFiles([]); setUploaded([]); setMessage(""); setFeedback(""); }}>Créer une autre demande</button></div>}
    </form></section>;
}
