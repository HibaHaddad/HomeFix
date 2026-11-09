ALTER TABLE "AssistantConversation" ADD COLUMN "title" TEXT NOT NULL DEFAULT 'Nouvelle conversation';
UPDATE "AssistantConversation"
SET "title" = LEFT(REGEXP_REPLACE("messages"->0->>'text', '\s+', ' ', 'g'), 70)
WHERE jsonb_array_length("messages") > 0 AND LENGTH(TRIM("messages"->0->>'text')) > 0;
