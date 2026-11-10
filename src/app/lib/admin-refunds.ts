import "server-only";
import type Stripe from "stripe";
import { prisma } from "./prisma";
import { stripeClient } from "./stripe-payments";
import { audit } from "./admin-audit";
import { AdminActionError } from "@/lib/admin-validation";

export async function reconcileRefund(refundId: string, stripe = stripeClient()) {
  const record = await prisma.adminRefund.findUnique({ where: { id: refundId }, include: { payment: true } });
  if (!record || !record.payment.paymentIntentId || record.payment.livemode) throw new AdminActionError("Remboursement Test introuvable.", 404);
  const payment = record.payment;
  const account = await stripe.accounts.retrieve(null);
  if (account.id !== payment.merchantAccountId) throw new AdminActionError("Le compte marchand ne correspond pas au paiement.", 409);
  const intent = await stripe.paymentIntents.retrieve(payment.paymentIntentId!, { expand: ["latest_charge"] });
  if (intent.livemode || intent.status !== "succeeded" || intent.currency !== payment.currency || intent.amount_received !== (payment.stripeAmount ?? payment.amountMillimes) || intent.metadata.paymentId !== payment.id) throw new AdminActionError("Le paiement Stripe Test ne correspond pas à la transaction.", 409);
  let remote: Stripe.Refund | undefined;
  if (record.stripeRefundId) remote = await stripe.refunds.retrieve(record.stripeRefundId);
  else {
    // Recover an uncertain external result before retrying the persistent key.
    const existing = await stripe.refunds.list({ payment_intent: intent.id, limit: 100 });
    remote = existing.data.find(r => r.metadata?.homefixRefundId === record.id);
    if (!remote) {
      const charge = intent.latest_charge;
      if (!charge || typeof charge === "string" || charge.amount_refunded !== 0 || existing.has_more || existing.data.some(r => !["failed", "canceled"].includes(r.status ?? ""))) throw new AdminActionError("Un remboursement externe existe déjà. Vérification manuelle nécessaire.", 409);
      if (+record.createdAt < Date.now() - 23 * 3600000) throw new AdminActionError("Cette tentative ancienne doit être vérifiée dans Stripe avant toute nouvelle opération.", 409);
      remote = await stripe.refunds.create({ payment_intent: intent.id, amount: payment.stripeAmount ?? payment.amountMillimes, metadata: { homefixRefundId: record.id, paymentId: payment.id } }, { idempotencyKey: `homefix-admin-refund-${record.id}` });
    }
  }
  const remoteIntentId = typeof remote.payment_intent === "string" ? remote.payment_intent : remote.payment_intent?.id;
  if (remoteIntentId !== intent.id || remote.currency !== payment.currency || remote.amount !== (payment.stripeAmount ?? payment.amountMillimes) || remote.metadata?.homefixRefundId !== record.id) throw new AdminActionError("La réponse Stripe ne correspond pas au remboursement attendu.", 409);
  const state = remote.status === "succeeded" ? "SUCCEEDED" : ["failed", "canceled"].includes(remote.status ?? "") ? "FAILED" : "PENDING";
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "ClientInvoice" WHERE "id" = ${payment.invoiceId} FOR UPDATE`;
    const current = await tx.adminRefund.findUniqueOrThrow({ where: { id: record.id } });
    if (current.status === "SUCCEEDED") return;
    const changed = current.status !== state || current.stripeRefundId !== remote!.id;
    await tx.adminRefund.update({ where: { id: record.id }, data: { status: state, stripeRefundId: remote!.id } });
    const actor = await tx.user.findUnique({ where: { id: record.actorId }, select: { id: true, name: true } }) ?? { id: record.actorId, name: "Administrateur archivé" };
    if (changed) await audit(tx, actor, `REFUND_${state}`, `payment:${payment.id}`, record.reason, { refundId: record.id, stripeRefundId: remote!.id, amountMillimes: record.amountMillimes, source: "Stripe Test" });
    if (state === "SUCCEEDED") {
      await tx.checkoutPayment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } });
      const invoice = await tx.clientInvoice.update({ where: { id: payment.invoiceId }, data: { status: "REFUNDED", paidMillimes: { decrement: payment.amountMillimes } }, include: { quote: { select: { requestId: true, request: { select: { clientId: true, professionalId: true } } } } } });
      await tx.requestEvent.create({ data: { requestId: invoice.quote.requestId, actorId: record.actorId, status: "REFUNDED", description: "Remboursement intégral du paiement Stripe Test confirmé" } });
      await tx.clientNotification.createMany({ data: [invoice.quote.request.clientId, invoice.quote.request.professionalId].map(userId => ({ userId, title: "Un paiement a été remboursé en mode Stripe Test", href: userId === invoice.quote.request.clientId ? `/dashboard/paiements/${invoice.quote.requestId}` : "/professionnel/revenus", type: "INFO" })) });
    }
  });
  return { status: state, stripeRefundId: remote.id };
}

export async function requestAdminRefund(paymentId: string, reason: string, admin: { id: number; name: string }, stripe = stripeClient()) {
  const payment = await prisma.checkoutPayment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new AdminActionError("Transaction introuvable.", 404);
  if (payment.livemode || !payment.paymentIntentId || !["SUCCEEDED", "REFUNDED"].includes(payment.status)) throw new AdminActionError("Seul un paiement Stripe Test confirmé peut être remboursé.", 409);
  const refund = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "ClientInvoice" WHERE "id" = ${payment.invoiceId} FOR UPDATE`;
    const existing = await tx.adminRefund.findUnique({ where: { paymentId } });
    if (existing) return existing;
    const invoice = await tx.clientInvoice.findUniqueOrThrow({ where: { id: payment.invoiceId } });
    if (invoice.status !== "PAID" || invoice.paidMillimes < payment.amountMillimes) throw new AdminActionError("La facture n’est pas remboursable.", 409);
    const created = await tx.adminRefund.create({ data: { paymentId, actorId: admin.id, reason, amountMillimes: payment.amountMillimes } });
    await audit(tx, admin, "REFUND_REQUEST", `payment:${paymentId}`, reason, { refundId: created.id, amountMillimes: payment.amountMillimes });
    return created;
  });
  if (refund.status === "SUCCEEDED") return { status: refund.status, stripeRefundId: refund.stripeRefundId };
  return reconcileRefund(refund.id, stripe);
}

export async function handleAdminRefundEvent(event: Stripe.Event, stripe: Stripe) {
  if (event.livemode || !["refund.created", "refund.updated", "refund.failed"].includes(event.type)) return;
  const supplied = event.data.object as Stripe.Refund;
  const refundId = supplied.metadata?.homefixRefundId;
  if (!refundId || !await prisma.adminRefund.findUnique({ where: { id: refundId }, select: { id: true } })) return;
  await reconcileRefund(refundId, stripe);
}
