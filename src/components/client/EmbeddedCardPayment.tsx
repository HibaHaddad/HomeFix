"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { loadStripe } from "@stripe/stripe-js/pure";
import type { Stripe, StripeElements, StripePaymentElement } from "@stripe/stripe-js";
import { ArrowRight, CreditCard, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { prepareCardPayment } from "./FinishIntervention";

export default function EmbeddedCardPayment({ requestId, onComplete }: { requestId: number; onComplete: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const complete = useRef(onComplete);
  complete.current = onComplete;
  const gateway = useRef<{ stripe: Stripe; elements: StripeElements } | null>(null);
  const submitting = useRef(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [initializationFailed, setInitializationFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let disposed = false, payment: StripePaymentElement | undefined;
    setLoading(true); setReady(false); setError(""); setInitializationFailed(false);
    const timer = setTimeout(async () => {
      try {
        const session = await prepareCardPayment(requestId, controller.signal);
        if (disposed) return;
        if (!session.clientSecret) { complete.current(); return; }
        if (!session.publishableKey?.startsWith("pk_test_") || !session.clientSecret.startsWith("pi_")) throw new Error("Le formulaire Stripe Test n’a pas pu être vérifié.");
        const stripe = await loadStripe(session.publishableKey, { locale: "fr" });
        if (disposed) return;
        if (!stripe) throw new Error("Le formulaire sécurisé est indisponible. Vérifiez votre connexion et réessayez.");
        const elements = stripe.elements({ clientSecret: session.clientSecret, locale: "fr", appearance: {
          theme: "stripe", labels: "above",
          variables: { colorPrimary: "#146b57", colorBackground: "#fcfdf9", colorText: "#173f36", colorTextSecondary: "#6b8076", colorDanger: "#b54343", fontFamily: "Arial, sans-serif", fontSizeBase: "15px", borderRadius: "12px", spacingUnit: "4px", spacingGridRow: "18px" },
          rules: { ".Input": { border: "1px solid #dce6d9", boxShadow: "none", padding: "14px" }, ".Input:focus": { borderColor: "#38856e", boxShadow: "0 0 0 3px rgba(20,107,87,.09)" }, ".Label": { fontSize: "12px", fontWeight: "600", marginBottom: "8px" }, ".Tab": { border: "0", boxShadow: "none" }, ".Block": { boxShadow: "none", border: "0", padding: "0" } },
        } });
        payment = elements.create("payment", {
          layout: { type: "accordion", defaultCollapsed: false, radios: "never", spacedAccordionItems: false },
          business: { name: "HomeFix TN" },
          fields: { billingDetails: { name: "always", address: "if_required" } },
          wallets: { applePay: "never", googlePay: "never", link: "never" },
        });
        payment.on("ready", () => { if (!disposed) setLoading(false); });
        payment.on("change", (event) => { if (!disposed) { setReady(event.complete); setError(""); } });
        payment.on("loaderror", () => { if (!disposed) { setLoading(false); setInitializationFailed(true); setError("Le formulaire sécurisé n’a pas pu être chargé. Réessayez."); } });
        gateway.current = { stripe, elements };
        if (container.current) payment.mount(container.current);
      } catch (e) {
        if (!disposed) { setError(e instanceof Error ? e.message : "Le formulaire n’a pas pu être chargé."); setLoading(false); setInitializationFailed(true); }
      }
    }, 0);
    return () => { disposed = true; clearTimeout(timer); controller.abort(); payment?.destroy(); gateway.current = null; };
  }, [requestId, retry]);

  async function pay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !gateway.current || !ready) return;
    submitting.current = true; setBusy(true); setError("");
    const { stripe, elements } = gateway.current;
    try {
      // All fields, including the holder name, live in Stripe's secure iframe.
      // HomeFix sends only the intervention ID to its own payment endpoint.
      const response = await stripe.confirmPayment({ elements, redirect: "if_required", confirmParams: { return_url: `${window.location.origin}/dashboard/paiements/${requestId}/succes` } });
      if (response.error) throw new Error(response.error.message || "La carte a été refusée. Vérifiez vos informations et réessayez.");
      if (["succeeded", "processing"].includes(response.paymentIntent.status)) { complete.current(); return; }
      throw new Error("Le paiement n’est pas terminé. Vérifiez vos informations et réessayez.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "La connexion a été interrompue. Réessayez : votre paiement ne sera pas effectué deux fois.");
      submitting.current = false; setBusy(false);
    }
  }

  return <section className="cx-panel hf-card-panel" aria-labelledby={`card-heading-${requestId}`}>
    <header className="hf-card-heading"><span className="hf-card-icon"><CreditCard size={22}/></span><div><span className="cx-eyebrow">CARTE BANCAIRE</span><h2 id={`card-heading-${requestId}`}>Vos informations de paiement</h2></div><LockKeyhole size={18}/></header>
    <form onSubmit={pay} aria-busy={loading || busy}>
      {loading && <p className="hf-card-loading" role="status"><LoaderCircle size={20} className="cx-spin"/>Chargement des champs sécurisés…</p>}
      <div ref={container} className="hf-elements-container"/>
      {error && <p role="alert" className="hf-card-error">{error}</p>}
      {initializationFailed && <button className="cx-text-btn" type="button" onClick={() => setRetry((n) => n + 1)}>Recharger le formulaire</button>}
      <button className="cx-btn hf-pay-button" type="submit" disabled={loading || busy || !ready || initializationFailed}>{busy ? <LoaderCircle size={18} className="cx-spin"/> : <LockKeyhole size={17}/>}<span>{busy ? "Paiement en cours…" : "Payer maintenant"}</span>{!busy && <ArrowRight size={18}/>}</button>
    </form>
    <p className="hf-card-security"><ShieldCheck size={15}/>Vos informations bancaires sont chiffrées et transmises directement à Stripe.</p>
  </section>;
}
