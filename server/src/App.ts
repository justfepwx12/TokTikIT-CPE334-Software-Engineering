import express, { Request, Response } from "express";
import cors from "cors";
import { getPrisma } from "./prisma.js";
import { createTicket } from "../controllers/ticket.controller.js";
import { listTickets } from "../controllers/listTickets.controller.js";
import { getTicketById } from "../controllers/ticketById.controller.js";
import { resolveIntent } from "../controllers/resolveIntent.controller.js";
import { listComments, postComment } from "../controllers/comments.controller.js";
import { listNotes, postNote } from "../controllers/notes.controller.js";
import { listStaffTickets, getStaffTicketById } from "../controllers/staffTickets.controller.js";
import {
  claimTicket,
  assignTicket,
  setItPriority,
  setTicketStatus,
} from "../controllers/ticketOperations.controller.js";
import {
  listUsers,
  createUser,
  updateUser,
  resetPassword,
} from "../controllers/admin.controller.js";
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
  gateMustChangePassword,
  requireRole,
} from "./auth.middleware.js";
import {
  loginController,
  logoutController,
  meController,
  changePasswordController,
} from "../controllers/auth.controller.js";

export const app = express();

// CORS must allow credentials for the session cookie. In production the
// frontend origin is explicit (FRONTEND_URL); in dev we echo the request
// origin. Never reflect arbitrary origins with credentials in production.
const isProduction = process.env.NODE_ENV === "production";
app.use(
  cors({
    origin: isProduction ? (process.env.FRONTEND_URL ?? false) : true,
    credentials: true,
  }),
);
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
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch categories" },
      });
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
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch requesters" },
      });
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
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch related systems" },
      });
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

// Communication engine — append-only (api-spec §4, BR-17–BR-20).
// Public comments: owning Requester + IT Staff/Admin. Internal notes:
// IT Staff/Admin only (Requester → 403 with no content leak).
app.get("/api/tickets/:id/comments", requireAuth, gateMustChangePassword, listComments);
app.post("/api/tickets/:id/comments", requireAuth, gateMustChangePassword, postComment);
app.get(
  "/api/tickets/:id/notes",
  requireAuth,
  gateMustChangePassword,
  requireRole("IT_STAFF", "ADMIN"),
  listNotes,
);
app.post(
  "/api/tickets/:id/notes",
  requireAuth,
  gateMustChangePassword,
  requireRole("IT_STAFF", "ADMIN"),
  postNote,
);

// IT Staff/Admin operational queue (api-spec §2, BR-13/BR-17).
app.get(
  "/api/staff/tickets",
  requireAuth,
  gateMustChangePassword,
  requireRole("IT_STAFF", "ADMIN"),
  listStaffTickets,
);
app.get(
  "/api/staff/tickets/:id",
  requireAuth,
  gateMustChangePassword,
  requireRole("IT_STAFF", "ADMIN"),
  getStaffTicketById,
);

// Ticket detail operations (api-spec §3, BR-13–BR-15).
const staffOp = [
  requireAuth,
  gateMustChangePassword,
  requireRole("IT_STAFF", "ADMIN"),
] as const;
app.post("/api/tickets/:id/claim", ...staffOp, claimTicket);
app.post("/api/tickets/:id/assign", ...staffOp, assignTicket);
app.patch("/api/tickets/:id/it-priority", ...staffOp, setItPriority);
app.patch("/api/tickets/:id/status", ...staffOp, setTicketStatus);

// Administrator user management (api-spec §5, BR-07–BR-12). Admin only;
// no user is ever deleted (BR-12).
const adminOnly = [requireAuth, gateMustChangePassword, requireRole("ADMIN")] as const;
app.get("/api/admin/users", ...adminOnly, listUsers);
app.post("/api/admin/users", ...adminOnly, createUser);
app.patch("/api/admin/users/:id", ...adminOnly, updateUser);
app.post("/api/admin/users/:id/reset-password", ...adminOnly, resetPassword);

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
