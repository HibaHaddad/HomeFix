-- Keep every existing booking, including legacy competing proposals.
ALTER TABLE "Booking" ADD COLUMN "holdsSlot" BOOLEAN NOT NULL DEFAULT true;
UPDATE "Booking" SET "holdsSlot" = false WHERE "status" IN ('PROPOSED', 'COUNTER_PROPOSED');
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_no_professional_overlap";
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_no_professional_overlap"
EXCLUDE USING gist (
  int8range("professionalId"::bigint, "professionalId"::bigint, '[]') WITH &&,
  tsrange("startsAt", "endsAt", '[)') WITH &&
) WHERE ("status" IN ('ACCEPTED', 'CONFIRMED') OR ("holdsSlot" AND "status" IN ('PROPOSED', 'COUNTER_PROPOSED')));

-- Preserve referenced rows and booking snapshots; convert legacy published
-- ranges into full one-hour choices without changing any appointment.
WITH retired AS (
  UPDATE "AvailabilitySlot" SET "active" = false
  WHERE "active" AND "endsAt" - "startsAt" <> INTERVAL '1 hour'
  RETURNING "professionalId", "startsAt", "endsAt"
)
INSERT INTO "AvailabilitySlot" ("professionalId", "startsAt", "endsAt", "active")
SELECT r."professionalId", hour_start, hour_start + INTERVAL '1 hour', true
FROM retired r CROSS JOIN LATERAL generate_series(r."startsAt", r."endsAt" - INTERVAL '1 hour', INTERVAL '1 hour') AS hour_start;
