-- Historical sessions keep their mode, including an uncertain creation whose
-- original idempotency key must be recovered before expiring the hosted page.
ALTER TABLE "CheckoutPayment" ADD COLUMN "uiMode" TEXT NOT NULL DEFAULT 'hosted_page';
