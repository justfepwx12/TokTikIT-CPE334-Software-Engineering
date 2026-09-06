import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

// Load .env so DATABASE_URL is available regardless of entry point
// (tests import app/prisma directly without going through index.ts).
dotenv.config();

// Lazy singleton: the client is created on first use, not at import time.
// This keeps route modules and tests that don't touch the DB (e.g. /api/health)
// free of database side effects.
let client: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!client) client = new PrismaClient();
  return client;
}
