import "server-only";
import type Stripe from "stripe";
import type { CheckoutPayment } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import { chatServer, userRoom } from "./chat-events";
import { checkoutParameters, checkoutPlan, ownedPaymentRequest, PaymentError, stripeClient, stripeEligibility } from "./stripe-payments";
import { paymentMatches } from "@/lib/payment-rules";

function matches(payment: CheckoutPayment, intent: Stripe.PaymentIntent) {
  return !intent.livemode && !payment.livemode && intent.currency === payment.currency
    && intent.amount === (payment.stripeAmount ?? payment.amountMillimes)
    && intent.metadata.paymentId === payment.id
    && (!payment.paymentIntentId || payment.paymentIntentId === intent.id);
}

function result(intent: Stripe.PaymentIntent, requestId: number) {
  const url = `${new URL(process.env.APP_ORIGIN || "http://localhost:3000").origin}/dashboard/paiements/${requestId}?carte=1`;
  if (["succeeded", "processing", "requires_capture"].includes(intent.status)) return { url, status: "PROCESSING" };
  if (!intent.client_secret || intent.status === "canceled") throw new PaymentError("Le formulaire de paiement doit être rechargé.");
  return { url, status: "OPEN", clientSecret: intent.client_secret, publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY! };
}

export async function createCardPayment(clientId: number, requestId: number, eligibility = stripeEligibility) {
  const record = await ownedPaymentRequest(clientId, requestId);
  const quote = record.quotes[0], invoice = quote?.invoice;
  if (record.status !== "COMPLETED" || !invoice || record.quotes.length !== 1 || invoice.totalMillimes !== quote.amountMillimes) throw new PaymentError("Le paiement nécessite une intervention terminée et un prix final accepté.");
  if (invoice.status === "PAID") return { url: `${new URL(process.env.APP_ORIGIN || "http://localhost:3000").origin}/dashboard/paiements/${requestId}`, status: "PAID" };
  const { stripe, account, live, supportedCurrencies } = await eligibility();
  if (live) throw new PaymentError("Seul Stripe Test est autorisé.", 503);
  const prepared = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "ClientInvoice" WHERE "id" = ${invoice.id} FOR UPDATE`;
    const current = await tx.clientInvoice.findUniqueOrThrow({ where: { id: invoice.id } });
    if (current.status === "PAID") return { done: true as const };
    const balance = current.totalMillimes - current.paidMillimes;
    if (current.totalMillimes !== quote.amountMillimes || current.paidMillimes < 0 || balance <= 0) throw new PaymentError("Le solde doit être vérifié avant le paiement.");
    let attempt = await tx.checkoutPayment.findFirst({ where: { invoiceId: invoice.id, status: { in: ["CREATING", "OPEN", "PROCESSING", "SUCCEEDED"] } }, orderBy: { createdAt: "desc" } });
    if (attempt && (attempt.livemode || attempt.merchantAccountId !== account.id || attempt.amountMillimes !== balance || attempt.priorPaidMillimes !== current.paidMillimes)) throw new PaymentError("Le paiement existant doit être vérifié avant une nouvelle tentative.");
    // Retire every old Checkout before exposing a confirmable PaymentIntent.
    // An uncertain old creation must use the EXACT original idempotent payload.
    if (attempt && attempt.uiMode !== "payment_element") {
      if (!attempt.sessionId && +attempt.createdAt < Date.now() - 23 * 3600000) throw new PaymentError("Une ancienne tentative doit être vérifiée par l’assistance.");
      let session = attempt.sessionId ? await stripe.checkout.sessions.retrieve(attempt.sessionId)
        : await stripe.checkout.sessions.create(checkoutParameters(attempt, requestId), { idempotencyKey: `homefix-checkout-${attempt.id}` });
      if (!paymentMatches(attempt, session) || session.metadata?.paymentId !== attempt.id) throw new PaymentError("L’ancien paiement ne correspond pas à la facture.");
      if (session.status === "complete" || session.payment_status === "paid") return { done: true as const };
      if (session.status === "open") session = await stripe.checkout.sessions.expire(session.id);
      if (session.status !== "expired") throw new PaymentError("Un paiement est déjà en cours de vérification.");
      await tx.checkoutPayment.update({ where: { id: attempt.id }, data: { status: "EXPIRED", sessionId: session.id } });
      attempt = null;
    }
    if (attempt?.paymentIntentId) {
      const intent = await stripe.paymentIntents.retrieve(attempt.paymentIntentId);
      if (!matches(attempt, intent)) throw new PaymentError("Le paiement ne correspond pas à la facture.");
      if (intent.status !== "canceled") return { intent };
      await tx.checkoutPayment.update({ where: { id: attempt.id }, data: { status: "EXPIRED" } });
      attempt = null;
    }
    if (attempt && +attempt.createdAt < Date.now() - 23 * 3600000) throw new PaymentError("Cette tentative doit être vérifiée par l’assistance avant de réessayer.");
    if (!attempt) attempt = await tx.checkoutPayment.create({ data: { invoiceId: invoice.id, uiMode: "payment_element", amountMillimes: balance, priorPaidMillimes: current.paidMillimes, ...checkoutPlan(supportedCurrencies, balance), merchantAccountId: account.id, merchantCountry: account.country!, livemode: false } });
    return { attempt };
  }, { timeout: 30000 });
  if ("done" in prepared) return { url: `${new URL(process.env.APP_ORIGIN || "http://localhost:3000").origin}/dashboard/paiements/${requestId}`, status: "PROCESSING" };
  if ("intent" in prepared && prepared.intent) return result(prepared.intent, requestId);
  // Commit the attempt before the remote call: every tab and retry shares a key.
  const attempt = prepared.attempt!;
  const intent = await stripe.paymentIntents.create({ amount: attempt.stripeAmount ?? attempt.amountMillimes, currency: attempt.currency, allowed_payment_method_types: ["card"], capture_method: "automatic", metadata: { paymentId: attempt.id }, description: `HomeFix TN · Simulation de paiement · Intervention ${requestId}` }, { idempotencyKey: `homefix-card-${attempt.id}` });
  if (!matches(attempt, intent)) throw new PaymentError("Le paiement de test n’a pas pu être vérifié.", 502);
  await prisma.$transaction(async (tx) => {
    // A webhook can arrive before this write: never downgrade its terminal state.
    await tx.checkoutPayment.updateMany({ where: { id: attempt.id, status: "CREATING" }, data: { paymentIntentId: intent.id, status: "OPEN" } });
    const confirmed = await tx.serviceRequest.updateMany({ where: { id: requestId, clientConfirmedAt: null }, data: { clientConfirmedAt: new Date() } });
    if (confirmed.count) await tx.requestEvent.create({ data: { requestId, actorId: clientId, status: "COMPLETED", description: "Fin d’intervention validée par le client" } });
  });
  return result(intent, requestId);
}

export async function handleCardPaymentEvent(event: Stripe.Event, stripe = stripeClient()) {
  if (event.livemode) throw new PaymentError("Les événements Stripe réels sont interdits.", 400);
  if (!["payment_intent.succeeded", "payment_intent.processing", "payment_intent.payment_failed", "payment_intent.canceled"].includes(event.type)) return;
  if (await prisma.stripeWebhookEvent.findUnique({ where: { id: event.id } })) return;
  const supplied = event.data.object as Stripe.PaymentIntent;
  const payment = supplied.metadata?.paymentId ? await prisma.checkoutPayment.findUnique({ where: { id: supplied.metadata.paymentId } }) : null;
  if (!payment || payment.uiMode !== "payment_element") return;
  const intent = await stripe.paymentIntents.retrieve(supplied.id, { expand: ["latest_charge"] });
  const account = await stripe.accounts.retrieve(null);
  if (account.id !== payment.merchantAccountId || !matches(payment, intent)) throw new PaymentError("Incohérence de paiement Stripe.", 400);
  const paid = intent.status === "succeeded";
  if (paid && intent.amount_received !== (payment.stripeAmount ?? payment.amountMillimes)) throw new PaymentError("Le montant reçu n’est pas confirmé.", 400);
  const charge = typeof intent.latest_charge === "object" ? intent.latest_charge : null;
  const settled = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "ClientInvoice" WHERE "id" = ${payment.invoiceId} FOR UPDATE`;
    if (await tx.stripeWebhookEvent.findUnique({ where: { id: event.id } })) return null;
    const invoice = await tx.clientInvoice.findUniqueOrThrow({ where: { id: payment.invoiceId }, include: { quote: { include: { request: true } } } });
    const r = invoice.quote.request;
    if (invoice.totalMillimes !== payment.priorPaidMillimes + payment.amountMillimes || invoice.quote.status !== "ACCEPTED" || invoice.quote.amountMillimes !== invoice.totalMillimes || r.status !== "COMPLETED") throw new PaymentError("La facture ne correspond pas au prix accepté.", 400);
    await tx.stripeWebhookEvent.create({ data: { id: event.id, type: event.type } });
    if (invoice.status === "PAID") return null;
    if (invoice.paidMillimes !== payment.priorPaidMillimes) throw new PaymentError("Le solde du paiement doit être vérifié.");
    const fresh = await tx.checkoutPayment.findUniqueOrThrow({ where: { id: payment.id } });
    if (!paid) {
      // Failed cards remain retryable on the SAME PaymentIntent. Marking them
      // FAILED would let another tab create a second confirmable payment.
      if (!["SUCCEEDED", "EXPIRED"].includes(fresh.status)) await tx.checkoutPayment.update({ where: { id: payment.id }, data: { paymentIntentId: intent.id, status: intent.status === "canceled" ? "EXPIRED" : intent.status === "processing" ? "PROCESSING" : "OPEN" } });
      return null;
    }
    await tx.checkoutPayment.update({ where: { id: payment.id }, data: { paymentIntentId: intent.id, status: "SUCCEEDED" } });
    await tx.clientInvoice.update({ where: { id: invoice.id }, data: { status: "PAID", testPaid: true, paidMillimes: payment.priorPaidMillimes + payment.amountMillimes, paidAt: new Date(), paymentReference: intent.id, receiptUrl: charge?.receipt_url, receiptNumber: charge?.receipt_number } });
    await tx.serviceRequest.update({ where: { id: r.id }, data: { clientConfirmedAt: r.clientConfirmedAt || new Date() } });
    await tx.requestEvent.create({ data: { requestId: r.id, actorId: r.clientId, status: "PAID", description: "Paiement TEST confirmé par Stripe · Aucun débit réel" } });
    const users = await tx.user.findMany({ where: { id: { in: [r.clientId, r.professionalId] }, notificationEnabled: true }, select: { id: true } });
    const notifications = [];
    for (const user of users) notifications.push(await tx.clientNotification.create({ data: { userId: user.id, title: user.id === r.clientId ? "Paiement test réussi · Votre reçu est disponible" : "Le client a réglé l’intervention en mode TEST", type: "PAYMENT_RECEIVED", href: user.id === r.clientId ? `/dashboard/paiements/${r.id}` : `/professionnel/interventions?demande=${r.id}` } }));
    return { r, notifications };
  }, { timeout: 15000 });
  if (settled) {
    chatServer()?.to([userRoom(settled.r.clientId), userRoom(settled.r.professionalId)]).emit("intervention:updated", { requestId: settled.r.id, status: "COMPLETED" });
    for (const n of settled.notifications) chatServer()?.to(userRoom(n.userId)).emit("notification:new", { ...n, createdAt: n.createdAt.toISOString() });
  }
}
