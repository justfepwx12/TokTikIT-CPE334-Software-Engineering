-- Lab 3 Issue #78/#90 — Schema evolution: User replaces Requester, single
-- priority splits into requestedPriority + itPriority, Status becomes the
-- 8-value TicketStatus (PENDING -> NEW), Ticket gains an optional owner,
-- and append-only Comment / InternalNote tables are added (AD-03/AD-04).
--
-- Data preservation contract (AD-04, AC-32): all Lab 2 tickets, attachments,
-- categories, related systems, ticketNo values, and timestamps survive
-- byte-for-byte; Requester rows move to User with role = REQUESTER, a single
-- documented known initial password hash (AD-09), and mustChangePassword =
-- true; migrated tickets get ownerId = NULL; PENDING maps to NEW; the old
-- single priority is copied into BOTH requestedPriority and itPriority.

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('REQUESTER', 'IT_STAFF', 'ADMIN');

-- CreateEnum (replaces Lab 2 "Status"; PENDING -> NEW)
CREATE TYPE "TicketStatus" AS ENUM ('NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED');

-- CreateEnum (replaces Lab 2 "Priority")
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateTable: User (migrated from Requester)
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- Migrate every Requester into a User, preserving ids so Ticket.requesterId
-- re-links without touching ticket rows. role = REQUESTER, mustChangePassword
-- = true, passwordHash = bcrypt (cost 10) of the single documented known
-- initial password "TokTickDemo123!" (AD-09) — the stored hash is
-- deterministic and committed so every environment migrates identically.
INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "isActive", "mustChangePassword", "createdAt", "updatedAt")
SELECT
    "id",
    "name",
    "email",
    '$2b$10$Li0TWVcl49FJTB8GphmnQOSlQd10YUcN4Y1A2m5gGeofyAbP6.pGq',
    'REQUESTER',
    "isActive",
    true,
    "createdAt",
    "updatedAt"
FROM "Requester";

-- Keep the id sequence ahead of copied rows so future inserts never collide.
SELECT setval(pg_get_serial_sequence('"User"', 'id'), COALESCE((SELECT MAX("id") FROM "User"), 1));

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- AlterTable: Ticket — add the two priority columns, copy the old value into
-- both, then drop the original single priority (BR-14 / AD-04).
ALTER TABLE "Ticket" ADD COLUMN "requestedPriority" "TicketPriority";
ALTER TABLE "Ticket" ADD COLUMN "itPriority" "TicketPriority";

UPDATE "Ticket" SET
    "requestedPriority" = "priority"::text::"TicketPriority",
    "itPriority" = "priority"::text::"TicketPriority";

ALTER TABLE "Ticket" ALTER COLUMN "requestedPriority" SET NOT NULL;
ALTER TABLE "Ticket" ALTER COLUMN "itPriority" SET NOT NULL;
ALTER TABLE "Ticket" DROP COLUMN "priority";

-- AlterTable: Ticket — re-type status from "Status" to "TicketStatus",
-- mapping PENDING -> NEW and keeping the remaining values unchanged.
ALTER TABLE "Ticket" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Ticket" ALTER COLUMN "status" TYPE "TicketStatus" USING (
    CASE "status"::text
        WHEN 'PENDING' THEN 'NEW'::"TicketStatus"
        WHEN 'IN_PROGRESS' THEN 'IN_PROGRESS'::"TicketStatus"
        WHEN 'RESOLVED' THEN 'RESOLVED'::"TicketStatus"
        WHEN 'CLOSED' THEN 'CLOSED'::"TicketStatus"
    END
);

ALTER TABLE "Ticket" ALTER COLUMN "status" SET DEFAULT 'NEW';

-- AlterTable: Ticket — add the optional primary owner (BR-13); NULL for all
-- migrated rows because Lab 2 had no ownership concept (AD-04).
ALTER TABLE "Ticket" ADD COLUMN "ownerId" INTEGER;

-- Re-point the requesterId foreign key from the removed Requester table to User.
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_requesterId_fkey";
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: Ticket.ownerId -> User (optional, SET NULL on user removal).
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Ticket_ownerId_idx" ON "Ticket"("ownerId");

-- CreateTable: Comment (public, append-only — BR-17)
CREATE TABLE "Comment" (
    "id" SERIAL NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorId" INTEGER NOT NULL,
    "ticketId" INTEGER NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: InternalNote (IT Staff/Admin only, append-only — BR-18)
CREATE TABLE "InternalNote" (
    "id" SERIAL NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorId" INTEGER NOT NULL,
    "ticketId" INTEGER NOT NULL,

    CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Comment_ticketId_idx" ON "Comment"("ticketId");

-- CreateIndex
CREATE INDEX "InternalNote_ticketId_idx" ON "InternalNote"("ticketId");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropTable: Requester (data fully migrated to User above)
DROP TABLE "Requester";

-- DropEnum: both Lab 2 enum types are fully replaced.
DROP TYPE "Status";
DROP TYPE "Priority";