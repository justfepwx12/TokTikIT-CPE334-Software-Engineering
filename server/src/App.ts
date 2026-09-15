import express, { Request, Response, NextFunction } from "express";
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
import { sessionMiddleware } from "./session.js";
import { hydrateUser, requireAuth } from "./auth.middleware.js";
import {
  loginController,
  logoutController,
  meController,
  changePasswordController,
} from "../controllers/auth.controller.js";

export const app = express();

app.use(cors());
app.use(express.json());
app.use(sessionMiddleware);
app.use(hydrateUser);

app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "TokTikIT API" });
});

app.get("/api/categories", async (_req: Request, res: Response) => {
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
});

app.get("/api/requesters", async (_req: Request, res: Response) => {
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
});

app.get("/api/systems", async (_req: Request, res: Response) => {
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
});

app.get("/api/tickets", listTickets);
app.get("/api/tickets/:id", getTicketById);
app.post("/api/tickets", createTicket);
app.post("/api/attachments/upload", attachmentUpload);
app.get("/api/attachments/:id", getAttachmentMeta);
app.get("/api/attachments/:id/download", downloadAttachment);
app.patch("/api/attachments/:id/remove", removeAttachment);

app.post("/api/auth/login", loginController);
app.post("/api/auth/logout", logoutController);
app.get("/api/auth/me", requireAuth, meController);
app.post("/api/auth/change-password", requireAuth, changePasswordController);

export default app;
