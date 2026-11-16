CREATE TABLE "PaymentAllocation" (
  "paymentId" TEXT PRIMARY KEY,
  "professionalId" INTEGER NOT NULL,
  "commissionBps" INTEGER NOT NULL CHECK ("commissionBps" BETWEEN 0 AND 10000),
  "grossMillimes" INTEGER NOT NULL CHECK ("grossMillimes" > 0),
  "commissionMillimes" INTEGER NOT NULL CHECK ("commissionMillimes" >= 0),
  "professionalMillimes" INTEGER NOT NULL CHECK ("professionalMillimes" >= 0),
  "refundedMillimes" INTEGER NOT NULL DEFAULT 0,
  "refundedCommissionMillimes" INTEGER NOT NULL DEFAULT 0,
  "refundedProfessionalMillimes" INTEGER NOT NULL DEFAULT 0,
  "historical" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "CheckoutPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CHECK ("grossMillimes" = "commissionMillimes" + "professionalMillimes"),
  CHECK ("refundedMillimes" = "refundedCommissionMillimes" + "refundedProfessionalMillimes"),
  CHECK ("refundedMillimes" BETWEEN 0 AND "grossMillimes"),
  CHECK ("refundedCommissionMillimes" BETWEEN 0 AND "commissionMillimes"),
  CHECK ("refundedProfessionalMillimes" BETWEEN 0 AND "professionalMillimes")
);
CREATE INDEX "PaymentAllocation_professionalId_createdAt_idx" ON "PaymentAllocation"("professionalId", "createdAt");
CREATE TABLE "PaymentAccountingRefund" (
  "stripeRefundId" TEXT PRIMARY KEY,
  "paymentId" TEXT NOT NULL,
  "stripeAmount" INTEGER NOT NULL CHECK ("stripeAmount" > 0),
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentAccountingRefund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "CheckoutPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PaymentAccountingRefund_paymentId_status_idx" ON "PaymentAccountingRefund"("paymentId", "status");

-- Preserve historical revenue: no retroactive platform fee on settled payments.
INSERT INTO "PaymentAllocation" ("paymentId", "professionalId", "commissionBps", "grossMillimes", "commissionMillimes", "professionalMillimes", "refundedMillimes", "refundedCommissionMillimes", "refundedProfessionalMillimes", "historical", "createdAt")
SELECT p.id, r."professionalId", 0, p."amountMillimes", 0, p."amountMillimes",
  CASE WHEN p.status = 'REFUNDED' THEN p."amountMillimes" ELSE 0 END, 0,
  CASE WHEN p.status = 'REFUNDED' THEN p."amountMillimes" ELSE 0 END, true, COALESCE(i."paidAt", p."updatedAt")
FROM "CheckoutPayment" p
JOIN "ClientInvoice" i ON i.id = p."invoiceId"
JOIN "Quote" q ON q.id = i."quoteId"
JOIN "ServiceRequest" r ON r.id = q."requestId"
WHERE NOT p.livemode AND p.status IN ('SUCCEEDED', 'REFUNDED') AND p."paymentIntentId" IS NOT NULL;

INSERT INTO "PaymentAccountingRefund" ("stripeRefundId", "paymentId", "stripeAmount", "status", "updatedAt")
SELECT r."stripeRefundId", p.id, COALESCE(p."stripeAmount", p."amountMillimes"), 'succeeded', CURRENT_TIMESTAMP
FROM "AdminRefund" r JOIN "CheckoutPayment" p ON p.id = r."paymentId"
WHERE r.status = 'SUCCEEDED' AND r."stripeRefundId" IS NOT NULL AND NOT p.livemode;
