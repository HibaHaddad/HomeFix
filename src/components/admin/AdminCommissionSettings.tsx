"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Percent, Save, LoaderCircle } from "lucide-react";
import { commissionLabel } from "@/lib/payment-allocation";

export default function AdminCommissionSettings({ initialBps }: { initialBps: number }) {
  const router = useRouter();
  const [percent, setPercent] = useState(String(initialBps / 100));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const bps = Math.round(Number(percent) * 100);
  return <section className="aw-card" aria-labelledby="commission-heading"><header style={{ display: "flex", alignItems: "center", gap: 12 }}><Percent size={23}/><div><h2 id="commission-heading">Commission HomeFix TN</h2><p>Définissez la répartition des prochains paiements confirmés.</p></div></header>
    <form onSubmit={async event => {
      event.preventDefault(); if (busy) return;
      setBusy(true); setMessage(""); setError(false);
      try {
        if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(percent) || bps < 0 || bps > 10000) throw new Error("Saisissez un pourcentage entre 0 et 100, avec deux décimales au maximum.");
        const response = await fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "PAYMENT_COMMISSION", value: { commissionBps: bps } }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error || "Enregistrement impossible.");
        setMessage("Commission enregistrée. Les transactions précédentes conservent leur taux."); router.refresh();
      } catch (failure) { setError(true); setMessage(failure instanceof Error ? failure.message : "Enregistrement impossible."); }
      finally { setBusy(false); }
    }}><label className="aw-field"><span>Commission de la plateforme (%)</span><input type="number" min="0" max="100" step="0.01" value={percent} onChange={event => { setPercent(event.target.value); setMessage(""); }} required disabled={busy}/></label><p>HomeFix TN : <strong>{commissionLabel(Math.min(10000, Math.max(0, bps || 0)))}</strong> · Professionnel : <strong>{commissionLabel(10000 - Math.min(10000, Math.max(0, bps || 0)))}</strong></p><p>Le taux est figé à la confirmation de chaque paiement. Les soldes restent comptables et simulés, sans transfert bancaire.</p><button className="admin-button admin-button-primary" disabled={busy}>{busy ? <LoaderCircle size={15}/> : <Save size={15}/>}Enregistrer la commission</button>{message && <p role={error ? "alert" : "status"} className={error ? "admin-action-error" : ""}>{message}</p>}</form>
  </section>;
}
