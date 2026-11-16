import assert from "node:assert/strict";
import { test } from "node:test";
import { registerHooks } from "node:module";
import { SignJWT } from "jose";
import { PDFDocument } from "pdf-lib";
import { prisma } from "../src/app/lib/prisma.ts";
registerHooks({ resolve(specifier, context, next) { return specifier === "server-only" ? { url: "data:text/javascript,export{}", shortCircuit: true } : next(specifier, context); } });
const { handleStripeEvent } = await import("../src/app/lib/stripe-payments.ts");
const { requestAdminRefund } = await import("../src/app/lib/admin-refunds.ts");
const { buildProfessionalFinance } = await import("../src/lib/professional-finance.ts");
const base = process.env.ADMIN_TEST_URL || "http://localhost:3000";

test("webhook allocations: fixed rates, duplicate delivery, partial/full refunds, receipts and Admin permissions", { timeout: 180000 }, async () => {
  const marker = `Accounting QA ${crypto.randomUUID()}`, users = [], invoices = [], events = [];
  const beforeSetting = await prisma.adminSetting.findUnique({ where: { key: "PAYMENT_COMMISSION" } });
  const remoteRefunds = new Map(), intents = new Map(), sessions = new Map();
  const stripe = {
    accounts: { retrieve: async () => ({ id: "acct_accounting_fixture" }) },
    paymentIntents: { retrieve: async id => structuredClone(intents.get(id)) },
    checkout: { sessions: { retrieve: async id => structuredClone(sessions.get(id)) } },
    refunds: {
      retrieve: async id => structuredClone(remoteRefunds.get(id)),
      list: async params => ({ data: [...remoteRefunds.values()].filter(refund => refund.payment_intent === params.payment_intent), has_more: false }),
      create: async params => {
        const refund = { id: `re_${crypto.randomUUID()}`, payment_intent: params.payment_intent, amount: params.amount, currency: "eur", status: "succeeded", metadata: params.metadata };
        remoteRefunds.set(refund.id, refund); return refund;
      },
    },
  };
  async function user(role) {
    const actor = await prisma.user.create({ data: { name: marker, email: `${crypto.randomUUID()}@example.invalid`, password: "fixture", role, status: role === "PROFESSIONAL" ? "APPROVED" : "ACTIVE", notificationEnabled: false } });
    users.push(actor.id);
    const token = await new SignJWT({ userId: actor.id }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("10m").sign(new TextEncoder().encode(process.env.JWT_SECRET));
    return { ...actor, headers: { Cookie: `session=${token}`, Origin: base, "Content-Type": "application/json" } };
  }
  async function event(type, object) {
    const e = { id: `evt_accounting_${crypto.randomUUID()}`, type, livemode: false, created: Math.floor(Date.now() / 1000), data: { object } };
    events.push(e.id); await handleStripeEvent(e, stripe); return e;
  }
  try {
    const admin = await user("ADMIN"), client = await user("CLIENT"), pro = await user("PROFESSIONAL"), stranger = await user("PROFESSIONAL");
    async function settings(actor, bps) {
      return fetch(`${base}/api/admin/settings`, { method: "PUT", headers: actor?.headers ?? { Origin: base, "Content-Type": "application/json" }, body: JSON.stringify({ key: "PAYMENT_COMMISSION", value: { commissionBps: bps } }) });
    }
    assert.equal((await settings(null, 1000)).status, 401);
    assert.equal((await settings(client, 1000)).status, 403);
    assert.equal((await settings(admin, 10001)).status, 400);
    assert.equal((await settings(admin, 1000.5)).status, 400);
    assert.equal((await settings(admin, 1000)).status, 200);
    async function prepare(uiMode) {
      const request = await prisma.serviceRequest.create({ data: { clientId: client.id, professionalId: pro.id, kind: "INTERVENTION", status: "COMPLETED", title: marker, message: "Accounting fixture" } });
      const quote = await prisma.quote.create({ data: { requestId: request.id, status: "ACCEPTED", amountMillimes: 80501, details: "Fixture", validUntil: new Date("2030-01-01") } });
      const invoice = await prisma.clientInvoice.create({ data: { quoteId: quote.id, totalMillimes: 80501, depositMillimes: 0 } }); invoices.push(invoice.id);
      const payment = await prisma.checkoutPayment.create({ data: { invoiceId: invoice.id, amountMillimes: 80501, stripeAmount: 2415, currency: "eur", status: "OPEN", merchantAccountId: "acct_accounting_fixture", merchantCountry: "FR", livemode: false, uiMode } });
      const intent = { id: `pi_${crypto.randomUUID()}`, status: "succeeded", amount: 2415, amount_received: 2415, currency: "eur", livemode: false, metadata: { paymentId: payment.id }, latest_charge: null };
      intents.set(intent.id, intent);
      await prisma.checkoutPayment.update({ where: { id: payment.id }, data: { paymentIntentId: intent.id } });
      return { payment, intent, invoice, request };
    }
    const first = await prepare("payment_element");
    const paid = await event("payment_intent.succeeded", first.intent);
    await Promise.all([handleStripeEvent(paid, stripe), event("payment_intent.succeeded", first.intent)]);
    let allocation = await prisma.paymentAllocation.findUniqueOrThrow({ where: { paymentId: first.payment.id } });
    assert.equal(allocation.commissionBps, 1000);
    assert.equal(allocation.commissionMillimes, 8050);
    assert.equal(allocation.professionalMillimes, 72451);
    assert.equal(await prisma.paymentAllocation.count({ where: { paymentId: first.payment.id } }), 1);
    assert.equal((await settings(admin, 1250)).status, 200);
    const second = await prepare("hosted_page");
    const session = { id: `cs_${crypto.randomUUID()}`, status: "complete", payment_status: "paid", mode: "payment", amount_total: 2415, currency: "eur", livemode: false, client_reference_id: second.payment.id, metadata: { paymentId: second.payment.id }, payment_intent: second.intent };
    sessions.set(session.id, session);
    await event("checkout.session.completed", session);
    assert.equal((await prisma.paymentAllocation.findUniqueOrThrow({ where: { paymentId: second.payment.id } })).commissionBps, 1250);
    assert.equal((await prisma.paymentAllocation.findUniqueOrThrow({ where: { paymentId: first.payment.id } })).commissionBps, 1000, "settings must not rewrite historical rates");
    const receipt = `${base}/api/professionnel/paiements/${first.payment.id}/recu`;
    assert.equal((await fetch(receipt)).status, 401);
    assert.equal((await fetch(receipt, { headers: client.headers })).status, 403);
    assert.equal((await fetch(receipt, { headers: stranger.headers })).status, 404);
    const proPdf = await fetch(receipt, { headers: pro.headers }); assert.equal(proPdf.status, 200);
    assert.equal((await PDFDocument.load(await proPdf.arrayBuffer())).getPageCount(), 1);
    const clientPdf = await fetch(`${base}/api/client/factures/${first.invoice.id}/pdf`, { headers: client.headers }); assert.equal(clientPdf.status, 200);
    assert.equal((await PDFDocument.load(await clientPdf.arrayBuffer())).getPageCount(), 1);
    const refund = { id: `re_${crypto.randomUUID()}`, payment_intent: first.intent.id, currency: "eur", amount: 805, status: "pending", metadata: {} };
    remoteRefunds.set(refund.id, refund);
    await event("refund.created", refund);
    assert.equal((await prisma.paymentAllocation.findUniqueOrThrow({ where: { paymentId: first.payment.id } })).refundedMillimes, 0);
    refund.status = "succeeded";
    const refunded = await event("refund.updated", refund);
    await Promise.all([handleStripeEvent(refunded, stripe), event("refund.updated", refund)]);
    allocation = await prisma.paymentAllocation.findUniqueOrThrow({ where: { paymentId: first.payment.id } });
    assert.equal(allocation.refundedMillimes, 26834);
    assert.equal(allocation.refundedCommissionMillimes, 2683);
    assert.equal(allocation.refundedProfessionalMillimes, 24151);
    assert.equal((await prisma.checkoutPayment.findUniqueOrThrow({ where: { id: first.payment.id } })).status, "PARTIALLY_REFUNDED");
    assert.equal((await prisma.clientInvoice.findUniqueOrThrow({ where: { id: first.invoice.id } })).paidMillimes, 53667);
    const stale = { ...refund, status: "pending" };
    await event("refund.created", stale);
    assert.equal((await prisma.paymentAllocation.findUniqueOrThrow({ where: { paymentId: first.payment.id } })).refundedMillimes, 26834, "current Stripe state defeats out-of-order payloads");
    const finalRefund = { ...refund, id: `re_${crypto.randomUUID()}`, amount: 1610 };
    remoteRefunds.set(finalRefund.id, finalRefund);
    await event("charge.refunded", { id: "ch_fixture", payment_intent: first.intent.id });
    allocation = await prisma.paymentAllocation.findUniqueOrThrow({ where: { paymentId: first.payment.id } });
    assert.equal(allocation.refundedCommissionMillimes, allocation.commissionMillimes);
    assert.equal(allocation.refundedProfessionalMillimes, allocation.professionalMillimes);
    assert.equal((await prisma.clientInvoice.findUniqueOrThrow({ where: { id: first.invoice.id } })).paidMillimes, 0);
    await event("payment_intent.succeeded", first.intent);
    assert.equal((await prisma.checkoutPayment.findUniqueOrThrow({ where: { id: first.payment.id } })).status, "REFUNDED");
    const input = await prisma.clientInvoice.findMany({ where: { id: { in: invoices } }, include: { quote: { include: { request: { include: { client: { select: { name: true } } } } } }, payments: { include: { allocation: true } } } });
    const finance = buildProfessionalFinance(input, null);
    const secondAllocation = await prisma.paymentAllocation.findUniqueOrThrow({ where: { paymentId: second.payment.id } });
    assert.equal(finance.netMillimes, secondAllocation.professionalMillimes);
    assert.equal(finance.commissionsMillimes, secondAllocation.commissionMillimes);
    assert.equal(finance.refundedMillimes, 80501);
    second.intent.latest_charge = { id: "ch_second_fixture", amount_refunded: 0 };
    const adminRefundResult = await requestAdminRefund(second.payment.id, "Verify full commissioned payment refund", admin, stripe);
    assert.equal(adminRefundResult.status, "SUCCEEDED");
    const afterAdminRefund = await prisma.paymentAllocation.findUniqueOrThrow({ where: { paymentId: second.payment.id } });
    assert.equal(afterAdminRefund.refundedCommissionMillimes, secondAllocation.commissionMillimes);
    assert.equal(afterAdminRefund.refundedProfessionalMillimes, secondAllocation.professionalMillimes);
    await assert.rejects(handleStripeEvent({ id: "evt_live_forbidden", type: "refund.updated", livemode: true, data: { object: refund } }, stripe), /réels/);
  } finally {
    if (beforeSetting) await prisma.adminSetting.upsert({ where: { key: beforeSetting.key }, create: beforeSetting, update: { value: beforeSetting.value } });
    else await prisma.adminSetting.deleteMany({ where: { key: "PAYMENT_COMMISSION" } });
    await prisma.clientNotification.deleteMany({ where: { OR: [{ userId: { in: users } }, { title: { startsWith: marker } }] } });
    await prisma.adminAuditLog.deleteMany({ where: { actorId: { in: users } } });
    await prisma.stripeWebhookEvent.deleteMany({ where: { id: { in: events } } });
    await prisma.adminRefund.deleteMany({ where: { payment: { invoiceId: { in: invoices } } } });
    await prisma.checkoutPayment.deleteMany({ where: { invoiceId: { in: invoices } } });
    await prisma.clientInvoice.deleteMany({ where: { id: { in: invoices } } });
    await prisma.serviceRequest.deleteMany({ where: { clientId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  }
});
