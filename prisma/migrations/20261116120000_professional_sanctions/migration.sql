CREATE TABLE "SanctionRule" (
  "id" TEXT PRIMARY KEY, "enabled" BOOLEAN NOT NULL DEFAULT true,
  "thresholdMinutes" INTEGER NOT NULL DEFAULT 0 CHECK ("thresholdMinutes" BETWEEN 0 AND 10080),
  "amountMillimes" INTEGER NOT NULL DEFAULT 0 CHECK ("amountMillimes" BETWEEN 0 AND 1000000),
  "ratingHundredths" INTEGER NOT NULL DEFAULT 0 CHECK ("ratingHundredths" BETWEEN 0 AND 400),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (("id" = 'LATE' AND "amountMillimes" = 0 AND "ratingHundredths" > 0) OR ("id" IN ('NO_SHOW', 'UNPERFORMED') AND "ratingHundredths" = 0 AND "amountMillimes" > 0))
);
INSERT INTO "SanctionRule" (id, "thresholdMinutes", "amountMillimes", "ratingHundredths") VALUES
('LATE', 30, 0, 100), ('NO_SHOW', 0, 20000, 0), ('UNPERFORMED', 0, 30000, 0);
CREATE TABLE "ProfessionalSanction" (
  "id" TEXT PRIMARY KEY, "requestId" INTEGER NOT NULL, "professionalId" INTEGER NOT NULL,
  "ruleId" TEXT NOT NULL, "family" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reason" TEXT NOT NULL, "evidence" JSONB NOT NULL, "incidentAt" TIMESTAMP(3) NOT NULL,
  "amountMillimes" INTEGER NOT NULL CHECK ("amountMillimes" >= 0), "ratingHundredths" INTEGER NOT NULL CHECK ("ratingHundredths" BETWEEN 0 AND 400),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "appliedAt" TIMESTAMP(3),
  "decidedAt" TIMESTAMP(3), "decidedById" INTEGER, "decisionReason" TEXT, "revokedAt" TIMESTAMP(3),
  "appealStatus" TEXT NOT NULL DEFAULT 'NONE', "appealText" TEXT, "appealAt" TIMESTAMP(3), "appealResolution" TEXT,
  CONSTRAINT "ProfessionalSanction_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProfessionalSanction_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProfessionalSanction_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "SanctionRule"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CHECK ("status" IN ('PENDING','APPLIED','REJECTED','REVOKED')),
  CHECK ("family" IN ('LATENESS','EXECUTION')),
  CHECK ("appealStatus" IN ('NONE','OPEN','UPHELD','ACCEPTED'))
);
CREATE UNIQUE INDEX "ProfessionalSanction_requestId_family_key" ON "ProfessionalSanction"("requestId", "family");
CREATE INDEX "ProfessionalSanction_status_createdAt_idx" ON "ProfessionalSanction"("status", "createdAt");
CREATE INDEX "ProfessionalSanction_professionalId_status_idx" ON "ProfessionalSanction"("professionalId", "status");
CREATE INDEX "ProfessionalSanction_appealStatus_appealAt_idx" ON "ProfessionalSanction"("appealStatus", "appealAt");
CREATE TABLE "SanctionHistory" (
  "id" SERIAL PRIMARY KEY, "sanctionId" TEXT NOT NULL, "actorId" INTEGER NOT NULL,
  "actorName" TEXT NOT NULL, "action" TEXT NOT NULL, "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SanctionHistory_sanctionId_fkey" FOREIGN KEY ("sanctionId") REFERENCES "ProfessionalSanction"(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SanctionHistory_sanctionId_createdAt_idx" ON "SanctionHistory"("sanctionId", "createdAt");
