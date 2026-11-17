import assert from "node:assert/strict";
import { test } from "node:test";
import { registerHooks } from "node:module";
import { PDFDocument } from "pdf-lib";

registerHooks({ resolve(s, c, next) {
  return s === "server-only" ? { url: "data:text/javascript,export{}", shortCircuit: true } : next(s, c);
} });
const { createReceiptPdf } = await import("../src/app/lib/receipt-pdf.ts");
const state = globalThis.__adminReceiptTest = { access: { admin: { id: 1 } }, calls: 0, payment: null, payload: null };
state.render = async payload => { state.payload = payload; return createReceiptPdf(payload); };
state.findFirst = async ({ where }) => {
  state.calls++;
  const payment = state.payment;
  return payment && where.id === payment.id && where.livemode === payment.livemode && where.status.in.includes(payment.status) && payment.paymentIntentId !== null ? payment : null;
};
const mocks = {
  "@/app/lib/admin-access": "export async function requireAdmin(){return globalThis.__adminReceiptTest.access}",
  "@/app/lib/prisma": "export const prisma={checkoutPayment:{findFirst:args=>globalThis.__adminReceiptTest.findFirst(args)}}",
  "@/app/lib/receipt-pdf": "export const createReceiptPdf=payload=>globalThis.__adminReceiptTest.render(payload)",
};
registerHooks({ resolve(s, c, next) {
  return s in mocks ? { url: `data:text/javascript,${encodeURIComponent(mocks[s])}`, shortCircuit: true } : next(s, c);
} });
const { GET } = await import("../src/app/api/admin/payments/[id]/recu/route.ts");
const id = "11111111-2222-3333-4444-555555555555";
const get = (value = id) => GET(new Request(`http://localhost/api/admin/payments/${value}/recu`), { params: Promise.resolve({ id: value }) });
function fixture(overrides = {}) {
  return {
    id, status: "SUCCEEDED", livemode: false, paymentIntentId: "pi_current", amountMillimes: 60000,
    createdAt: new Date("2026-11-16T19:00:00Z"),
    allocation: { createdAt: new Date("2026-11-16T19:01:00Z"), grossMillimes: 60000, commissionBps: 1000, commissionMillimes: 6000, professionalMillimes: 54000, refundedMillimes: 0, refundedCommissionMillimes: 0, refundedProfessionalMillimes: 0 },
    invoice: { id: 12, createdAt: new Date(), paidAt: new Date(), totalMillimes: 90000, paidMillimes: 90000, receiptNumber: "receipt_other", paymentReference: "pi_other", testPaid: true, quote: { details: "Main-d’œuvre et pièces", request: { title: "Réparation climatisation", address: "Tunis", client: { name: "Amira" }, professional: { name: "Sherif", businessName: "Climatisation Sherif" } } } },
    ...overrides,
  };
}

test("admin receipt rejects unauthorized and malformed requests before reading payments", async () => {
  for (const status of [401, 403]) {
    state.access = { error: Response.json({ error: "Accès refusé" }, { status }) };
    assert.equal((await get()).status, status);
  }
  state.access = { admin: { id: 1 } };
  assert.equal((await get("invalid")).status, 404);
  assert.equal(state.calls, 0);
});

test("admin receipt excludes unpaid, failed and live payments", async () => {
  for (const status of ["CREATING", "PENDING", "OPEN", "PROCESSING", "FAILED", "EXPIRED"]) {
    state.payment = fixture({ status });
    assert.equal((await get()).status, 404);
  }
  state.payment = fixture({ livemode: true });
  assert.equal((await get()).status, 404);
  state.payment = fixture({ paymentIntentId: null });
  assert.equal((await get()).status, 404);
});

test("admin receipt renders the shared HomeFix PDF with the selected transaction's split", async () => {
  state.payment = fixture();
  const response = await get();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.match(response.headers.get("cache-control"), /private, no-store/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(response.headers.get("content-disposition"), /^inline; filename="homefix-recu-.*\.pdf"$/);
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), "%PDF-");
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getAuthor(), "HomeFix TN");
  assert.equal(pdf.getPageCount(), 1);
  assert.equal(state.payload.receiptNumber, "pi_current");
  assert.equal(state.payload.paidMillimes, 60000);
  assert.equal(state.payload.allocation.commissionMillimes, 6000);
  assert.equal(state.payload.professional, "Climatisation Sherif");
});

test("admin receipt supports refund history and historical payments without inventing commissions", async () => {
  for (const status of ["PARTIALLY_REFUNDED", "REFUNDED"]) {
    state.payment = fixture({ status });
    state.payment.allocation.refundedMillimes = 30000;
    state.payment.allocation.refundedCommissionMillimes = 3000;
    state.payment.allocation.refundedProfessionalMillimes = 27000;
    assert.equal((await get()).status, 200);
    assert.equal(state.payload.allocation.refundedMillimes, 30000);
  }
  state.payment = fixture({ allocation: null });
  assert.equal((await get()).status, 200);
  assert.equal(state.payload.allocation, undefined);
  assert.equal(state.payload.paidMillimes, 60000);
});
