-- Lab 4 BR-28/AD-15 — Persist idempotency keys for action creation so the
-- 24h replay guarantee survives restarts and eviction (in-memory storage
-- cannot promise either). New table only; zero alterations to legacy tables.
-- Downgrade: drop this table only.
CREATE TABLE "IdempotencyKey" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IdempotencyKey_ticketId_key_key" ON "IdempotencyKey"("ticketId", "key");
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE Cascade ON UPDATE Cascade;
