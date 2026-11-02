import "server-only";
import Stripe from "stripe";
import { prisma } from "./prisma";
import { chatServer, userRoom } from "./chat-events";
import { paymentMatches, testCurrencyPlan } from "@/lib/payment-rules";
import type { CheckoutPayment } from "@/generated/prisma/client";

export class PaymentError extends Error {
  status: number;
  constructor(message: string, status = 409) { super(message); this.status = status; }
}
export function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new PaymentError("Stripe Test n’est pas encore configuré. Aucun paiement réel n’est possible.", 503);
  if (!key.startsWith("sk_test_")) throw new PaymentError("Seules les clés sk_test_ sont autorisées. Les paiements réels sont désactivés.", 503);
  return new Stripe(key, { maxNetworkRetries: 1, timeout: 10000 });
}
function appOrigin() {
  const url = new URL(process.env.APP_ORIGIN || "http://localhost:3000");
  if (url.username || url.password || (process.env.NODE_ENV === "production" && url.protocol !== "https:")) throw new PaymentError("L’adresse sécurisée du site doit être configurée.", 503);
  return url.origin;
}

export async function stripeEligibility(stripe = stripeClient()) {
  if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) throw new PaymentError("Seules les clés sk_test_ sont autorisées.", 503);
  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith("pk_test_")) throw new PaymentError("La clé publique Stripe Test pk_test_ doit être configurée.", 503);
  const account = await stripe.accounts.retrieve(null);
  if (!account.country) throw new PaymentError("Le pays du compte marchand Stripe doit être vérifié.", 503);
  const spec = await stripe.countrySpecs.retrieve(account.country);
  if (!process.env.STRIPE_WEBHOOK_SECRET) throw new PaymentError("La confirmation sécurisée Stripe n’est pas configurée.", 503);
  appOrigin();
  return { stripe, account, live: false as const, supportedCurrencies: spec.supported_payment_currencies };
}

export function checkoutPlan(supported: string[], balanceMillimes: number) {
  try { return testCurrencyPlan(supported, balanceMillimes, { currency: process.env.STRIPE_TEST_CURRENCY, rate: process.env.STRIPE_TEST_EXCHANGE_RATE }); }
  catch (e) { throw new PaymentError(e instanceof Error ? e.message : "Conversion de test indisponible."); }
}

export async function ownedPaymentRequest(clientId: number, requestId: number) {
  const record = await prisma.serviceRequest.findFirst({ where: { id: requestId, clientId, kind: { not: "MESSAGE" } }, include: { professional: { select: { name: true, businessName: true } }, quotes: { where: { status: "ACCEPTED" }, include: { invoice: true } }, review: true } });
  if (!record) throw new PaymentError("Intervention introuvable.", 404);
  return record;
}

export function checkoutParameters(attempt: CheckoutPayment, requestId: number): Stripe.Checkout.SessionCreateParams {
  return {
    mode: "payment", allowed_payment_method_types: ["card"], locale: "fr",
    adaptive_pricing: { enabled: false }, automatic_tax: { enabled: false }, allow_promotion_codes: false,
    client_reference_id: attempt.id, metadata: { paymentId: attempt.id },
    payment_intent_data: { metadata: { paymentId: attempt.id } },
    line_items: [{ quantity: 1, price_data: { currency: attempt.currency, unit_amount: attempt.stripeAmount ?? attempt.amountMillimes, product_data: { name: "HomeFix TN · TEST · Aucun débit réel", description: `Solde ${attempt.amountMillimes / 1000} TND · Taux de démonstration ${Number(attempt.exchangeRatePpm ?? 1000000) / 1000000} ${attempt.currency.toUpperCase()}/TND` } } }],
    ...(attempt.uiMode === "embedded_page" ? { ui_mode: "embedded_page", redirect_on_completion: "never" } : {
      // Preserve the exact original payload when recovering a hosted attempt.
      success_url: `${appOrigin()}/dashboard/paiements/${requestId}?retour=succes`,
      cancel_url: `${appOrigin()}/dashboard/paiements/${requestId}?retour=annule`,
    }),
  };
}
function embeddedResult(session: Stripe.Checkout.Session, requestId: number) {
  if (!session.client_secret || !["embedded_page", "embedded"].includes(String(session.ui_mode))) throw new PaymentError("Le formulaire sécurisé n’a pas pu être initialisé.", 502);
  return { url: `${appOrigin()}/dashboard/paiements/${requestId}?carte=1`, status: "OPEN", clientSecret: session.client_secret, publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY! };
}

export async function createCheckout(clientId: number, requestId: number, eligibility = stripeEligibility) {
  const record = await ownedPaymentRequest(clientId, requestId);
  if (record.status !== "COMPLETED") throw new PaymentError("Le professionnel doit d’abord terminer l’intervention.");
  const quote = record.quotes[0], invoice = quote?.invoice;
  if (!invoice || record.quotes.length !== 1 || invoice.totalMillimes !== quote.amountMillimes) throw new PaymentError("Le prix final accepté doit être vérifié avant le paiement.");
  if (invoice.status === "PAID") return { url: `${appOrigin()}/dashboard/paiements/${requestId}` };
  const { stripe, account, live, supportedCurrencies } = await eligibility();
  if (live) throw new PaymentError("Les paiements réels sont interdits.", 503);
  const prepared = await prisma.$transaction(async (tx) => {
    // Serialize the complete Checkout decision for this invoice, across workers.
    await tx.$queryRaw`SELECT "id" FROM "ClientInvoice" WHERE "id" = ${invoice.id} FOR UPDATE`;
    const current = await tx.clientInvoice.findUniqueOrThrow({ where: { id: invoice.id } });
    if (current.status === "PAID") return { url: `${appOrigin()}/dashboard/paiements/${requestId}` };
    const balance = current.totalMillimes - current.paidMillimes;
    if (current.totalMillimes !== quote.amountMillimes || current.paidMillimes < 0 || balance <= 0) throw new PaymentError("Le solde de la facture doit être vérifié avant le paiement.");
    let attempt = await tx.checkoutPayment.findFirst({ where: { invoiceId: invoice.id, status: { in: ["CREATING", "OPEN", "PROCESSING", "SUCCEEDED"] } }, orderBy: { createdAt: "desc" } });
    if (attempt && (attempt.merchantAccountId !== account.id || attempt.livemode !== live)) throw new PaymentError("Le compte marchand a changé. Contactez l’assistance avant de réessayer.");
    if (attempt && (attempt.amountMillimes !== balance || attempt.priorPaidMillimes !== current.paidMillimes)) throw new PaymentError("Le solde a changé depuis la création du paiement. Contactez l’assistance pour vérifier la session existante.");
    if (attempt && !attempt.sessionId && +attempt.createdAt < Date.now() - 23 * 3600000) throw new PaymentError("Ce paiement doit être vérifié par l’assistance avant une nouvelle tentative.");
    if (attempt && !attempt.sessionId && attempt.uiMode !== "embedded_page") {
      const recovered = await stripe.checkout.sessions.create(checkoutParameters(attempt, requestId), { idempotencyKey: `homefix-checkout-${attempt.id}` });
      if (!paymentMatches(attempt, recovered)) throw new PaymentError("L’ancienne tentative de paiement doit être vérifiée.");
      attempt = await tx.checkoutPayment.update({ where: { id: attempt.id }, data: { sessionId: recovered.id, status: "OPEN" } });
    }
    if (attempt?.sessionId) {
      let session = await stripe.checkout.sessions.retrieve(attempt.sessionId);
      if (!paymentMatches(attempt, session)) throw new PaymentError("La session ne correspond pas au paiement de test attendu.");
      if (session.payment_status === "paid" || session.status === "complete") return { url: `${appOrigin()}/dashboard/paiements/${requestId}?retour=succes`, status: "PROCESSING" };
      if (session.status === "open" && attempt.uiMode === "embedded_page") return embeddedResult(session, requestId);
      if (session.status === "open") session = await stripe.checkout.sessions.expire(session.id);
      if (session.status !== "expired" || attempt.status === "SUCCEEDED") throw new PaymentError("Un paiement est en cours de vérification. Patientez avant de réessayer.");
      await tx.checkoutPayment.update({ where: { id: attempt.id }, data: { status: "EXPIRED" } });
      attempt = null;
    }
    if (attempt && +attempt.createdAt < Date.now() - 23 * 3600000) throw new PaymentError("Ce paiement doit être vérifié par l’assistance avant une nouvelle tentative.");
    if (!attempt) attempt = await tx.checkoutPayment.create({ data: { invoiceId: invoice.id, uiMode: "embedded_page", amountMillimes: balance, priorPaidMillimes: current.paidMillimes, ...checkoutPlan(supportedCurrencies, balance), merchantAccountId: account.id, merchantCountry: account.country!, livemode: false } });
    return { attempt };
  }, { timeout: 30000 });
  if ("url" in prepared) return { ...prepared, url: prepared.url! };
  // Persist the idempotency key BEFORE contacting Stripe. A timeout, rollback,
  // process crash or concurrent click reuses the same session on retry.
  const attempt = prepared.attempt;
  const session = await stripe.checkout.sessions.create(checkoutParameters(attempt, requestId), { idempotencyKey: `homefix-checkout-${attempt.id}` });
  if (!paymentMatches(attempt, session)) throw new PaymentError("Le paiement Stripe ne correspond pas au montant attendu.", 502);
  const result = embeddedResult(session, requestId);
  await prisma.$transaction(async (tx) => {
    await tx.checkoutPayment.updateMany({ where: { id: attempt.id, status: "CREATING" }, data: { sessionId: session.id, status: "OPEN" } });
    const confirmed = await tx.serviceRequest.updateMany({ where: { id: requestId, clientConfirmedAt: null }, data: { clientConfirmedAt: new Date() } });
    if (confirmed.count) await tx.requestEvent.create({ data: { requestId, actorId: clientId, status: "COMPLETED", description: "Fin d’intervention validée par le client" } });
  });
  return result;
}

/** Called ONLY with a Stripe-signature-verified event. Redirects cannot settle an invoice. */
export async function handleStripeEvent(event: Stripe.Event, stripe = stripeClient()) {
  if (event.livemode) throw new PaymentError("Les événements Stripe réels sont interdits.", 400);
  if (event.type.startsWith("payment_intent.")) {
    const { handleCardPaymentEvent } = await import("./card-payments");
    return handleCardPaymentEvent(event, stripe);
  }
  if (!event.type.startsWith("checkout.session.")) return;
  if (!new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.expired", "checkout.session.async_payment_failed"]).has(event.type)) return;
  if (await prisma.stripeWebhookEvent.findUnique({ where: { id: event.id } })) return;
  const supplied = event.data.object as Stripe.Checkout.Session;
  const payment = supplied.metadata?.paymentId ? await prisma.checkoutPayment.findUnique({ where: { id: supplied.metadata.paymentId } }) : null;
  if (!payment) return; // An unrelated Checkout on the merchant account.
  const session = await stripe.checkout.sessions.retrieve(supplied.id, { expand: ["payment_intent.latest_charge"] });
  const account = await stripe.accounts.retrieve(null);
  if (account.id !== payment.merchantAccountId || event.livemode !== payment.livemode || !paymentMatches(payment, session) || session.mode !== "payment" || session.client_reference_id !== payment.id || session.metadata?.paymentId !== payment.id || (payment.sessionId && session.id !== payment.sessionId)) throw new PaymentError("Incohérence de paiement Stripe.", 400);
  const intent = typeof session.payment_intent === "object" ? session.payment_intent : null;
  const paid = session.payment_status === "paid" && session.status === "complete";
  if (paid && (!intent || intent.status !== "succeeded" || intent.amount_received !== (payment.stripeAmount ?? payment.amountMillimes) || intent.currency !== payment.currency || intent.metadata.paymentId !== payment.id || intent.livemode)) throw new PaymentError("Le paiement Stripe Test n’est pas confirmé.", 400);
  const charge = intent && typeof intent.latest_charge === "object" ? intent.latest_charge : null;
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "ClientInvoice" WHERE "id" = ${payment.invoiceId} FOR UPDATE`;
    if (await tx.stripeWebhookEvent.findUnique({ where: { id: event.id } })) return null;
    const invoice = await tx.clientInvoice.findUniqueOrThrow({ where: { id: payment.invoiceId }, include: { quote: { include: { request: true } } } });
    const r = invoice.quote.request;
    if (invoice.totalMillimes !== payment.priorPaidMillimes + payment.amountMillimes || invoice.quote.status !== "ACCEPTED" || invoice.quote.amountMillimes !== invoice.totalMillimes || r.status !== "COMPLETED") throw new PaymentError("La facture ne correspond pas au prix accepté.", 400);
    await tx.stripeWebhookEvent.create({ data: { id: event.id, type: event.type } });
    if (invoice.status === "PAID") return null;
    if (invoice.paidMillimes !== payment.priorPaidMillimes) throw new PaymentError("Le solde a changé. Vérification du règlement nécessaire.", 409);
    if (!paid) {
      await tx.checkoutPayment.update({ where: { id: payment.id }, data: { sessionId: session.id, ...(intent ? { paymentIntentId: intent.id } : {}), status: session.status === "expired" ? "EXPIRED" : event.type === "checkout.session.async_payment_failed" ? "FAILED" : "PROCESSING" } });
      return null;
    }
    await tx.checkoutPayment.update({ where: { id: payment.id }, data: { sessionId: session.id, paymentIntentId: intent!.id, status: "SUCCEEDED" } });
    await tx.clientInvoice.update({ where: { id: invoice.id }, data: { status: "PAID", testPaid: true, paidMillimes: payment.priorPaidMillimes + payment.amountMillimes, paidAt: new Date(event.created * 1000), paymentReference: intent!.id, receiptUrl: charge?.receipt_url, receiptNumber: charge?.receipt_number } });
    await tx.serviceRequest.update({ where: { id: r.id }, data: { clientConfirmedAt: r.clientConfirmedAt || new Date() } });
    await tx.requestEvent.create({ data: { requestId: r.id, actorId: r.clientId, status: "PAID", description: "Paiement TEST confirmé par Stripe · Aucun débit réel" } });
    const users = await tx.user.findMany({ where: { id: { in: [r.clientId, r.professionalId] }, notificationEnabled: true }, select: { id: true } });
    const notifications = [];
    for (const user of users) notifications.push(await tx.clientNotification.create({ data: { userId: user.id, title: user.id === r.clientId ? "Paiement test réussi · Votre reçu est disponible" : "Le client a réglé l’intervention en mode TEST", type: "PAYMENT_RECEIVED", href: user.id === r.clientId ? `/dashboard/paiements/${r.id}` : `/professionnel/interventions?demande=${r.id}` } }));
    return { r, notifications };
  }, { timeout: 15000 });
  if (result) {
    chatServer()?.to([userRoom(result.r.clientId), userRoom(result.r.professionalId)]).emit("intervention:updated", { requestId: result.r.id, status: "COMPLETED" });
    for (const n of result.notifications) chatServer()?.to(userRoom(n.userId)).emit("notification:new", { ...n, createdAt: n.createdAt.toISOString() });
  }
}
