ALTER TABLE "User"
  ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "experienceYears" INTEGER,
  ADD COLUMN "priceMin" INTEGER,
  ADD COLUMN "priceMax" INTEGER,
  ADD COLUMN "availability" TEXT;

ALTER TABLE "User" ADD CONSTRAINT "User_directory_values_check" CHECK (
  ("experienceYears" IS NULL OR "experienceYears" BETWEEN 0 AND 80) AND
  ("priceMin" IS NULL OR "priceMin" BETWEEN 0 AND 100000) AND
  ("priceMax" IS NULL OR "priceMax" BETWEEN 0 AND 100000) AND
  ("priceMin" IS NULL OR "priceMax" IS NULL OR "priceMax" >= "priceMin") AND
  ("availability" IS NULL OR "availability" IN ('AVAILABLE', 'THIS_WEEK', 'BUSY'))
);

CREATE TABLE "ProfessionalReview" (
  "id" SERIAL PRIMARY KEY,
  "professionalId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "clientId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "rating" INTEGER NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
  "comment" TEXT NOT NULL,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "ServiceRequest" (
  "id" SERIAL PRIMARY KEY,
  "clientId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "professionalId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('QUOTE', 'MESSAGE')),
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "User_role_status_isPublic_createdAt_idx" ON "User"("role", "status", "isPublic", "createdAt");
CREATE INDEX "ProfessionalReview_professionalId_published_idx" ON "ProfessionalReview"("professionalId", "published");
CREATE INDEX "ServiceRequest_professionalId_createdAt_idx" ON "ServiceRequest"("professionalId", "createdAt");
CREATE INDEX "ServiceRequest_clientId_createdAt_idx" ON "ServiceRequest"("clientId", "createdAt");
