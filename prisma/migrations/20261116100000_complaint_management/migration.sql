ALTER TABLE "Complaint" ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "Complaint" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "Complaint_status_priority_createdAt_idx" ON "Complaint"("status", "priority", "createdAt");
CREATE TABLE "ComplaintAttachment" (
  "id" SERIAL PRIMARY KEY,
  "complaintId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "mime" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "data" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComplaintAttachment_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ComplaintAttachment_complaintId_idx" ON "ComplaintAttachment"("complaintId");
