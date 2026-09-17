import { Request, Response } from 'express';
import { z } from 'zod';
import type { TicketStatus } from '@prisma/client';
import { getPrisma } from '../src/prisma.js';
import type { AuthRequest } from '../src/auth.middleware.js';
import { parseTicketIdParam } from '../src/ticketId.js';

// IT Staff ticket operations (api-spec §3, BR-13–BR-15). All endpoints here
// require role IT_STAFF or ADMIN (enforced in App.ts via requireRole); the
// acting identity is always req.user (BR-04).

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
const STATUSES: readonly TicketStatus[] = [
  'NEW',
  'OPEN',
  'IN_PROGRESS',
  'WAITING_FOR_REQUESTER',
  'RESOLVED',
  'CLOSED',
  'REOPENED',
  'CANCELLED',
];

// §6 transition matrix — legal targets per current status (IT/Admin actor).
const MATRIX: Record<TicketStatus, readonly TicketStatus[]> = {
  NEW: ['OPEN', 'IN_PROGRESS', 'CANCELLED', 'RESOLVED'],
  OPEN: ['IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'],
  IN_PROGRESS: ['OPEN', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'],
  WAITING_FOR_REQUESTER: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
  RESOLVED: ['CLOSED', 'REOPENED'],
  CLOSED: ['REOPENED'],
  REOPENED: ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CANCELLED'],
  CANCELLED: [],
};

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
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      owner: { select: { id: true, name: true } },
    },
  });
  if (!ticket) {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Ticket not found' },
    });
    return null;
  }
  return { sessionUser, ticket, prisma };
}

// POST /api/tickets/:id/claim — current user becomes the Owner (BR-13).
// Only unassigned tickets can be claimed; 400 if already owned.
// Atomic guard (updateMany where ownerId null) so concurrent claims cannot
// both succeed — the loser gets 400 ALREADY_OWNED instead of last-wins.
export const claimTicket = async (req: Request, res: Response) => {
  try {
    const loaded = await loadTicket(req, res);
    if (!loaded) return;
    const { sessionUser, ticket, prisma } = loaded;

    if (ticket.ownerId !== null) {
      return res.status(400).json({
        error: { code: 'ALREADY_OWNED', message: 'Ticket is already owned.' },
      });
    }

    const claimed = await prisma.ticket.updateMany({
      where: { id: ticket.id, ownerId: null },
      data: { ownerId: sessionUser.id },
    });
    if (claimed.count === 0) {
      return res.status(400).json({
        error: { code: 'ALREADY_OWNED', message: 'Ticket is already owned.' },
      });
    }

    const updated = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      select: {
        id: true,
        ownerId: true,
        owner: { select: { id: true, name: true } },
      },
    });
    return res.status(200).json(updated);
  } catch {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  }
};

// POST /api/tickets/:id/assign { ownerId } — reassign to another active
// IT Staff or Administrator (BR-13). Inactive/non-staff target → 400.
export const assignTicket = async (req: Request, res: Response) => {
  try {
    const loaded = await loadTicket(req, res);
    if (!loaded) return;
    const { ticket, prisma } = loaded;

    const parsed = z.object({ ownerId: z.coerce.number().int().positive() }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'ownerId must be a positive integer.' },
      });
    }

    const target = await prisma.user.findUnique({ where: { id: parsed.data.ownerId } });
    if (!target || !target.isActive || (target.role !== 'IT_STAFF' && target.role !== 'ADMIN')) {
      return res.status(400).json({
        error: {
          code: 'INVALID_OWNER',
          message: 'Owner must be an active IT Staff member or Administrator.',
        },
      });
    }

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { ownerId: target.id },
      select: {
        id: true,
        ownerId: true,
        owner: { select: { id: true, name: true } },
      },
    });
    return res.status(200).json(updated);
  } catch {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  }
};

// PATCH /api/tickets/:id/it-priority { itPriority } — IT Priority only;
// Requested Priority is never modified (BR-14).
export const setItPriority = async (req: Request, res: Response) => {
  try {
    const loaded = await loadTicket(req, res);
    if (!loaded) return;
    const { ticket, prisma } = loaded;

    const parsed = z.object({ itPriority: z.enum(PRIORITIES) }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: `itPriority must be one of ${PRIORITIES.join(', ')}.`,
        },
      });
    }

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { itPriority: parsed.data.itPriority },
      select: { id: true, requestedPriority: true, itPriority: true },
    });
    return res.status(200).json(updated);
  } catch {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  }
};

// PATCH /api/tickets/:id/status { status } — matrix-governed transition
// (BR-15). Illegal edge → 400 INVALID_STATUS_TRANSITION, unchanged (AC-19).
// Conditional write (updateMany where status = from) so a concurrent
// transition cannot resurrect a ticket out of a terminal state.
export const setTicketStatus = async (req: Request, res: Response) => {
  try {
    const loaded = await loadTicket(req, res);
    if (!loaded) return;
    const { ticket, prisma } = loaded;

    const parsed = z.object({ status: z.enum(STATUSES as unknown as [TicketStatus, ...TicketStatus[]]) }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Unknown status value.' },
      });
    }

    const from = ticket.status;
    const to = parsed.data.status;
    if (!MATRIX[from].includes(to)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_STATUS_TRANSITION',
          message: `Cannot move a ticket from ${from} to ${to}.`,
        },
      });
    }

    const applied = await prisma.ticket.updateMany({
      where: { id: ticket.id, status: from },
      data: { status: to },
    });
    if (applied.count === 0) {
      return res.status(400).json({
        error: {
          code: 'INVALID_STATUS_TRANSITION',
          message: `Cannot move a ticket from ${from} to ${to}.`,
        },
      });
    }
    return res.status(200).json({ id: ticket.id, status: to });
  } catch {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  }
};
