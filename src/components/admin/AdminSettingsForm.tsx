"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
export default function AdminSettingsForm({ settingKey, fields }: { settingKey: string; fields: { name: string; label: string; value: string | number; min?: number; max?: number }[] }) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState(false);
  const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = new FormData(event.currentTarget);
    const value = Object.fromEntries(fields.map(f => [f.name, typeof f.value === "number" ? Number(form.get(f.name)) : String(form.get(f.name) ?? "")]));
    setBusy(true); setFeedback(""); setError(false);
    try {
      const response = await fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: settingKey, value }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Enregistrement impossible.");
      setFeedback("Paramètres enregistrés et journalisés."); router.refresh();
    } catch (e) { setError(true); setFeedback(e instanceof Error ? e.message : "Connexion impossible."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="aw-settings">{fields.map(f => <label className="aw-field" key={f.name}><span>{f.label}</span><input name={f.name} type={typeof f.value === "number" ? "number" : "email"} defaultValue={f.value} min={f.min ?? 1} max={f.max ?? 100} maxLength={254} required disabled={busy}/></label>)}<div><button type="submit" disabled={busy} className="admin-button admin-button-primary"><Save size={15}/>{busy ? "Enregistrement…" : "Enregistrer les paramètres"}</button></div>{feedback && <p role={error ? "alert" : "status"} className={error ? "admin-action-error" : "aw-note"}>{feedback}</p>}</form>;
}
