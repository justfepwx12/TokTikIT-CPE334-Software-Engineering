-- Lab 4 AC-56 / BR-31 — Add the ActionTaken work-log table only.
-- Zero alterations to the seven legacy tables (User, Ticket, Attachment,
-- Comment, InternalNote, Category, RelatedSystem): no columns added,
-- removed, or re-typed, so pre-Lab-4 rows read back unchanged. Pre-Lab-4
-- tickets simply have zero actions (a valid, specified state).
-- Downgrade: drop this table only (indexes and FK constraints go with it).
CREATE TABLE "ActionTaken" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "actionAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "performedById" INTEGER NOT NULL,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "followUpNote" TEXT,
    "attachmentNotes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "seedKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionTaken_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ActionTaken_ticketId_idx" ON "ActionTaken"("ticketId");
CREATE INDEX "ActionTaken_performedById_idx" ON "ActionTaken"("performedById");
CREATE INDEX "ActionTaken_actionAt_idx" ON "ActionTaken"("actionAt");

CREATE UNIQUE INDEX "ActionTaken_ticketId_seedKey_key" ON "ActionTaken"("ticketId", "seedKey");

ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE Restrict ON UPDATE Cascade;
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE Restrict ON UPDATE Cascade;
