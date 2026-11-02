import assert from "node:assert/strict";
import { test } from "node:test";
import { registerHooks } from "node:module";
import { prisma } from "../src/app/lib/prisma.ts";
registerHooks({ resolve(specifier, context, next) { return specifier === "server-only" ? { url: "data:text/javascript,export{}", shortCircuit: true } : next(specifier, context); } });
const { createCardPayment } = await import("../src/app/lib/card-payments.ts");
const { handleStripeEvent, stripeEligibility } = await import("../src/app/lib/stripe-payments.ts");

test("Elements: concurrent retries, refusal, signed settlement, out-of-order events and legacy retirement", { timeout: 60000 }, async () => {
  const ids = [], events = [], invoices = [];
  const envNames = ["STRIPE_SECRET_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_TEST_CURRENCY", "STRIPE_TEST_EXCHANGE_RATE"];
  const saved = Object.fromEntries(envNames.map(k => [k, process.env[k]]));
  Object.assign(process.env, { STRIPE_SECRET_KEY: "sk_test_unit", NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_unit", STRIPE_WEBHOOK_SECRET: "whsec_unit", STRIPE_TEST_CURRENCY: "eur", STRIPE_TEST_EXCHANGE_RATE: "0.30" });
  const intents = new Map(), keys = new Map(), sessions = new Map();
  let uncertain = true, checkoutCreations = 0;
  const account = { id: "acct_elements_unit", country: "US" };
  const gateway = {
    accounts: { retrieve: async () => account }, countrySpecs: { retrieve: async () => ({ supported_payment_currencies: ["eur", "usd"] }) },
    paymentIntents: {
      create: async (params, options) => {
        assert.deepEqual(params.allowed_payment_method_types, ["card"]);
        assert.equal(params.capture_method, "automatic");
        let intent = keys.get(options.idempotencyKey);
        if (!intent) {
          intent = { id: `pi_${crypto.randomUUID()}`, client_secret: `pi_unit_secret_${crypto.randomUUID()}`, currency: params.currency, amount: params.amount, amount_received: 0, status: "requires_payment_method", metadata: params.metadata, livemode: false, latest_charge: null };
          keys.set(options.idempotencyKey, intent); intents.set(intent.id, intent);
        }
        if (uncertain) { uncertain = false; throw new Error("Uncertain network response"); }
        return structuredClone(intent);
      },
      retrieve: async (id) => structuredClone(intents.get(id)),
    },
    checkout: { sessions: {
      create: async (params) => {
        checkoutCreations++;
        const session = { id: `cs_test_${crypto.randomUUID()}`, status: "open", payment_status: "unpaid", amount_total: params.line_items[0].price_data.unit_amount, currency: params.line_items[0].price_data.currency, metadata: params.metadata, livemode: false };
        sessions.set(session.id, session); return session;
      },
      retrieve: async (id) => structuredClone(sessions.get(id)),
      expire: async (id) => { const s = sessions.get(id); s.status = "expired"; return structuredClone(s); },
    } },
  };
  const eligibility = () => stripeEligibility(gateway);
  async function fixture(clientId, professionalId, total = 80501, paid = 20000) {
    const request = await prisma.serviceRequest.create({ data: { clientId, professionalId, kind: "INTERVENTION", status: "COMPLETED", title: "Elements test", message: "Isolated fixture" } });
    const quote = await prisma.quote.create({ data: { requestId: request.id, status: "ACCEPTED", amountMillimes: total, details: "Final price", validUntil: new Date("2030-01-01") } });
    const invoice = await prisma.clientInvoice.create({ data: { quoteId: quote.id, totalMillimes: total, paidMillimes: paid, depositMillimes: 0 } });
    invoices.push(invoice.id); return { request, invoice };
  }
  async function deliver(intent, type = "payment_intent.succeeded", overrides = {}) {
    const event = { id: `evt_unit_${crypto.randomUUID()}`, type, livemode: false, created: Math.floor(Date.now() / 1000), data: { object: structuredClone(intent) }, ...overrides };
    events.push(event.id); await handleStripeEvent(event, gateway); return event;
  }
  try {
    for (const role of ["CLIENT", "PROFESSIONAL", "CLIENT"]) {
      const u = await prisma.user.create({ data: { email: `elements-${crypto.randomUUID()}@example.invalid`, name: "Elements fixture", password: "not-a-login", role, status: role === "CLIENT" ? "ACTIVE" : "APPROVED", termsAccepted: true } }); ids.push(u.id);
    }
    const [client, professional, stranger] = ids;
    const { request, invoice } = await fixture(client, professional);
    await assert.rejects(() => createCardPayment(stranger, request.id, eligibility), /introuvable/);
    await assert.rejects(() => createCardPayment(client, request.id, eligibility), /Uncertain/);
    let attempt = await prisma.checkoutPayment.findFirstOrThrow({ where: { invoiceId: invoice.id } });
    assert.equal(attempt.status, "CREATING"); assert.equal(attempt.uiMode, "payment_element"); assert.equal(attempt.stripeAmount, 1815);
    const responses = await Promise.all(Array.from({ length: 5 }, () => createCardPayment(client, request.id, eligibility)));
    assert.equal(new Set(responses.map(r => r.clientSecret)).size, 1); assert.equal(keys.size, 1);
    assert.equal(checkoutCreations, 0, "New payments never create Checkout");
    assert.equal(await prisma.checkoutPayment.count({ where: { invoiceId: invoice.id } }), 1);
    attempt = await prisma.checkoutPayment.findUniqueOrThrow({ where: { id: attempt.id } });
    const intent = intents.get(attempt.paymentIntentId);
    await deliver(intent, "payment_intent.payment_failed");
    assert.equal((await prisma.checkoutPayment.findUniqueOrThrow({ where: { id: attempt.id } })).status, "OPEN");
    await createCardPayment(client, request.id, eligibility); assert.equal(keys.size, 1, "A declined card retries the same intent");
    intent.status = "processing";
    await deliver(intent, "payment_intent.processing");
    const processing = await createCardPayment(client, request.id, eligibility);
    assert.equal(processing.status, "PROCESSING"); assert.equal(processing.clientSecret, undefined);
    intent.status = "succeeded"; intent.amount_received = 1815;
    intent.latest_charge = { receipt_url: "https://pay.stripe.com/receipts/test", receipt_number: "elements-test" };
    intent.amount = 1814;
    await assert.rejects(() => deliver(intent), /Incohérence/);
    intent.amount = 1815; intent.amount_received = 1814;
    await assert.rejects(() => deliver(intent), /confirmé/);
    intent.amount_received = 1815;
    await assert.rejects(() => deliver(intent, "payment_intent.succeeded", { livemode: true }), /réels/);
    const success = await deliver(intent);
    await Promise.all([handleStripeEvent(success, gateway), deliver(intent)]);
    await deliver(intent, "payment_intent.payment_failed");
    const settled = await prisma.clientInvoice.findUniqueOrThrow({ where: { id: invoice.id } });
    assert.equal(settled.status, "PAID"); assert.equal(settled.paidMillimes, 80501); assert.equal(settled.testPaid, true);
    assert.equal(await prisma.requestEvent.count({ where: { requestId: request.id, status: "PAID" } }), 1);
    assert.equal(await prisma.clientNotification.count({ where: { userId: { in: [client, professional] }, type: "PAYMENT_RECEIVED" } }), 2);
    await createCardPayment(client, request.id, eligibility); assert.equal(keys.size, 1);

    const later = await fixture(client, professional, 50000, 0);
    await createCardPayment(client, later.request.id, eligibility);
    const beforeCancel = await prisma.checkoutPayment.findFirstOrThrow({ where: { invoiceId: later.invoice.id } });
    const canceled = intents.get(beforeCancel.paymentIntentId); canceled.status = "canceled";
    await deliver(canceled, "payment_intent.canceled");
    await Promise.all([createCardPayment(client, later.request.id, eligibility), createCardPayment(client, later.request.id, eligibility)]);
    assert.equal(keys.size, 3); assert.equal(await prisma.checkoutPayment.count({ where: { invoiceId: later.invoice.id, status: "OPEN" } }), 1);

    for (const uiMode of ["hosted_page", "embedded_page"]) {
      const legacy = await fixture(client, professional, 50000, 0);
      const old = await prisma.checkoutPayment.create({ data: { invoiceId: legacy.invoice.id, uiMode, amountMillimes: 50000, stripeAmount: 1500, currency: "eur", exchangeRatePpm: 300000, merchantAccountId: account.id, merchantCountry: account.country, livemode: false } });
      const next = await createCardPayment(client, legacy.request.id, eligibility);
      assert.ok(next.clientSecret.startsWith("pi_"));
      const retired = await prisma.checkoutPayment.findUniqueOrThrow({ where: { id: old.id } });
      assert.equal(retired.status, "EXPIRED"); assert.equal(sessions.get(retired.sessionId).status, "expired");
      assert.equal(await prisma.checkoutPayment.count({ where: { invoiceId: legacy.invoice.id, status: "OPEN", uiMode: "payment_element" } }), 1);
    }
    const blocked = await fixture(client, professional, 50000, 0);
    await prisma.checkoutPayment.create({ data: { invoiceId: blocked.invoice.id, uiMode: "payment_element", amountMillimes: 50000, stripeAmount: 1500, currency: "eur", merchantAccountId: account.id, merchantCountry: account.country, livemode: false, createdAt: new Date(Date.now() - 24 * 3600000) } });
    await assert.rejects(() => createCardPayment(client, blocked.request.id, eligibility), /assistance/);
  } finally {
    await prisma.stripeWebhookEvent.deleteMany({ where: { id: { in: events } } });
    await prisma.checkoutPayment.deleteMany({ where: { invoiceId: { in: invoices } } });
    await prisma.clientInvoice.deleteMany({ where: { id: { in: invoices } } });
    await prisma.serviceRequest.deleteMany({ where: { clientId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    for (const key of envNames) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
    await prisma.$disconnect();
  }
});
