ALTER TABLE "ClientNotification" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'INFO';
UPDATE "ClientNotification" SET "type" = CASE
  WHEN "title" ILIKE '%en route%' OR "title" LIKE '%EN_ROUTE%' THEN 'PRO_ON_THE_WAY'
  WHEN "title" ILIKE '%validée par le client%' THEN 'INTERVENTION_VALIDATED'
  WHEN "title" ILIKE '%commencé%' OR "title" LIKE '%IN_PROGRESS%' THEN 'INTERVENTION_STARTED'
  WHEN "title" ILIKE '%terminée%' OR "title" LIKE '%COMPLETED%' THEN 'INTERVENTION_COMPLETED'
  WHEN "title" ILIKE '%pièce jointe%' THEN 'ATTACHMENT'
  WHEN "title" ILIKE '%message%' THEN 'MESSAGE'
  WHEN "title" ILIKE '%annul%' THEN 'BOOKING_CANCELLED'
  WHEN "title" ILIKE '%refus%' THEN 'BOOKING_REJECTED'
  WHEN "title" ILIKE '%prix confirmé%' OR "title" ILIKE '%prix accepté%' THEN 'PRICE_ACCEPTED'
  WHEN "title" ILIKE '%rendez-vous%confirm%' THEN 'BOOKING_CONFIRMED'
  WHEN "title" ILIKE '%prix proposé%' OR "title" ILIKE '%devis proposé%' THEN 'PRICE_PROPOSED'
  WHEN "title" ILIKE '%demande%envoy%' THEN 'REQUEST_SENT'
  ELSE 'INFO' END;
CREATE INDEX "ClientNotification_userId_readAt_idx" ON "ClientNotification"("userId", "readAt");
