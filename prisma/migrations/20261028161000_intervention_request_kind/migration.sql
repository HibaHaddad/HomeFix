-- Preserve the historical QUOTE records while introducing a distinct
-- intervention kind. MESSAGE records are conversation containers.
ALTER TABLE "ServiceRequest" DROP CONSTRAINT "ServiceRequest_kind_check";
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_kind_check"
CHECK ("kind" IN ('QUOTE', 'MESSAGE', 'INTERVENTION'));
