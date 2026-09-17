import { Request, Response } from 'express';
import { getPrisma } from '../src/prisma.js';
import type { AuthRequest } from '../src/auth.middleware.js';

// POST /api/tickets/:id/resolve-intent — Requester "Problem Appears Resolved"
// action (BR-16, AD-02, api-spec §3). The Requester's ONLY status-changing
// endpoint; it never sets RESOLVED/CLOSED directly — the requester only
// signals, and the ticket moves to RESOLVED (or back to REOPENED).
//
// Transition: NEW/OPEN/IN_PROGRESS/WAITING_FOR_REQUESTER → RESOLVED;
// RESOLVED/CLOSED → REOPENED; CANCELLED (or REOPENED loop) → 400.
export const resolveIntent = async (req: Request, res: Response) => {
  try {
    const sessionUser = (req as AuthRequest).user;
    if (!sessionUser) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Missing or invalid session' },
      });
    }

    const raw = req.params.id;
    if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Ticket id must be a positive integer' },
      });
    }
    const ticketId = Number.parseInt(raw, 10);
    if (!Number.isSafeInteger(ticketId) || ticketId <= 0) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Ticket id must be a positive integer' },
      });
    }

    const prisma = getPrisma();
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, requesterId: true, status: true },
    });
    if (!ticket) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Ticket not found' },
      });
    }

    // BR-05: only the owning Requester, and only the REQUESTER role.
    if (sessionUser.role !== 'REQUESTER' || ticket.requesterId !== sessionUser.id) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Only the owning requester can signal resolution' },
      });
    }

    let nextStatus: 'RESOLVED' | 'REOPENED' | null = null;
    switch (ticket.status) {
      case 'NEW':
      case 'OPEN':
      case 'IN_PROGRESS':
      case 'WAITING_FOR_REQUESTER':
      case 'REOPENED':
        nextStatus = 'RESOLVED';
        break;
      case 'RESOLVED':
      case 'CLOSED':
        nextStatus = 'REOPENED';
        break;
      default:
        nextStatus = null;
    }

    if (nextStatus === null) {
      return res.status(400).json({
        error: {
          code: 'INVALID_STATUS_TRANSITION',
          message: `Cannot signal resolution from status ${ticket.status}.`,
        },
      });
    }

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: nextStatus },
      select: { id: true, status: true },
    });
    return res.status(200).json(updated);
  } catch {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  }
};
