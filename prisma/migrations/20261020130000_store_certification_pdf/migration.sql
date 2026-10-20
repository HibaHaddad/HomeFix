ALTER TABLE "User"
  DROP COLUMN "documentUrl",
  ADD COLUMN "certificationPdf" BYTEA;
