ALTER TABLE "ChatMessage" ADD COLUMN "clientNonce" TEXT;
ALTER TABLE "ChatMessage" ADD COLUMN "deliveredAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "ChatMessage_clientNonce_key" ON "ChatMessage"("clientNonce");
ALTER TABLE "ServiceRequest" ADD COLUMN "conversationKey" TEXT;
UPDATE "ServiceRequest" SET "conversationKey" = "clientId"::text || ':' || "professionalId"::text
WHERE "id" IN (SELECT MIN("id") FROM "ServiceRequest" WHERE "kind" = 'MESSAGE' AND "conversationId" IS NULL GROUP BY "clientId", "professionalId");
CREATE UNIQUE INDEX "ServiceRequest_conversationKey_key" ON "ServiceRequest"("conversationKey");
