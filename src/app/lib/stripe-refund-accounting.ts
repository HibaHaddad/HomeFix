import "server-only";
import type Stripe from "stripe";
import { prisma } from "./prisma";
import { accountRefund } from "./payment-accounting";
import { PaymentError } from "./stripe-payments";
import { handleAdminRefundEvent } from "./admin-refunds";

export async function handleAccountingRefundEvent(event: Stripe.Event, stripe: Stripe) {
  if (event.livemode) throw new PaymentError("Les événements Stripe réels sont interdits.", 400);
  if (!["refund.created", "refund.updated", "refund.failed", "charge.refunded"].includes(event.type)) return;
  if (await prisma.stripeWebhookEvent.findUnique({ where: { id: event.id } })) return;
  const supplied = event.data.object as Stripe.Refund | Stripe.Charge;
  const intentId = typeof supplied.payment_intent === "string" ? supplied.payment_intent : supplied.payment_intent?.id;
  if (!intentId) return;
  const payment = await prisma.checkoutPayment.findUnique({ where: { paymentIntentId: intentId } });
  if (!payment) {
    // Do not acknowledge a refund that overtook settlement / intent persistence.
    const intent = await stripe.paymentIntents.retrieve(intentId);
    if (intent.metadata?.paymentId && await prisma.checkoutPayment.findUnique({ where: { id: intent.metadata.paymentId } })) throw new PaymentError("Confirmation initiale du paiement en attente.");
    return;
  }
  const [account, intent] = await Promise.all([stripe.accounts.retrieve(null), stripe.paymentIntents.retrieve(intentId)]);
  if (payment.livemode || account.id !== payment.merchantAccountId || intent.livemode || intent.status !== "succeeded" || intent.metadata?.paymentId !== payment.id || intent.currency !== payment.currency || intent.amount_received !== (payment.stripeAmount ?? payment.amountMillimes)) throw new PaymentError("Le remboursement ne correspond pas au paiement.", 400);
  // Retrieve current objects rather than trusting delivery order or event payloads.
  // charge.refunded can contain only the first page of refunds.
  const refunds: Stripe.Refund[] = [];
  if (event.type === "charge.refunded") {
    let after: string | undefined;
    do {
      const page = await stripe.refunds.list({ payment_intent: intentId, limit: 100, ...(after ? { starting_after: after } : {}) });
      refunds.push(...page.data);
      after = page.has_more ? page.data.at(-1)?.id : undefined;
      if (page.has_more && !after) throw new PaymentError("Liste des remboursements incomplète.");
    } while (after);
  } else refunds.push(await stripe.refunds.retrieve(supplied.id));
  await handleAdminRefundEvent(event, stripe);
  // Serialize retrieval as well as accounting, so a late failed/pending snapshot
  // cannot overwrite a newer succeeded state from another webhook worker.
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "ClientInvoice" WHERE "id" = ${payment.invoiceId} FOR UPDATE`;
    if (await tx.stripeWebhookEvent.findUnique({ where: { id: event.id } })) return;
    for (const snapshot of refunds) {
      const remote = await stripe.refunds.retrieve(snapshot.id);
      const remoteIntent = typeof remote.payment_intent === "string" ? remote.payment_intent : remote.payment_intent?.id;
      if (remoteIntent !== intentId || remote.currency !== payment.currency || !Number.isSafeInteger(remote.amount) || remote.amount <= 0) throw new PaymentError("Montant de remboursement invalide.", 400);
      await accountRefund(tx, await tx.checkoutPayment.findUniqueOrThrow({ where: { id: payment.id } }), remote);
    }
    await tx.stripeWebhookEvent.create({ data: { id: event.id, type: event.type } });
  }, { timeout: 30000 });
}
