// Real PostgreSQL + isolated Stripe API test doubles. No application flag or API
// can enable these doubles. No funds or production reviews are created.
import assert from "node:assert/strict";
import { test } from "node:test";
import { registerHooks } from "node:module";
import { SignJWT } from "jose";
import Stripe from "stripe";
import { prisma } from "../src/app/lib/prisma.ts";
registerHooks({ resolve(specifier, context, next) { return specifier === "server-only" ? { url: "data:text/javascript,export{}", shortCircuit: true } : next(specifier, context); } });
const { createCheckout, handleStripeEvent, stripeEligibility, stripeClient } = await import("../src/app/lib/stripe-payments.ts");
const { POST: webhook } = await import("../src/app/api/stripe/webhook/route.ts");
const base = process.env.DIRECTORY_TEST_URL || "http://localhost:3000";
test("Checkout persistence, concurrent retries, signed settlement, review ownership and publication", { timeout: 120000 }, async () => {
  const ids = [], eventIds = [];
  const envNames = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "STRIPE_TEST_CURRENCY", "STRIPE_TEST_EXCHANGE_RATE"];
  const savedEnv = Object.fromEntries(envNames.map((key) => [key, process.env[key]]));
  process.env.STRIPE_SECRET_KEY = "sk_test_homefix_unit_only"; process.env.STRIPE_WEBHOOK_SECRET = "whsec_homefix_unit_only";
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_homefix_unit_only";
  process.env.STRIPE_TEST_CURRENCY = "eur"; process.env.STRIPE_TEST_EXCHANGE_RATE = "0.30";
  async function user(role) {
    const u = await prisma.user.create({ data: { email: `checkout-${crypto.randomUUID()}@example.invalid`, name: "Checkout test fixture", password: "not-a-login", role, status: role === "CLIENT" ? "ACTIVE" : "APPROVED", termsAccepted: true } }); ids.push(u.id);
    const token = await new SignJWT({ userId: u.id }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("10m").sign(new TextEncoder().encode(process.env.JWT_SECRET));
    return { ...u, headers: { Cookie: `session=${token}`, Origin: base, "Content-Type": "application/json" } };
  }
  const account = { id: "acct_homefix_tests", country: "FR", charges_enabled: true, capabilities: { card_payments: "active" } };
  const sessions = new Map(), keys = new Map(); let uncertain = true;
  const gateway = { accounts: { retrieve: async () => account }, countrySpecs: { retrieve: async () => ({ supported_payment_currencies: ["eur", "usd"] }) }, checkout: { sessions: {
    create: async (params, options) => {
      if (params.ui_mode === "embedded_page") {
        assert.equal(params.redirect_on_completion, "never");
        assert.equal(params.success_url, undefined); assert.equal(params.cancel_url, undefined);
      }
      let session = keys.get(options.idempotencyKey);
      if (!session) { session = { id: `cs_test_${crypto.randomUUID()}`, mode: "payment", ui_mode: params.ui_mode || "hosted_page", client_secret: `cs_test_${crypto.randomUUID()}_secret_unit`, url: params.ui_mode ? null : "https://checkout.stripe.com/c/pay/unit-test", status: "open", currency: params.line_items[0].price_data.currency, amount_total: params.line_items[0].price_data.unit_amount, livemode: false, metadata: params.metadata, client_reference_id: params.client_reference_id, payment_status: "unpaid", payment_intent: null }; keys.set(options.idempotencyKey, session); sessions.set(session.id, session); }
      if (uncertain) { uncertain = false; throw new Error("Test network interruption after Stripe accepted request"); }
      return session;
    }, retrieve: async (id) => { assert.ok(sessions.has(id)); return sessions.get(id); }, expire: async (id) => { const session = sessions.get(id); session.status = "expired"; return session; },
  } } };
  const eligibility = () => stripeEligibility(gateway);
  try {
    process.env.STRIPE_SECRET_KEY = "sk_live_forbidden";
    assert.throws(() => stripeClient(), /sk_test_/);
    await assert.rejects(() => stripeEligibility(gateway), /sk_test_/);
    process.env.STRIPE_SECRET_KEY = "sk_test_homefix_unit_only";
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_live_forbidden";
    await assert.rejects(() => stripeEligibility(gateway), /pk_test_/);
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_homefix_unit_only";
    const client = await user("CLIENT"), professional = await user("PROFESSIONAL"), stranger = await user("CLIENT");
    const r = await prisma.serviceRequest.create({ data: { clientId: client.id, professionalId: professional.id, kind: "INTERVENTION", status: "COMPLETED", message: "Isolated test intervention", title: "Test checkout final price" } });
    const q = await prisma.quote.create({ data: { requestId: r.id, amountMillimes: 80501, details: "Prix final accepté", status: "ACCEPTED", validUntil: new Date("2030-01-01") } });
    const invoice = await prisma.clientInvoice.create({ data: { quoteId: q.id, totalMillimes: 80501, depositMillimes: 40251, paidMillimes: 20000 } });
    const post = async (actor, action, fields, expected) => { const response = await fetch(base + "/api/client/espace", { method: "POST", headers: actor.headers, body: JSON.stringify({ action, requestId: r.id, ...fields }) }); const data = await response.json(); assert.equal(response.status, expected, JSON.stringify(data)); return data; };
    assert.equal((await fetch(`${base}/api/client/paiements?requestId=${r.id}`, { headers: stranger.headers })).status, 404);
    assert.equal((await fetch(base + "/api/client/paiements", { method: "POST", headers: client.headers, body: JSON.stringify({ requestId: r.id, amount: 1 }) })).status, 400);
    assert.equal((await fetch(base + "/api/client/paiements", { method: "POST", headers: { ...client.headers, Origin: "https://foreign.invalid" }, body: JSON.stringify({ requestId: r.id }) })).status, 403);
    await assert.rejects(() => createCheckout(stranger.id, r.id, eligibility), /introuvable/);
    await assert.rejects(() => createCheckout(client.id, r.id, eligibility), /interruption/);
    const draft = await prisma.checkoutPayment.findFirstOrThrow({ where: { invoiceId: invoice.id } }); assert.equal(draft.status, "CREATING"); assert.equal(draft.uiMode, "embedded_page"); assert.equal(draft.amountMillimes, 60501); assert.equal(draft.priorPaidMillimes, 20000); assert.equal(draft.stripeAmount, 1815); assert.equal(draft.currency, "eur"); assert.equal(draft.exchangeRatePpm, 300000);
    const results = await Promise.all(Array.from({ length: 4 }, () => createCheckout(client.id, r.id, eligibility)));
    assert.equal(new Set(results.map((x) => x.clientSecret)).size, 1); assert.ok(results[0].clientSecret.startsWith("cs_test_")); assert.equal(new URL(results[0].url).origin, base); assert.equal(keys.size, 1);
    assert.equal(await prisma.checkoutPayment.count({ where: { invoiceId: invoice.id } }), 1);
    assert.equal((await prisma.clientInvoice.findUniqueOrThrow({ where: { id: invoice.id } })).status, "UNPAID");
    await post(client, "review.create", { rating: 5 }, 409);
    // Forged success return cannot confirm a payment.
    const html = await (await fetch(`${base}/dashboard/paiements/${r.id}?retour=succes`, { headers: client.headers })).text(); assert.ok(html.includes("Votre paiement"));
    for (const suffix of ["succes", "annulation"]) {
      const response = await fetch(`${base}/dashboard/paiements/${r.id}/${suffix}`, { headers: client.headers });
      assert.equal(response.status, 200);
      const page = await response.text();
      assert.ok(page.includes(suffix === "annulation" ? "Paiement interrompu" : "Votre paiement"));
      const forbidden = await fetch(`${base}/dashboard/paiements/${r.id}/${suffix}`, { headers: stranger.headers });
      // Next may already have streamed the layout with HTTP 200 when notFound
      // is raised. The rendered not-found boundary still blocks the invoice.
      const deniedPage = await forbidden.text();
      assert.ok(forbidden.status === 404 || deniedPage.includes("NEXT_HTTP_ERROR_FALLBACK;404"), "Return pages enforce invoice ownership");
      assert.ok(!deniedPage.includes('"requestId":' + r.id + ','), "No foreign payment props are rendered");
    }
    assert.equal((await prisma.clientInvoice.findUniqueOrThrow({ where: { id: invoice.id } })).paidMillimes, 20000);
    const session = [...sessions.values()][0];
    session.status = "complete"; session.payment_status = "paid";
    session.payment_intent = { id: `pi_test_${crypto.randomUUID()}`, currency: "eur", amount_received: 1815, status: "succeeded", livemode: false, metadata: session.metadata, latest_charge: { receipt_url: "https://pay.stripe.com/receipts/test", receipt_number: "test-receipt" } };
    const event = { id: `evt_test_${crypto.randomUUID()}`, type: "checkout.session.completed", livemode: false, created: Math.floor(Date.now() / 1000), data: { object: session } }; eventIds.push(event.id);
    session.amount_total = 1814;
    await assert.rejects(() => handleStripeEvent(event, gateway), /Incohérence/);
    assert.equal(await prisma.stripeWebhookEvent.count({ where: { id: event.id } }), 0);
    session.amount_total = 1815;
    session.payment_intent.amount_received = 1814;
    await assert.rejects(() => handleStripeEvent(event, gateway), /confirmé/);
    session.payment_intent.amount_received = 1815;
    await assert.rejects(() => handleStripeEvent({ ...event, livemode: true }, gateway), /réels/);
    await Promise.all([handleStripeEvent(event, gateway), handleStripeEvent(event, gateway)]);
    const paid = await prisma.clientInvoice.findUniqueOrThrow({ where: { id: invoice.id } });
    assert.equal(paid.status, "PAID"); assert.equal(paid.paidMillimes, 80501); assert.equal(paid.receiptNumber, "test-receipt");
    assert.equal(paid.testPaid, true);
    const settled = await (await fetch(`${base}/api/client/paiements?requestId=${r.id}`, { headers: client.headers })).json();
    assert.equal(settled.conversion, undefined, "Technical conversion details stay server-side");
    assert.equal(await prisma.requestEvent.count({ where: { requestId: r.id, status: "PAID" } }), 1);
    assert.equal(await prisma.clientNotification.count({ where: { userId: { in: [client.id, professional.id] }, type: "PAYMENT_RECEIVED" } }), 2);
    await createCheckout(client.id, r.id, eligibility); assert.equal(keys.size, 1, "Paid invoices never create another Checkout");
    // Cancellation reuses an open session; expiry alone permits a fresh one.
    const later = await prisma.serviceRequest.create({ data: { clientId: client.id, professionalId: professional.id, kind: "INTERVENTION", status: "COMPLETED", message: "Expiry test", title: "Retry test" } });
    const laterQuote = await prisma.quote.create({ data: { requestId: later.id, status: "ACCEPTED", amountMillimes: 50000, details: "Fixed final price", validUntil: new Date("2030-01-01") } });
    const laterInvoice = await prisma.clientInvoice.create({ data: { quoteId: laterQuote.id, totalMillimes: 50000, depositMillimes: 25000 } });
    await createCheckout(client.id, later.id, eligibility);
    const beforeExpiry = await prisma.checkoutPayment.findFirstOrThrow({ where: { invoiceId: laterInvoice.id } });
    await createCheckout(client.id, later.id, eligibility); assert.equal(keys.size, 2);
    sessions.get(beforeExpiry.sessionId).status = "expired";
    await Promise.all([createCheckout(client.id, later.id, eligibility), createCheckout(client.id, later.id, eligibility)]);
    assert.equal(keys.size, 3); assert.equal(await prisma.checkoutPayment.count({ where: { invoiceId: laterInvoice.id, status: "OPEN" } }), 1);
    assert.equal((await prisma.checkoutPayment.findUniqueOrThrow({ where: { id: beforeExpiry.id } })).status, "EXPIRED");
    const failedAttempt = await prisma.checkoutPayment.findFirstOrThrow({ where: { invoiceId: laterInvoice.id, status: "OPEN" } });
    const failedSession = sessions.get(failedAttempt.sessionId); failedSession.status = "complete";
    const failedEvent = { id: `evt_test_${crypto.randomUUID()}`, type: "checkout.session.async_payment_failed", livemode: false, created: Math.floor(Date.now() / 1000), data: { object: failedSession } }; eventIds.push(failedEvent.id);
    await handleStripeEvent(failedEvent, gateway);
    assert.equal((await prisma.checkoutPayment.findUniqueOrThrow({ where: { id: failedAttempt.id } })).status, "FAILED");
    assert.equal((await prisma.clientInvoice.findUniqueOrThrow({ where: { id: laterInvoice.id } })).paidMillimes, 0);
    await createCheckout(client.id, later.id, eligibility); assert.equal(keys.size, 4, "A verified failure permits a fresh attempt");
    // Recover an old hosted creation with its original idempotency key, expire
    // it, and only then offer the new embedded session. No parallel checkouts.
    const legacy = await prisma.serviceRequest.create({ data: { clientId: client.id, professionalId: professional.id, kind: "INTERVENTION", status: "COMPLETED", message: "Legacy checkout recovery", title: "Legacy checkout" } });
    const legacyQuote = await prisma.quote.create({ data: { requestId: legacy.id, status: "ACCEPTED", amountMillimes: 90000, details: "Legacy final price", validUntil: new Date("2030-01-01") } });
    const legacyInvoice = await prisma.clientInvoice.create({ data: { quoteId: legacyQuote.id, totalMillimes: 90000, depositMillimes: 45000 } });
    const legacyAttempt = await prisma.checkoutPayment.create({ data: { invoiceId: legacyInvoice.id, amountMillimes: 90000, stripeAmount: 2700, currency: "eur", exchangeRatePpm: 300000, merchantAccountId: account.id, merchantCountry: "FR", livemode: false } });
    assert.equal(legacyAttempt.uiMode, "hosted_page");
    const migrated = await createCheckout(client.id, legacy.id, eligibility);
    assert.equal(new URL(migrated.url).origin, base); assert.ok(migrated.clientSecret);
    assert.equal((await prisma.checkoutPayment.findUniqueOrThrow({ where: { id: legacyAttempt.id } })).status, "EXPIRED");
    assert.equal(await prisma.checkoutPayment.count({ where: { invoiceId: legacyInvoice.id, status: "OPEN", uiMode: "embedded_page" } }), 1);
    // A late failure after a successful payment cannot downgrade its invoice.
    const late = { ...event, id: `evt_test_${crypto.randomUUID()}`, type: "checkout.session.async_payment_failed" }; eventIds.push(late.id);
    await handleStripeEvent(late, gateway);
    assert.equal((await prisma.clientInvoice.findUniqueOrThrow({ where: { id: invoice.id } })).status, "PAID");
    await post(stranger, "review.create", { rating: 5 }, 404);
    await post(client, "review.create", { rating: null, comment: "   " }, 400);
    await post(client, "review.create", { rating: 6 }, 400);
    await post(client, "review.create", { rating: null, comment: "Travail propre et très soigné." }, 200);
    let review = await prisma.professionalReview.findUniqueOrThrow({ where: { requestId: r.id } }); assert.equal(review.rating, null); assert.equal(review.published, true);
    await post(client, "review.create", { rating: 5 }, 409);
    await post(client, "review.update", { rating: 4, comment: "" }, 200);
    review = await prisma.professionalReview.findUniqueOrThrow({ where: { requestId: r.id } }); assert.equal(review.rating, 4);
    const profile = await (await fetch(`${base}/dashboard/professionnels/${professional.id}`, { headers: client.headers })).text(); assert.match(profile, /4\.0/);
    const proReviews = await (await fetch(`${base}/professionnel/avis`, { headers: professional.headers })).text(); assert.match(proReviews, /Test checkout final price/);
    const mine = await (await fetch(`${base}/dashboard/avis`, { headers: client.headers })).text(); assert.match(mine, /Test checkout final price/);
    await prisma.professionalReview.update({ where: { id: review.id }, data: { createdAt: new Date(Date.now() - 8 * 86400000) } });
    await post(client, "review.update", { rating: 3 }, 409);
    // Test the actual webhook route's raw-body signature verification.
    const payload = JSON.stringify({ id: `evt_test_${crypto.randomUUID()}`, type: "payment_intent.created", livemode: false, data: { object: {} } });
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
    const req = (body, sig) => new Request(`${base}/api/stripe/webhook`, { method: "POST", body, headers: { "stripe-signature": sig } });
    assert.equal((await webhook(req(payload, "bad-signature"))).status, 400);
    assert.equal((await webhook(req(payload + " ", signature))).status, 400);
    assert.equal((await webhook(req(payload, signature))).status, 200);
    const livePayload = JSON.stringify({ id: "evt_live_test_rejected", type: "payment_intent.created", livemode: true, data: { object: {} } });
    const liveSignature = Stripe.webhooks.generateTestHeaderString({ payload: livePayload, secret: process.env.STRIPE_WEBHOOK_SECRET });
    assert.equal((await webhook(req(livePayload, liveSignature))).status, 400);
  } finally {
    await prisma.stripeWebhookEvent.deleteMany({ where: { id: { in: eventIds } } });
    await prisma.professionalReview.deleteMany({ where: { clientId: { in: ids } } });
    await prisma.checkoutPayment.deleteMany({ where: { invoice: { quote: { request: { clientId: { in: ids } } } } } });
    await prisma.clientInvoice.deleteMany({ where: { quote: { request: { clientId: { in: ids } } } } });
    await prisma.serviceRequest.deleteMany({ where: { clientId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    for (const key of envNames) { if (savedEnv[key] === undefined) delete process.env[key]; else process.env[key] = savedEnv[key]; }
    await prisma.$disconnect();
  }
});
