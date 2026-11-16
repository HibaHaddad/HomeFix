import "server-only";
import type Stripe from "stripe";
import type { CheckoutPayment, Prisma } from "@/generated/prisma/client";
import { DEFAULT_COMMISSION_BPS, paymentSplit, refundSplit, validateCommissionBps } from "@/lib/payment-allocation";
import { prisma } from "./prisma";

export async function getCommissionBps(db: Pick<Prisma.TransactionClient, "adminSetting"> = prisma) {
  const setting = await db.adminSetting.findUnique({ where: { key: "PAYMENT_COMMISSION" } });
  if (!setting) return DEFAULT_COMMISSION_BPS;
  const value = setting.value as { commissionBps?: unknown } | null;
  return validateCommissionBps(value?.commissionBps);
}

// Call within the invoice-locking settlement transaction. The unique payment key
// protects every webhook type and retry, independently of Stripe event IDs.
export async function allocatePayment(tx: Prisma.TransactionClient, payment: CheckoutPayment, professionalId: number, historical = false) {
  if (payment.livemode) throw new Error("Les paiements réels sont interdits.");
  const existing = await tx.paymentAllocation.findUnique({ where: { paymentId: payment.id } });
  if (existing) return existing;
  const commissionBps = historical ? 0 : await getCommissionBps(tx);
  return tx.paymentAllocation.create({ data: { paymentId: payment.id, professionalId, commissionBps, ...paymentSplit(payment.amountMillimes, commissionBps), historical } });
}

// The caller verifies the refund against Stripe and holds the ClientInvoice lock.
// Recompute from the unique remote refunds, so partial refunds and retries share
// the same cumulative rounding and a full refund always clears both balances.
export async function accountRefund(tx: Prisma.TransactionClient, payment: CheckoutPayment, remote: Stripe.Refund) {
  if (payment.livemode || !["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(payment.status)) throw new Error("Le paiement doit être confirmé avant son remboursement.");
  const invoice = await tx.clientInvoice.findUniqueOrThrow({
    where: { id: payment.invoiceId },
    include: { quote: { select: { request: { select: { professionalId: true } } } } },
  });
  const allocation = await allocatePayment(tx, payment, invoice.quote.request.professionalId, true);
  const prior = await tx.paymentAccountingRefund.findUnique({ where: { stripeRefundId: remote.id } });
  if (prior && prior.paymentId !== payment.id) throw new Error("Remboursement associé à un autre paiement.");
  await tx.paymentAccountingRefund.upsert({ where: { stripeRefundId: remote.id }, create: { stripeRefundId: remote.id, paymentId: payment.id, stripeAmount: remote.amount, status: remote.status ?? "pending" }, update: { stripeAmount: remote.amount, status: remote.status ?? "pending" } });
  const total = await tx.paymentAccountingRefund.aggregate({ where: { paymentId: payment.id, status: "succeeded" }, _sum: { stripeAmount: true } });
  const split = refundSplit(allocation, total._sum.stripeAmount ?? 0, payment.stripeAmount ?? payment.amountMillimes);
  const delta = split.refundedMillimes - allocation.refundedMillimes;
  if (delta) {
    if (invoice.paidMillimes - delta < 0 || invoice.paidMillimes - delta > invoice.totalMillimes) throw new Error("Le solde de la facture ne correspond pas au remboursement.");
    await tx.clientInvoice.update({ where: { id: invoice.id }, data: { paidMillimes: { decrement: delta }, status: split.refundedMillimes === allocation.grossMillimes ? "REFUNDED" : "PAID" } });
  }
  await tx.paymentAllocation.update({ where: { paymentId: payment.id }, data: split });
  await tx.checkoutPayment.update({ where: { id: payment.id }, data: { status: split.refundedMillimes === allocation.grossMillimes ? "REFUNDED" : split.refundedMillimes > 0 ? "PARTIALLY_REFUNDED" : "SUCCEEDED" } });
  return { delta, ...split };
}

export async function accountingTotals(db: Pick<Prisma.TransactionClient, "paymentAllocation" | "professionalSanction"> = prisma) {
  const rows = await db.paymentAllocation.aggregate({ _sum: { grossMillimes: true, commissionMillimes: true, professionalMillimes: true, refundedMillimes: true, refundedCommissionMillimes: true, refundedProfessionalMillimes: true } });
  const sum = rows._sum;
  const sanctions = await db.professionalSanction.aggregate({ where: { status: "APPLIED" }, _sum: { amountMillimes: true } });
  const penalties = sanctions._sum.amountMillimes ?? 0;
  return { gross: sum.grossMillimes ?? 0, refunded: sum.refundedMillimes ?? 0, commissions: (sum.commissionMillimes ?? 0) - (sum.refundedCommissionMillimes ?? 0), professionals: (sum.professionalMillimes ?? 0) - (sum.refundedProfessionalMillimes ?? 0) - penalties, penalties };
}
