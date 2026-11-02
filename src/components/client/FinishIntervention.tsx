"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, CreditCard, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { money } from "@/lib/client-domain";
export type PaymentSummary = { requestId: number; mode: "test"; testPaid: boolean; checkoutStatus?: string; title: string; professional: string; status: string; totalMillimes?: number; paidMillimes: number; balanceMillimes?: number; paidAt?: string; receiptUrl?: string; invoiceId?: number; available: boolean; reason: string };
export async function loadPayment(requestId: number, signal?: AbortSignal): Promise<PaymentSummary> {
  const response = await fetch(`/api/client/paiements?requestId=${requestId}`, { cache: "no-store", signal });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Paiement indisponible.");
  return result;
}
export async function prepareCardPayment(requestId: number, signal?: AbortSignal) {
  const response = await fetch("/api/client/paiements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId }), signal });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Le paiement n’a pas pu démarrer.");
  return result as { url: string; clientSecret?: string; publishableKey?: string; status?: string };
}
export async function openCardPayment(requestId: number) {
  window.location.assign(`/dashboard/paiements/${requestId}?carte=1`);
}
export default function FinishIntervention({ requestId, paid = false, confirmed = false, testPaid = false }: { requestId: number; paid?: boolean; confirmed?: boolean; testPaid?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false), [data, setData] = useState<PaymentSummary | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setData(null); setError("");
    loadPayment(requestId, controller.signal).then(setData).catch((e) => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [open, requestId]);
  function close() { if (busy) return; dialog.current?.close(); setOpen(false); trigger.current?.focus(); }
  if (paid) return <div className="hf-paid"><Check size={16}/>{testPaid ? "Payé " : "Payé"}<Link href={`/dashboard/paiements/${requestId}`}>Reçu et avis</Link></div>;
  return <><button ref={trigger} type="button" className="cx-btn" onClick={() => { setOpen(true); dialog.current?.showModal(); }}><ShieldCheck size={16}/>{confirmed ? "Régler l’intervention" : "Confirmer la fin de l’intervention"}</button>
    <dialog ref={dialog} className="hf-finish-dialog" onCancel={(e) => { if (busy) e.preventDefault(); else setOpen(false); }} onClick={(e) => { if (e.target === dialog.current) close(); }} onClose={() => setOpen(false)}>
      <div className="hf-finish-content"><button className="hf-close" aria-label="Fermer" type="button" onClick={close} disabled={busy}><X size={20}/></button><span className="hf-finish-icon"><ShieldCheck size={30}/></span><small>PAIEMENT SÉCURISÉ</small><h2>Tout est terminé ?</h2><p>Confirmez la fin du travail, puis réglez votre intervention par carte directement dans HomeFix.</p>
      {data ? <><div className="hf-payment-summary"><div><strong>{data.title}</strong><span>{data.professional}</span></div><b>{data.totalMillimes !== undefined ? money(data.totalMillimes) : "Prix à vérifier"}</b></div>{!data.available && data.status !== "PAID" && <p className="hf-payment-notice" role="status">{data.reason}</p>}
      {data.status === "PAID" ? <Link className="cx-btn" href={`/dashboard/paiements/${requestId}`}>Voir le reçu</Link> : <button type="button" className="cx-btn" disabled={busy || !data.available || data.totalMillimes === undefined} onClick={async () => { setBusy(true); setError(""); try { await openCardPayment(requestId); } catch (e) { setError(e instanceof Error ? e.message : "Connexion impossible."); setBusy(false); } }}>{busy ? <LoaderCircle className="cx-spin" size={16}/> : <CreditCard size={17}/>}Confirmer et payer</button>}</> : !error && <p role="status"><LoaderCircle className="cx-spin" size={18}/> Vérification du paiement…</p>}
      {error && <p className="cx-feedback is-error" role="alert">{error}</p>}<button type="button" className="cx-text-btn" disabled={busy} onClick={close}>Revenir à l’intervention</button><small className="hf-payment-security"><ShieldCheck size={13}/>Le prix accepté est vérifié côté serveur.</small></div>
    </dialog></>;
}
