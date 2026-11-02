ALTER TABLE "ProfessionalReview" ALTER COLUMN "rating" DROP NOT NULL;
ALTER TABLE "ProfessionalReview" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ProfessionalReview" ADD CONSTRAINT "review_rating_range" CHECK ("rating" IS NULL OR "rating" BETWEEN 1 AND 5);
ALTER TABLE "ProfessionalReview" ADD CONSTRAINT "review_content_required" CHECK ("rating" IS NOT NULL OR length(trim("comment")) > 0);
ALTER TABLE "ClientInvoice" ADD COLUMN "paidAt" TIMESTAMP(3), ADD COLUMN "receiptUrl" TEXT, ADD COLUMN "receiptNumber" TEXT;
CREATE TABLE "CheckoutPayment" (
  "id" TEXT PRIMARY KEY, "invoiceId" INTEGER NOT NULL REFERENCES "ClientInvoice"("id") ON DELETE RESTRICT,
  "amountMillimes" INTEGER NOT NULL CHECK ("amountMillimes" > 0), "currency" TEXT NOT NULL DEFAULT 'tnd',
  "status" TEXT NOT NULL DEFAULT 'CREATING', "sessionId" TEXT UNIQUE, "paymentIntentId" TEXT UNIQUE,
  "merchantAccountId" TEXT NOT NULL, "merchantCountry" TEXT NOT NULL, "livemode" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CheckoutPayment_invoiceId_createdAt_idx" ON "CheckoutPayment"("invoiceId", "createdAt");
-- An invoice can have only one active or successful Checkout, including concurrent requests.
CREATE UNIQUE INDEX "CheckoutPayment_one_active_invoice" ON "CheckoutPayment"("invoiceId")
WHERE "status" IN ('CREATING', 'OPEN', 'PROCESSING', 'SUCCEEDED');
CREATE TABLE "StripeWebhookEvent" ("id" TEXT PRIMARY KEY, "type" TEXT NOT NULL, "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
