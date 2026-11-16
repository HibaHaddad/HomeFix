"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, UserX, Wrench, Save, LoaderCircle } from "lucide-react";
import { sanctionLabels, type SanctionRuleInput } from "@/lib/sanctions";

export default function AdminSanctionRules({ initial }: { initial: SanctionRuleInput[] }) {
  const [rules, setRules] = useState(initial), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false); const router = useRouter();
  const change = (id: string, patch: Partial<SanctionRuleInput>) => { setRules(rows => rows.map(row => row.id === id ? { ...row, ...patch } : row)); setMessage(""); };
  return <form className="sn-rules-form" onSubmit={async event => {
    event.preventDefault(); if (busy) return; setBusy(true); setMessage(""); setFailed(false);
    try { const response = await fetch("/api/admin/sanctions/rules", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rules }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setMessage("Règles enregistrées. Les pénalités déjà proposées ou appliquées conservent leur barème."); router.refresh(); }
    catch (e) { setFailed(true); setMessage(e instanceof Error ? e.message : "Enregistrement impossible."); }
    finally { setBusy(false); }
  }}><div className="sn-rules">{rules.map(rule => {
    const Icon = rule.id === "LATE" ? Clock3 : rule.id === "NO_SHOW" ? UserX : Wrench;
    return <article className={`sn-rule ${rule.id === "LATE" ? "warning" : "danger"}`} key={rule.id}><header><span className="sn-icon"><Icon size={22}/></span><label className="sn-switch"><input type="checkbox" checked={rule.enabled} disabled={busy} onChange={event => change(rule.id, { enabled: event.target.checked })}/><span/>{rule.enabled ? "Active" : "Inactive"}</label></header><h2>{sanctionLabels[rule.id]}</h2><p>{rule.id === "LATE" ? "Comparer le début enregistré et l’horaire prévu. La note d’origine reste intacte." : rule.id === "NO_SHOW" ? "Rendez-vous écoulé sans activité enregistrée. L’absence doit être confirmée par l’Admin." : "Intervention contestée ou annulée sans motif enregistré. Examiner les justificatifs."}</p><label>{rule.id === "LATE" ? "Retard strictement supérieur à (minutes)" : "Délai d’examen après la fin prévue (minutes)"}<input type="number" min="0" max="10080" step="1" required disabled={busy} value={rule.thresholdMinutes} onChange={event => change(rule.id, { thresholdMinutes: Number(event.target.value) })}/></label><label>{rule.id === "LATE" ? "Pénalité sur la note ajustée (étoiles)" : "Pénalité financière (DT)"}<input type="number" min="0.01" max={rule.id === "LATE" ? "4" : "1000"} step={rule.id === "LATE" ? "0.01" : "0.001"} required disabled={busy} value={rule.id === "LATE" ? rule.ratingHundredths / 100 : rule.amountMillimes / 1000} onChange={event => change(rule.id, rule.id === "LATE" ? { ratingHundredths: Math.round(Number(event.target.value) * 100) } : { amountMillimes: Math.round(Number(event.target.value) * 1000) })}/></label><small>{rule.id === "LATE" ? "Note ajustée minimum : 1/5. Aucun avis client n’est modifié." : "Déduction du solde comptable simulé, distincte des commissions."}</small></article>;
  })}</div><footer><p>Les incidents sont détectés automatiquement, puis validés individuellement par un Admin. Désactiver une règle empêche toute nouvelle détection et validation.</p><button className="admin-button admin-button-primary" disabled={busy}>{busy ? <LoaderCircle size={16}/> : <Save size={16}/>}Enregistrer les règles</button></footer>{message && <p className={failed ? "admin-action-error" : "sn-success"} role={failed ? "alert" : "status"}>{message}</p>}</form>;
}
