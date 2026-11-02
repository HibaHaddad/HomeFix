ALTER TABLE "ClientInvoice" ADD COLUMN "testPaid" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CheckoutPayment" ADD COLUMN "priorPaidMillimes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "stripeAmount" INTEGER, ADD COLUMN "exchangeRatePpm" INTEGER;
ALTER TABLE "CheckoutPayment" ADD CONSTRAINT "checkout_test_amount_valid" CHECK (
  "priorPaidMillimes" >= 0 AND ("stripeAmount" IS NULL OR "stripeAmount" > 0)
  AND ("exchangeRatePpm" IS NULL OR "exchangeRatePpm" > 0)
);
