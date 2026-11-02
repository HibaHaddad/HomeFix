import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { SignJWT } from "jose";
import { PDFDocument } from "pdf-lib";
import { prisma } from "../src/app/lib/prisma.ts";
registerHooks({ resolve(s, c, next) { return s === "server-only" ? { url: "data:text/javascript,export{}", shortCircuit: true } : next(s, c); } });
const { createReceiptPdf } = await import("../src/app/lib/receipt-pdf.ts");
const base = process.env.DIRECTORY_TEST_URL || "http://localhost:3000";

test("PDF receipt opens directly, remains private and excludes unpaid invoices", { timeout: 60000 }, async () => {
  const ids = [], invoiceIds = [];
  try {
    for (const role of ["CLIENT", "CLIENT", "PROFESSIONAL"]) {
      const user = await prisma.user.create({ data: { name: "Élodie — عميل", email: `pdf-${crypto.randomUUID()}@example.invalid`, password: "not-a-login", role, status: role === "CLIENT" ? "ACTIVE" : "APPROVED", termsAccepted: true } }); ids.push(user.id);
    }
    const headers = async id => ({ Cookie: `session=${await new SignJWT({ userId: id }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("5m").sign(new TextEncoder().encode(process.env.JWT_SECRET))}` });
    const owner = await headers(ids[0]), stranger = await headers(ids[1]);
    for (const status of ["PAID", "UNPAID"]) {
      const request = await prisma.serviceRequest.create({ data: { clientId: ids[0], professionalId: ids[2], title: "Réparation du robinet", message: "PDF test fixture", kind: "INTERVENTION", status: "COMPLETED", address: "Tunis" } });
      const quote = await prisma.quote.create({ data: { requestId: request.id, status: "ACCEPTED", amountMillimes: 20000, details: "Main-d’œuvre et pièces", validUntil: new Date("2030-01-01") } });
      const invoice = await prisma.clientInvoice.create({ data: { quoteId: quote.id, totalMillimes: 20000, depositMillimes: 0, status, paidMillimes: status === "PAID" ? 20000 : 0, testPaid: status === "PAID", paidAt: status === "PAID" ? new Date() : null } }); invoiceIds.push(invoice.id);
    }
    const url = `${base}/api/client/factures/${invoiceIds[0]}/pdf`;
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await fetch(url, { headers: stranger })).status, 404);
    assert.equal((await fetch(`${base}/api/client/factures/${invoiceIds[1]}/pdf`, { headers: owner })).status, 404);
    const response = await fetch(url, { headers: owner });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/pdf");
    assert.match(response.headers.get("content-disposition"), /^inline; filename="homefix-recu-\d+\.pdf"$/);
    assert.match(response.headers.get("cache-control"), /no-store/);
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.equal(Buffer.from(bytes.subarray(0, 5)).toString(), "%PDF-");
    const pdf = await PDFDocument.load(bytes);
    assert.equal(pdf.getPageCount(), 1);
    assert.match(pdf.getTitle(), /Reçu de paiement HomeFix TN/);
    const old = await fetch(`${base}/dashboard/factures/${invoiceIds[0]}`, { headers: owner });
    if (old.headers.get("content-type") !== "application/pdf") {
      // A streamed Next layout uses a browser redirect instead of HTTP 307.
      const html = await old.text();
      assert.ok(html.includes(`/api/client/factures/${invoiceIds[0]}/pdf`) && html.includes("NEXT_REDIRECT"), "Old receipt pages redirect straight to PDF");
    }

    const long = await createReceiptPdf({ id: 1, title: "Réparation", client: "Élodie عميل", professional: "Artisan", address: "Tunis", details: ("Détail de l’intervention avec accents et retour à la ligne.\n").repeat(100), createdAt: new Date(), paidAt: new Date(), receiptNumber: null, totalMillimes: 20000, paidMillimes: 20000, testPaid: true });
    assert.ok((await PDFDocument.load(long)).getPageCount() > 1, "Long content paginates without overlapping totals");
  } finally {
    await prisma.clientInvoice.deleteMany({ where: { id: { in: invoiceIds } } });
    await prisma.serviceRequest.deleteMany({ where: { clientId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
});
