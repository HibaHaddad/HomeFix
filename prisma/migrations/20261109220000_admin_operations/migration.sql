ALTER TABLE "ProfessionalReview"
  ADD COLUMN "moderationStatus" TEXT NOT NULL DEFAULT 'NONE',
  ADD COLUMN "moderationReason" TEXT;

CREATE TABLE "AdminAuditLog" (
  "id" SERIAL NOT NULL,
  "actorId" INTEGER NOT NULL,
  "actorName" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "target" TEXT NOT NULL,
  "reason" TEXT,
  "details" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdminAuditLog_createdAt_id_idx" ON "AdminAuditLog"("createdAt", "id");
CREATE INDEX "AdminAuditLog_action_createdAt_idx" ON "AdminAuditLog"("action", "createdAt");
CREATE INDEX "AdminAuditLog_actorId_createdAt_idx" ON "AdminAuditLog"("actorId", "createdAt");

CREATE TABLE "ReviewReport" (
  "id" SERIAL NOT NULL,
  "reviewId" INTEGER NOT NULL,
  "reporterId" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewReport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReviewReport_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "ProfessionalReview"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReviewReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ReviewReport_reviewId_reporterId_key" ON "ReviewReport"("reviewId", "reporterId");
CREATE INDEX "ReviewReport_status_createdAt_idx" ON "ReviewReport"("status", "createdAt");

CREATE TABLE "AdminSetting" (
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminSetting_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "AdminRefund" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "actorId" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "amountMillimes" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "stripeRefundId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminRefund_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdminRefund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "CheckoutPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AdminRefund_paymentId_key" ON "AdminRefund"("paymentId");
CREATE UNIQUE INDEX "AdminRefund_stripeRefundId_key" ON "AdminRefund"("stripeRefundId");
CREATE INDEX "AdminRefund_status_createdAt_idx" ON "AdminRefund"("status", "createdAt");
