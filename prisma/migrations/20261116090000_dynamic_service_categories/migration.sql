BEGIN;
CREATE TABLE "ServiceCategory" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "icon" TEXT NOT NULL DEFAULT 'wrench',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ServiceCategory_normalizedName_key" ON "ServiceCategory"("normalizedName");
CREATE INDEX "ServiceCategory_isActive_name_idx" ON "ServiceCategory"("isActive", "name");
ALTER TABLE "User" ADD COLUMN "categoryId" INTEGER;
ALTER TABLE "ServiceRequest" ADD COLUMN "categoryId" INTEGER;
ALTER TABLE "Equipment" ADD COLUMN "categoryId" INTEGER;

-- Union of all formerly offered registration/request categories and exact legacy values.
-- Seed data lives only in this migration; the running application reads PostgreSQL.
WITH seed(name, icon) AS (VALUES
  ('Plomberie', 'droplets'), ('Électricité', 'zap'), ('Climatisation', 'snowflake'),
  ('Chauffage', 'flame'), ('Serrurerie', 'key'), ('Maçonnerie', 'hammer'),
  ('Peinture', 'paintbrush'), ('Menuiserie', 'wrench'), ('Nettoyage', 'sparkles'),
  ('Électroménager', 'plug'), ('Ménage', 'sparkles'), ('Autre', 'shapes'), ('Autres', 'shapes')
), names AS (
  SELECT name, icon, 0 AS priority FROM seed
  UNION ALL SELECT "specialty", 'wrench', 1 FROM "User" WHERE role = 'PROFESSIONAL' AND trim(COALESCE("specialty", '')) <> ''
  UNION ALL SELECT category, 'wrench', 1 FROM "ServiceRequest" WHERE trim(category) <> ''
  UNION ALL SELECT category, 'wrench', 1 FROM "Equipment" WHERE trim(category) <> ''
), normalized AS (
  SELECT *, translate(lower(regexp_replace(trim(name), '\s+', ' ', 'g')), 'àâäéèêëîïôöùûüç', 'aaaeeeeiioouuuc') AS key FROM names
)
INSERT INTO "ServiceCategory" (name, "normalizedName", icon, aliases)
SELECT (array_agg(name ORDER BY priority, name))[1], key,
       (array_agg(icon ORDER BY priority, name))[1], array_agg(DISTINCT name)
FROM normalized GROUP BY key;

UPDATE "User" u SET "categoryId" = c.id FROM "ServiceCategory" c
WHERE u.role = 'PROFESSIONAL' AND u.specialty = ANY(c.aliases);
UPDATE "ServiceRequest" r SET "categoryId" = c.id FROM "ServiceCategory" c WHERE r.category = ANY(c.aliases);
UPDATE "Equipment" e SET "categoryId" = c.id FROM "ServiceCategory" c WHERE e.category = ANY(c.aliases);
ALTER TABLE "User" ADD CONSTRAINT "User_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "User_categoryId_idx" ON "User"("categoryId");
CREATE INDEX "ServiceRequest_categoryId_idx" ON "ServiceRequest"("categoryId");
CREATE INDEX "Equipment_categoryId_idx" ON "Equipment"("categoryId");
COMMIT;
