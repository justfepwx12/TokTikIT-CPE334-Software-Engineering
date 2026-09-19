import { Request, Response } from 'express';
import { z } from 'zod';
import { getPrisma } from '../src/prisma.js';
import type { AuthRequest } from '../src/auth.middleware.js';
import { parseTicketIdParam } from '../src/ticketId.js';

// Public Comments engine (api-spec §4, BR-17/BR-19/BR-20).
// Append-only: only list + append endpoints exist — no edit/delete routes.
// Visible to the owning Requester, IT Staff and Administrators.

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
  const ticketId = parseTicketIdParam(raw);
  if (ticketId === null) {
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

/**
 * Comment visibility (BR-17): IT Staff/Admin see all tickets; a Requester
 * sees only tickets they own. Foreign ticket → 403 without existence leak.
 */
function canSeeComments(
  role: string,
  requesterId: number,
  ticketRequesterId: number,
): boolean {
  if (role === 'IT_STAFF' || role === 'ADMIN') return true;
  return requesterId === ticketRequesterId;
}

const authorSelect = { id: true, name: true, role: true } as const;

// GET /api/tickets/:id/comments — newest-first (BR-17).
export const listComments = async (req: Request, res: Response) => {
  try {
    const loaded = await loadTicket(req, res);
    if (!loaded) return;
    const { sessionUser, ticket, prisma } = loaded;

    if (!canSeeComments(sessionUser.role, sessionUser.id, ticket.requesterId)) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'You do not have permission to view these comments.' },
      });
    }

    const comments = await prisma.comment.findMany({
      where: { ticketId: ticket.id },
      select: { id: true, body: true, createdAt: true, author: { select: authorSelect } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return res.status(200).json({ comments });
  } catch {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  }
};

// POST /api/tickets/:id/comments { body } — append only (BR-19/BR-20).
export const postComment = async (req: Request, res: Response) => {
  try {
    const loaded = await loadTicket(req, res);
    if (!loaded) return;
    const { sessionUser, ticket, prisma } = loaded;

    if (!canSeeComments(sessionUser.role, sessionUser.id, ticket.requesterId)) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'You do not have permission to comment on this ticket.' },
      });
    }

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: `Comment body must be ${BODY_MIN}–${BODY_MAX} characters after trim.`,
        },
      });
    }

    const comment = await prisma.comment.create({
      data: { body: parsed.data.body, authorId: sessionUser.id, ticketId: ticket.id },
      select: { id: true, body: true, createdAt: true, author: { select: authorSelect } },
    });
    return res.status(201).json(comment);
  } catch {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  }
};
