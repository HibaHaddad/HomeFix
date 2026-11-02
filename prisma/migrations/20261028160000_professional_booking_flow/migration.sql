-- AlterTable
ALTER TABLE "ServiceRequest" ADD COLUMN     "conversationId" INTEGER,
ALTER COLUMN "professionalId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "slotId" INTEGER;

-- CreateTable
CREATE TABLE "AvailabilitySlot" (
    "id" SERIAL NOT NULL,
    "professionalId" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AvailabilitySlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AvailabilitySlot_professionalId_startsAt_endsAt_idx" ON "AvailabilitySlot"("professionalId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "ServiceRequest_conversationId_idx" ON "ServiceRequest"("conversationId");

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ServiceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "AvailabilitySlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A free conversation is unique per client/professional. Intervention requests
-- reference it; opening a chat never creates an intervention or books a slot.
CREATE UNIQUE INDEX "ServiceRequest_free_conversation_key"
ON "ServiceRequest" ("clientId", "professionalId")
WHERE "kind" = 'MESSAGE' AND "status" = 'CONVERSATION';

ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_valid_dates"
CHECK ("endsAt" > "startsAt");
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_valid_dates"
CHECK ("endsAt" > "startsAt");

-- Built-in range GiST operators avoid requiring the btree_gist extension.
-- Pending proposals do not occupy time; accepted slots and confirmed bookings do.
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_no_professional_overlap"
EXCLUDE USING gist (
  int8range("professionalId"::bigint, "professionalId"::bigint, '[]') WITH &&,
  tsrange("startsAt", "endsAt", '[)') WITH &&
) WHERE ("status" IN ('ACCEPTED', 'CONFIRMED'));

ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_no_active_overlap"
EXCLUDE USING gist (
  int8range("professionalId"::bigint, "professionalId"::bigint, '[]') WITH &&,
  tsrange("startsAt", "endsAt", '[)') WITH &&
) WHERE ("active");
