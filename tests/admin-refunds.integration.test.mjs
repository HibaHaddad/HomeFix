// Real PostgreSQL; Stripe is an isolated in-process double. No external refund calls.
import assert from "node:assert/strict";
import { test } from "node:test";
import { registerHooks } from "node:module";
import { prisma } from "../src/app/lib/prisma.ts";
registerHooks({ resolve(specifier, context, next) { return specifier === "server-only" ? { url: "data:text/javascript,export{}", shortCircuit: true } : next(specifier, context); } });
const { requestAdminRefund, reconcileRefund } = await import("../src/app/lib/admin-refunds.ts");
const { createCheckout } = await import("../src/app/lib/stripe-payments.ts");
const { createCardPayment, handleCardPaymentEvent } = await import("../src/app/lib/card-payments.ts");

test("Admin refunds recover network uncertainty, remain Test-only, and cannot settle twice", async () => {
  const marker = `Refund QA ${crypto.randomUUID()}`, ids = [];
  let request, invoice, payment;
  async function user(role) {
    const u = await prisma.user.create({ data: { name: marker, email: `${crypto.randomUUID()}@example.invalid`, password: "not-a-login", role, status: role === "PROFESSIONAL" ? "APPROVED" : "ACTIVE", notificationEnabled: false } }); ids.push(u.id); return u;
  }
  try {
    const admin = await user("ADMIN"), client = await user("CLIENT"), pro = await user("PROFESSIONAL");
    request = await prisma.serviceRequest.create({ data: { clientId: client.id, professionalId: pro.id, kind: "INTERVENTION", message: "Fixture", title: marker, status: "COMPLETED" } });
    const quote = await prisma.quote.create({ data: { requestId: request.id, amountMillimes: 10000, details: "Fixture", status: "ACCEPTED", validUntil: new Date(Date.now() + 86400000) } });
    invoice = await prisma.clientInvoice.create({ data: { quoteId: quote.id, totalMillimes: 10000, depositMillimes: 0, paidMillimes: 10000, status: "PAID", testPaid: true } });
    payment = await prisma.checkoutPayment.create({ data: { invoiceId: invoice.id, amountMillimes: 10000, stripeAmount: 300, currency: "eur", status: "SUCCEEDED", paymentIntentId: `pi_fixture_${crypto.randomUUID()}`, merchantAccountId: "acct_refund_fixture", merchantCountry: "FR", livemode: false, uiMode: "payment_element" } });
    let remote = null, creates = 0, uncertain = true;
    const intent = { id: payment.paymentIntentId, livemode: false, status: "succeeded", currency: "eur", amount: 300, amount_received: 300, metadata: { paymentId: payment.id }, latest_charge: { id: "ch_fixture", amount_refunded: 0 } };
    const stripe = {
      accounts: { retrieve: async () => ({ id: "acct_refund_fixture" }) },
      paymentIntents: { retrieve: async () => intent },
      refunds: {
        list: async () => ({ data: remote ? [remote] : [], has_more: false }),
        retrieve: async () => remote,
        create: async (params, options) => {
          creates++;
          assert.match(options.idempotencyKey, /^homefix-admin-refund-/);
          assert.equal(params.amount, 300, "refund the original Stripe minor amount, not TND millimes");
          remote = { id: "re_fixture", payment_intent: intent.id, amount: 300, currency: "eur", metadata: params.metadata, status: "pending" };
          if (uncertain) { uncertain = false; throw new Error("Simulated response lost after remote creation"); }
          return remote;
        },
      },
    };
    intent.livemode = true;
    await assert.rejects(requestAdminRefund(payment.id, "Examine Test refund fixture", admin, stripe), /ne correspond pas/);
    assert.equal(creates, 0);
    intent.livemode = false;
    await assert.rejects(requestAdminRefund(payment.id, "Examine Test refund fixture", admin, stripe), /Simulated response lost/);
    assert.equal(creates, 1);
    const refund = await prisma.adminRefund.findUniqueOrThrow({ where: { paymentId: payment.id } });
    assert.equal(refund.status, "PENDING");
    await requestAdminRefund(payment.id, "Retry existing fixture safely", admin, stripe);
    assert.equal(creates, 1);
    assert.equal((await prisma.clientInvoice.findUniqueOrThrow({ where: { id: invoice.id } })).status, "PAID", "pending is not successful");
    remote.status = "succeeded";
    await Promise.all([reconcileRefund(refund.id, stripe), reconcileRefund(refund.id, stripe)]);
    const stored = await prisma.clientInvoice.findUniqueOrThrow({ where: { id: invoice.id } });
    assert.equal(stored.status, "REFUNDED");
    assert.equal(stored.paidMillimes, 0);
    assert.equal((await prisma.checkoutPayment.findUniqueOrThrow({ where: { id: payment.id } })).status, "REFUNDED");
    assert.equal(await prisma.adminAuditLog.count({ where: { actorId: admin.id, action: "REFUND_SUCCEEDED" } }), 1);
    await requestAdminRefund(payment.id, "Repeated fixture request", admin, stripe);
    assert.equal(creates, 1);
    const forbidEligibility = async () => { throw new Error("No new payment should be prepared"); };
    await assert.rejects(createCardPayment(client.id, request.id, forbidEligibility), /remboursé/);
    await assert.rejects(createCheckout(client.id, request.id, forbidEligibility), /remboursé/);
    const eventId = `evt_fixture_${crypto.randomUUID()}`;
    await handleCardPaymentEvent({ id: eventId, type: "payment_intent.succeeded", livemode: false, data: { object: intent } }, stripe);
    assert.equal((await prisma.clientInvoice.findUniqueOrThrow({ where: { id: invoice.id } })).status, "REFUNDED", "late webhook must not restore a refunded invoice");
    await prisma.stripeWebhookEvent.deleteMany({ where: { id: eventId } });
  } finally {
    await prisma.clientNotification.deleteMany({ where: { OR: [{ userId: { in: ids } }, { title: { startsWith: marker } }] } });
    await prisma.adminAuditLog.deleteMany({ where: { actorId: { in: ids } } });
    if (payment) { await prisma.adminRefund.deleteMany({ where: { paymentId: payment.id } }); await prisma.checkoutPayment.delete({ where: { id: payment.id } }); }
    if (invoice) await prisma.clientInvoice.delete({ where: { id: invoice.id } });
    if (request) await prisma.serviceRequest.delete({ where: { id: request.id } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
});
