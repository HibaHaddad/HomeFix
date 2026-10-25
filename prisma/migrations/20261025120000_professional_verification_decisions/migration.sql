ALTER TABLE "User"
  ADD COLUMN "verificationReason" TEXT,
  ADD COLUMN "verifiedAt" TIMESTAMP(3),
  ADD COLUMN "verifiedById" INTEGER;

-- Preserve access for professionals who were already active before this review flow.
UPDATE "User"
SET "status" = 'APPROVED'
WHERE "role" = 'PROFESSIONAL' AND "status" = 'ACTIVE';
