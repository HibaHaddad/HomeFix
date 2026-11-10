"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, FileCheck2, LoaderCircle, LockKeyhole, ShieldCheck, Star } from "lucide-react";
import { loadPayment, type PaymentSummary } from "./FinishIntervention";
import EmbeddedCardPayment from "./EmbeddedCardPayment";
import ReviewEditor from "./ReviewEditor";
import { dateLabel, money } from "@/lib/client-domain";
import { getChatSocket } from "@/lib/chat-socket";

export default function PaymentResult({ requestId, cancelled, returned, startPayment = false, review }: { requestId: number; cancelled: boolean; returned: boolean; startPayment?: boolean; review: Parameters<typeof ReviewEditor>[0]["review"] }) {
  const router = useRouter();
  const [data, setData] = useState<PaymentSummary | null>(null);
  const [error, setError] = useState("");
  const [showCard, setShowCard] = useState(startPayment || (!returned && !cancelled));
  const [waiting, setWaiting] = useState(returned);
  const paid = data?.status === "PAID";
  const refunded = data?.status === "REFUNDED";
  const pending = !paid && (waiting || data?.checkoutStatus === "PROCESSING");
  const reload = useCallback(() => loadPayment(requestId).then((r) => { setData(r); setError(""); }).catch((e) => setError(e.message)), [requestId]);
  useEffect(() => {
    void reload();
    const socket = getChatSocket();
    const update = (event: { requestId: number }) => { if (event.requestId === requestId) void reload(); };
    const refresh = () => void reload();
    socket.on("intervention:updated", update); socket.on("connect", refresh);
    window.addEventListener("focus", refresh);
    return () => { socket.off("intervention:updated", update); socket.off("connect", refresh); window.removeEventListener("focus", refresh); };
  }, [reload, requestId]);
  useEffect(() => {
    if (paid || refunded || (!pending && !showCard)) return;
    // Another tab may settle the same invoice while this form is open.
    const timer = setInterval(() => void reload(), 5000);
    return () => clearInterval(timer);
  }, [paid, refunded, pending, showCard, reload]);
  const completed = useCallback(() => {
    setShowCard(false); setWaiting(true); void reload();
    router.replace(`/dashboard/paiements/${requestId}/succes`);
  }, [reload, requestId, router]);
  if (refunded) return <div className="hf-payment-page"><Link className="cx-text-btn" href="/dashboard/paiements"><ArrowLeft size={15}/>Mes paiements</Link><section className="cx-panel hf-payment-confirmation"><ShieldCheck size={28}/><span className="cx-eyebrow">STRIPE TEST</span><h1>Paiement remboursé</h1><p>Le remboursement de cette transaction a été confirmé. Aucun nouveau règlement n’est attendu pour cette facture.</p><Link className="cx-btn" href={`/dashboard/interventions?demande=${requestId}`}>Voir mon intervention</Link></section></div>;
  return <div className="hf-payment-page">
    <Link className="cx-text-btn hf-payment-back" href={`/dashboard/interventions?demande=${requestId}#intervention-${requestId}`}><ArrowLeft size={15}/>Mon intervention</Link>
    <header className="hf-payment-heading"><div><span className="cx-eyebrow">HOMEFIX TN · PAIEMENT SÉCURISÉ</span><h1>{paid ? "Merci pour votre confiance" : cancelled ? "Paiement interrompu" : "Votre paiement"}</h1><p>{paid ? "Votre règlement est confirmé. Tout est en ordre." : "Un dernier geste, et votre intervention est réglée."}</p></div><span className="hf-secure-badge"><ShieldCheck size={16}/>Paiement sécurisé</span></header>
    {error && <p role="alert" className="cx-feedback is-error">{error}</p>}
    {!data ? !error && <p className="hf-card-loading" role="status"><LoaderCircle size={20} className="cx-spin"/>Préparation de votre paiement…</p> : <div className="hf-payment-grid">
      <section className="cx-panel hf-order-summary">
        <span className="cx-eyebrow">RÉCAPITULATIF</span>
        <h2>{data.title}</h2><p>Avec {data.professional}</p>
        <div className="hf-order-total"><span>{paid ? "Montant réglé" : "Total à payer"}</span><strong>{money(paid ? data.paidMillimes : data.balanceMillimes ?? data.totalMillimes ?? 0)}</strong><small>TND · Dinar tunisien</small></div>
        <div className="hf-order-guarantee"><ShieldCheck size={18}/><p>Vos données bancaires restent confidentielles.</p></div>
        <span className="hf-simulation-label">Simulation · Aucun débit réel</span>
      </section>
      {paid ? <section className="cx-panel hf-payment-confirmation"><span className="hf-success-mark"><Check size={30}/></span><span className="cx-eyebrow">PAIEMENT CONFIRMÉ</span><h2>Paiement réussi</h2><p>Votre reçu est disponible dans votre espace.{data.paidAt && <> Réglé le {dateLabel(data.paidAt)}.</>}</p><a className="cx-btn" href={`/api/client/factures/${data.invoiceId}/pdf`} target="_blank" rel="noopener noreferrer"><FileCheck2 size={17}/>Consulter mon reçu</a></section>
      : pending ? <section className="cx-panel hf-payment-confirmation"><span className="hf-success-mark"><LoaderCircle size={27} className="cx-spin"/></span><h2>Confirmation en cours</h2><p role="status">Nous vérifions votre paiement en toute sécurité. Votre reçu et l’avis seront disponibles dès sa confirmation.</p><button className="cx-text-btn" onClick={() => void reload()}>Actualiser le statut</button>{data.checkoutStatus !== "PROCESSING" && <button className="cx-text-btn" onClick={() => { setWaiting(false); setShowCard(true); }}>Revenir au formulaire</button>}</section>
      : showCard && data.available ? <EmbeddedCardPayment requestId={requestId} onComplete={completed}/>
      : <section className="cx-panel hf-payment-confirmation"><LockKeyhole size={27}/><h2>{cancelled ? "À votre rythme" : "Votre règlement"}</h2><p>{data.available ? "Vous pouvez reprendre votre paiement quand vous le souhaitez." : data.reason}</p>{data.available && <button className="cx-btn" onClick={() => { setWaiting(false); setShowCard(true); }}>Reprendre le paiement</button>}<button className="cx-text-btn" onClick={() => void reload()}>Actualiser</button></section>}
    </div>}
    {paid && <section className="cx-panel hf-payment-review"><header><span className="hf-card-icon"><Star size={21}/></span><div><h2>Votre avis fait la différence</h2><p>Comment s’est passée votre intervention ?</p></div></header><ReviewEditor requestId={requestId} review={review}/></section>}
  </div>;
}
