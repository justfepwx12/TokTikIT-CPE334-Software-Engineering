import express, { Request, Response } from "express";
import cors from "cors";
import { getPrisma } from "./prisma.js";
import { createTicket } from "../controllers/ticket.controller.js";

// The Express app is exported separately from app.listen() (see index.ts) so
// Supertest can import `app` without opening a port. Do not merge these files.
export const app = express();

app.use(cors());          // already wired: lets the Vite dev server call this API
app.use(express.json());

// Issue 2 — API health check
// It must return HTTP 200 with JSON: { status: "ok", service: "TokTickIT API" }
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "TokTikIT API" });
});

// Issue 4 — Category list
// GET /api/categories
app.get("/api/categories", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const categories = await prisma.category.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        id: "asc",
      },
    });
    res.json(categories);
  } catch {
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// Issue 48 — Active Development Requester list
// GET /api/requesters
// AC: "GET API retrieves only active Development Requesters from the database."
// Response shape per api-spec.md §1: { id, name, email, isActive }.
// Ordered by name (not id) since this feeds a user-facing selection dropdown.
app.get("/api/requesters", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const requesters = await prisma.requester.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
      },
      orderBy: {
        name: "asc",
      },
    });
    res.json(requesters);
  } catch {
    res.status(500).json({ error: "Failed to fetch requesters" });
  }
});

// Issue 52 — Create Ticket
// POST /api/tickets
app.post("/api/tickets", createTicket);

export default app;