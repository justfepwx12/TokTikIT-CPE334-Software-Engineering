-- Lab 3 AC-33 — Add a nullable, ticket-scoped seedKey to Comment / InternalNote.
-- Seeded demo rows carry a deterministic key so the seed can upsert only the
-- canonical rows it owns. Real user-authored rows leave it NULL, so re-running
-- prisma db seed never deletes or duplicates user data.
ALTER TABLE "Comment" ADD COLUMN "seedKey" TEXT;
ALTER TABLE "InternalNote" ADD COLUMN "seedKey" TEXT;

CREATE UNIQUE INDEX "Comment_ticketId_seedKey_key" ON "Comment"("ticketId", "seedKey");
CREATE UNIQUE INDEX "InternalNote_ticketId_seedKey_key" ON "InternalNote"("ticketId", "seedKey");