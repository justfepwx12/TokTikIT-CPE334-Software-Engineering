import { Request, Response } from 'express';
import { z } from 'zod';
import { getPrisma } from '../src/prisma.js';
import type { AuthRequest } from '../src/auth.middleware.js';

// Internal Notes engine (api-spec §4, BR-18/BR-19/BR-20).
// IT Staff/Admin only — enforced in App.ts via requireRole, so a Requester
// gets 403 before reaching here and never sees note content (no leak).
// Append-only: only list + append endpoints exist — no edit/delete routes.

const BODY_MIN = 1;
const BODY_MAX = 2000;

const bodySchema = z.object({
  body: z.string().trim().min(BODY_MIN).max(BODY_MAX),
});

/** Shared: session check + numeric id parse + ticket existence. */
async function loadTicket(req: Request, res: Response) {
  const sessionUser = (req as AuthRequest).user;
  if (!sessionUser) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid session' },
    });
    return null;
  }

  const raw = req.params.id;
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Ticket id must be a positive integer' },
    });
    return null;
  }
  const ticketId = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(ticketId) || ticketId <= 0) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Ticket id must be a positive integer' },
    });
    return null;
  }

  const prisma = getPrisma();
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Ticket not found' },
    });
    return null;
  }
  return { sessionUser, ticket, prisma };
}

const authorSelect = { id: true, name: true, role: true } as const;

// GET /api/tickets/:id/notes — newest-first (BR-18).
export const listNotes = async (req: Request, res: Response) => {
  try {
    const loaded = await loadTicket(req, res);
    if (!loaded) return;
    const { ticket, prisma } = loaded;

    const notes = await prisma.internalNote.findMany({
      where: { ticketId: ticket.id },
      select: { id: true, body: true, createdAt: true, author: { select: authorSelect } },
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json({ notes });
  } catch {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  }
};

// POST /api/tickets/:id/notes { body } — append only (BR-19/BR-20).
export const postNote = async (req: Request, res: Response) => {
  try {
    const loaded = await loadTicket(req, res);
    if (!loaded) return;
    const { sessionUser, ticket, prisma } = loaded;

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: `Note body must be ${BODY_MIN}–${BODY_MAX} characters after trim.`,
        },
      });
    }

    const note = await prisma.internalNote.create({
      data: { body: parsed.data.body, authorId: sessionUser.id, ticketId: ticket.id },
      select: { id: true, body: true, createdAt: true, author: { select: authorSelect } },
    });
    return res.status(201).json(note);
  } catch {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  }
};
