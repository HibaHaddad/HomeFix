CREATE TABLE "AssistantConversation" (
  "id" TEXT NOT NULL,
  "clientId" INTEGER NOT NULL,
  "messages" JSONB NOT NULL DEFAULT '[]',
  "busyUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssistantConversation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AssistantConversation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AssistantConversation_clientId_updatedAt_idx" ON "AssistantConversation"("clientId", "updatedAt");
CREATE TABLE "AssistantUsage" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "count" INTEGER NOT NULL DEFAULT 1,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "AssistantUsage_expiresAt_idx" ON "AssistantUsage"("expiresAt");
