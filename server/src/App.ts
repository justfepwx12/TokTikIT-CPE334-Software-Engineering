import express, { Request, Response } from "express";
import cors from "cors";
import { getPrisma } from "./prisma.js";
import { createTicket } from "../controllers/ticket.controller.js";
import { listTickets } from "../controllers/listTickets.controller.js";
import { getTicketById } from "../controllers/ticketById.controller.js";
import { resolveIntent } from "../controllers/resolveIntent.controller.js";
import { listStaffTickets } from "../controllers/staffTickets.controller.js";
import {
  attachmentUpload,
  getAttachmentMeta,
  downloadAttachment,
  removeAttachment,
} from "../controllers/attachment.controller.js";
import { sessionMiddleware } from "./session.js";
import {
  hydrateUser,
  requireAuth,
  requireRole,
  gateMustChangePassword,
} from "./auth.middleware.js";
import {
  loginController,
  logoutController,
  meController,
  changePasswordController,
} from "../controllers/auth.controller.js";

export const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(sessionMiddleware);
app.use(hydrateUser);

// Public — no auth required
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "TokTikIT API" });
});

// Auth routes — login is public; logout/me/change-password require an active
// session but are exempt from gateMustChangePassword so that a first-login
// user can still change their password and sign out (BR-03, api-spec §1).
app.post("/api/auth/login", loginController);
app.post("/api/auth/logout", requireAuth, logoutController);
app.get("/api/auth/me", requireAuth, meController);
app.post("/api/auth/change-password", requireAuth, changePasswordController);

// Protected reference-data routes
app.get(
  "/api/categories",
  requireAuth,
  gateMustChangePassword,
  async (_req: Request, res: Response) => {
    try {
      const prisma = getPrisma();
      const categories = await prisma.category.findMany({
        select: { id: true, name: true },
        orderBy: { id: "asc" },
      });
      res.json(categories);
    } catch {
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  },
);

app.get(
  "/api/requesters",
  requireAuth,
  gateMustChangePassword,
  async (_req: Request, res: Response) => {
    try {
      const prisma = getPrisma();
      const requesters = await prisma.user.findMany({
        where: { role: "REQUESTER", isActive: true },
        select: { id: true, name: true, email: true, isActive: true },
        orderBy: { name: "asc" },
      });
      res.json(requesters);
    } catch {
      res.status(500).json({ error: "Failed to fetch requesters" });
    }
  },
);

app.get(
  "/api/systems",
  requireAuth,
  gateMustChangePassword,
  async (_req: Request, res: Response) => {
    try {
      const prisma = getPrisma();
      const systems = await prisma.relatedSystem.findMany({
        select: { id: true, name: true },
        orderBy: { id: "asc" },
      });
      res.json(systems);
    } catch {
      res.status(500).json({ error: "Failed to fetch related systems" });
    }
  },
);

// Protected ticket routes
app.get("/api/tickets", requireAuth, gateMustChangePassword, listTickets);
app.get("/api/tickets/:id", requireAuth, gateMustChangePassword, getTicketById);
app.post("/api/tickets", requireAuth, gateMustChangePassword, createTicket);
// BR-05/BR-16: requester "Problem Appears Resolved" (owner only).
app.post(
  "/api/tickets/:id/resolve-intent",
  requireAuth,
  gateMustChangePassword,
  resolveIntent,
);

// IT Staff/Admin operational queue (api-spec §2, BR-13/BR-17).
app.get(
  "/api/staff/tickets",
  requireAuth,
  gateMustChangePassword,
  requireRole("IT_STAFF", "ADMIN"),
  listStaffTickets,
);

// Protected attachment routes
app.post(
  "/api/attachments/upload",
  requireAuth,
  gateMustChangePassword,
  attachmentUpload,
);
app.get(
  "/api/attachments/:id",
  requireAuth,
  gateMustChangePassword,
  getAttachmentMeta,
);
app.get(
  "/api/attachments/:id/download",
  requireAuth,
  gateMustChangePassword,
  downloadAttachment,
);
app.patch(
  "/api/attachments/:id/remove",
  requireAuth,
  gateMustChangePassword,
  removeAttachment,
);

export default app;
