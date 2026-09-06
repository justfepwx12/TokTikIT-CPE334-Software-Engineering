import express, { Request, Response } from "express";
import cors from "cors";
import { getPrisma } from "./prisma.js";
import { createTicket } from "../controllers/ticket.controller.js";
import { listTickets } from "../controllers/listTickets.controller.js";
import { getTicketById } from "../controllers/ticketById.controller.js";
import {
  attachmentUpload,
  getAttachmentMeta,
  downloadAttachment,
  removeAttachment,
} from "../controllers/attachment.controller.js";

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

// Issue 43 — Related System list
// GET /api/systems
// Response shape per api-spec.md §3: [{ id, name }]. Ordered by id since this
// feeds a user-facing Related System dropdown on Create Ticket (and the
// My Tickets filter dropdown).
app.get("/api/systems", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const systems = await prisma.relatedSystem.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        id: "asc",
      },
    });
    res.json(systems);
  } catch {
    res.status(500).json({ error: "Failed to fetch related systems" });
  }
});

// Issue 55 — My Tickets list
// GET /api/tickets
// Paginated, searchable, filterable, sortable list owned by the active Requester.
app.get("/api/tickets", listTickets);

// Issue 61 — Ticket Detail
// GET /api/tickets/:id — full details of one owned ticket incl. attachments
// (active and soft-removed) so the UI can render both states.
app.get("/api/tickets/:id", getTicketById);

// Issue 52 — Create Ticket
// POST /api/tickets
app.post("/api/tickets", createTicket);

// Issue 60 — Attachments (api-spec §5, BR-05/BR-07/BR-08/BR-20)
// POST /api/attachments/upload — upload one file linked to an owned ticket.
app.post("/api/attachments/upload", attachmentUpload);

// GET /api/attachments/:id — attachment metadata only (no binary content).
app.get("/api/attachments/:id", getAttachmentMeta);

// GET /api/attachments/:id/download — binary stream; 410 if soft-removed.
app.get("/api/attachments/:id/download", downloadAttachment);

// PATCH /api/attachments/:id/remove — soft-remove with mandatory reason.
app.patch("/api/attachments/:id/remove", removeAttachment);

export default app;