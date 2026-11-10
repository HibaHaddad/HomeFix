"use client";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, X } from "lucide-react";
import styles from "./AdminAction.module.css";

export type AdminField = { name: string; label: string; type?: "text" | "textarea" | "number" | "select"; value?: string | number; min?: number; max?: number; options?: { value: string; label: string }[] };
export default function AdminAction({ label, endpoint, fields = [], payload = {}, description = "Cette action sera enregistrée dans le journal d’audit.", method = "POST", danger = false }: { label: string; endpoint: string; fields?: AdminField[]; payload?: Record<string, string | number>; description?: string; method?: "POST" | "PATCH" | "PUT"; danger?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const body: Record<string, string | number> = { ...payload };
    for (const field of fields) body[field.name] = field.type === "number" ? Number(data.get(field.name)) : String(data.get(field.name) ?? "");
    setBusy(true); setError("");
    try {
      const response = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Action impossible. Réessayez.");
      dialog.current?.close(); setSuccess("Enregistré"); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Connexion impossible."); }
    finally { setBusy(false); }
  }
  return <div className={styles.root}><button type="button" className={`${styles.button} admin-button ${danger ? "admin-button-danger" : "admin-button-light"}`} onClick={() => { setError(""); dialog.current?.showModal(); }}>{label}</button>{success && <span className={styles.success} role="status">{success}</span>}<dialog ref={dialog} aria-labelledby={titleId} className={styles.dialog} onCancel={e => { if (busy) e.preventDefault(); }}><form onSubmit={submit}><header><h2 id={titleId}>{label}</h2><button type="button" className="admin-icon-button" aria-label="Fermer" disabled={busy} onClick={() => dialog.current?.close()}><X size={18}/></button></header><p>{description}</p>{fields.map(f => <label className="aw-field" key={f.name}><span>{f.label}</span>{f.type === "select" ? <select name={f.name} defaultValue={f.value} required disabled={busy}>{f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select> : f.type === "textarea" ? <textarea name={f.name} defaultValue={f.value} minLength={f.min ?? 3} maxLength={f.max ?? 1000} rows={4} required disabled={busy}/> : <input name={f.name} type={f.type ?? "text"} defaultValue={f.value} min={f.type === "number" ? f.min ?? 1 : undefined} max={f.type === "number" ? f.max ?? 100 : undefined} minLength={f.type !== "number" ? f.min ?? 2 : undefined} maxLength={f.type !== "number" ? f.max ?? 160 : undefined} required disabled={busy}/>}</label>)}{error && <p className="admin-action-error" role="alert">{error}</p>}<footer><button type="button" className="admin-button admin-button-light" disabled={busy} onClick={() => dialog.current?.close()}>Annuler</button><button type="submit" className={`admin-button ${danger ? "admin-button-danger" : "admin-button-primary"}`} disabled={busy}>{busy && <LoaderCircle size={15}/>} {busy ? "Enregistrement…" : "Confirmer"}</button></footer></form></dialog></div>;
}
