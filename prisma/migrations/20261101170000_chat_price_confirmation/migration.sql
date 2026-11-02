ALTER TABLE "ChatMessage" ADD COLUMN "quoteId" INTEGER;
CREATE INDEX "ChatMessage_quoteId_idx" ON "ChatMessage"("quoteId");
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
