"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, X, Camera } from "lucide-react";
import SlotPicker, { type Slot } from "./SlotPicker";
import { workspaceAction } from "./WorkspaceForm";
export default function InterventionComposer({ professionalId, conversationId, address = "", inline = false, onCreated }: { professionalId: number; conversationId?: number; address?: string; inline?: boolean; onCreated?: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null); const router = useRouter();
  const [slot, setSlot] = useState<Slot | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [saved, setSaved] = useState<{ id: number; conversationId: number } | null>(null); const [uploaded, setUploaded] = useState<string[]>([]);
  const form = <form className="cx-form flow-composer" onSubmit={async (e) => {
    e.preventDefault(); if (busy || (!saved && !slot)) return; setBusy(true); setError("");
    const element = e.currentTarget;
    const data = new FormData(element);
    try {
      let result = saved;
      if (!result) { const created = await workspaceAction("request.create", { source: conversationId ? "CHAT" : "PROFILE", professionalId, conversationId, slotId: slot!.id, message: data.get("message"), address: data.get("address") }); result = { id: created.id!, conversationId: created.conversationId! }; setSaved(result); }
      const done = [...uploaded];
      for (const file of data.getAll("photos").filter((v): v is File => v instanceof File && v.size > 0)) {
        const key = `${file.name}:${file.size}:${file.lastModified}`; if (done.includes(key)) continue;
        const upload = new FormData(); upload.set("requestId", String(result.id)); upload.set("file", file);
        const response = await fetch("/api/client/fichiers", { method: "POST", body: upload }); const body = await response.json();
        if (!response.ok) throw new Error(`Demande enregistrée. ${body.error} Réessayez les photos ou ouvrez la conversation.`);
        done.push(key); setUploaded([...done]);
      }
      dialog.current?.close(); element.reset(); setSaved(null); setSlot(null); setUploaded([]); onCreated?.();
      const destination = `/dashboard/messagerie?demande=${result.conversationId}`;
      if (window.location.pathname + window.location.search === destination) router.refresh();
      else router.push(destination);
    } catch (e) { setError(e instanceof Error ? e.message : "Envoi impossible."); } finally { setBusy(false); }
  }}><div className="flow-composer-layout"><fieldset className="flow-composer-calendar" disabled={busy || saved !== null}><SlotPicker professionalId={professionalId} value={slot?.id ?? null} onChange={setSlot}/></fieldset><div className="flow-composer-details"><fieldset disabled={busy || saved !== null}><label>Votre problème en quelques mots<textarea name="message" required minLength={10} maxLength={3000} rows={3} placeholder="Ex. Le robinet fuit depuis ce matin."/></label><label>Adresse de l’intervention<input name="address" required minLength={5} maxLength={500} defaultValue={address} placeholder="Rue, quartier et ville"/></label></fieldset><label className="flow-photo-input"><Camera size={16}/> Photos (facultatif)<input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={(e) => { if (Array.from(e.target.files || []).some((f) => f.size > 8 * 1024 * 1024) || (e.target.files?.length || 0) > 5) { e.target.value = ""; setError("5 photos maximum, de 8 Mo chacune."); } }}/></label><small>Une demande ne confirme pas le rendez-vous : le professionnel doit accepter le créneau et vous devez vous accorder sur le devis.</small>{error && <p className="cx-feedback is-error" role="alert">{error}</p>}<button className="cx-btn" disabled={busy || (!slot && !saved)} type="submit"><CalendarPlus size={16}/>{busy ? "Envoi…" : saved ? "Réessayer l’envoi des photos" : "Envoyer la demande de réservation"}</button>{saved && <a className="cx-text-btn" href={`/dashboard/messagerie?demande=${saved.conversationId}`}>Ouvrir la conversation</a>}</div></div></form>;
  if (inline) return form;
  return <><button type="button" className="cx-btn" onClick={() => dialog.current?.showModal()}><CalendarPlus size={16}/>Demander une intervention</button><dialog ref={dialog} className="flow-dialog" aria-labelledby="flow-dialog-title" onCancel={(e) => { if (busy) e.preventDefault(); }}><div className="cx-panel-title"><h2 id="flow-dialog-title">Demander une intervention</h2><button className="cx-icon-btn" aria-label="Fermer" type="button" disabled={busy} onClick={() => dialog.current?.close()}><X size={18}/></button></div>{form}</dialog></>;
}
